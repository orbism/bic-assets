import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db } from "@/lib/db";
import { getSession, atLeast } from "@/lib/session";

const IMAGE = /^image\//;
const VIDEO = /^video\//;

/**
 * Client-upload handshake. The browser sends the file straight to blob storage,
 * which is what makes video possible: a server route on Vercel caps at 4.5MB.
 * This endpoint only authorises the upload and records the result.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;

  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const session = await getSession();
        if (!session || !atLeast(session.role, "EDITOR")) {
          throw new Error("Not allowed to upload");
        }
        const artefactId = clientPayload ? String(clientPayload) : null;
        return {
          allowedContentTypes: ["image/*", "video/*"],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId: session.userId,
            label: session.label,
            artefactId,
            pathname,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        const { userId, label, artefactId } = JSON.parse(tokenPayload ?? "{}");

        const asset = await db.asset.create({
          data: {
            path: blob.url,
            kind: VIDEO.test(blob.contentType ?? "")
              ? "VIDEO"
              : IMAGE.test(blob.contentType ?? "")
                ? "IMAGE"
                : "IMAGE",
            source: "BLOB",
            label: decodeURIComponent(
              (blob.pathname.split("/").pop() ?? "upload").replace(/\.[^.]+$/, ""),
            ),
            folder: "uploads",
          },
        });

        if (artefactId) {
          await db.artefactAsset.upsert({
            where: { artefactId_assetId: { artefactId, assetId: asset.id } },
            create: { artefactId, assetId: asset.id, origin: "MANUAL" },
            update: { dismissed: false },
          });
        }

        await db.auditLog.create({
          data: {
            userId: userId ?? null,
            actorLabel: label ?? "upload",
            action: "CREATE",
            entity: "Asset",
            entityId: asset.id,
            after: { path: blob.url, artefactId },
          },
        });
      },
    });

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}

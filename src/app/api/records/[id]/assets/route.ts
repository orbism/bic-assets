import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthError, requireRole } from "@/lib/session";

/** Attach an existing asset to this record. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("EDITOR");
    const { id: artefactId } = await params;
    const { assetId } = await req.json();

    const [artefact, asset] = await Promise.all([
      db.artefact.findUnique({ where: { id: artefactId }, select: { id: true } }),
      db.asset.findUnique({ where: { id: assetId }, select: { id: true } }),
    ]);
    if (!artefact || !asset) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Re-attaching clears a previous dismissal rather than creating a duplicate.
    await db.artefactAsset.upsert({
      where: { artefactId_assetId: { artefactId, assetId } },
      create: { artefactId, assetId, origin: "MANUAL" },
      update: { dismissed: false, origin: "MANUAL" },
    });

    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "UPDATE",
        entity: "ArtefactAsset",
        entityId: artefactId,
        after: { attached: assetId },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** Detach. The link row is kept and marked dismissed so a re-scan does not
 *  bring it back, and the file itself is never touched. */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("EDITOR");
    const { id: artefactId } = await params;
    const { assetId } = await req.json();

    const link = await db.artefactAsset.findUnique({
      where: { artefactId_assetId: { artefactId, assetId } },
    });
    if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.artefactAsset.update({
      where: { artefactId_assetId: { artefactId, assetId } },
      data: { dismissed: true },
    });

    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "UPDATE",
        entity: "ArtefactAsset",
        entityId: artefactId,
        before: { attached: assetId },
        after: { detached: assetId },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

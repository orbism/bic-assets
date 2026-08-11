import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthError, requireRole } from "@/lib/session";
import { DETAIL_RELATION, sanitise } from "@/lib/record";

const FULL = { memecoin: true, nft: true, collection: true, provfi: true };

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("EDITOR");
    const { id } = await params;

    const before = await db.artefact.findUnique({ where: { id }, include: FULL });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { data, detail } = sanitise(before.sheet, body);
    const relation = DETAIL_RELATION[before.sheet];

    const after = await db.artefact.update({
      where: { id },
      data: {
        ...data,
        ...(relation && Object.keys(detail).length
          ? {
              [relation]: {
                upsert: { create: detail, update: detail },
              },
            }
          : {}),
      },
      include: FULL,
    });

    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "UPDATE",
        entity: "Artefact",
        entityId: id,
        before: JSON.parse(JSON.stringify(before)),
        after: JSON.parse(JSON.stringify(after)),
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireRole("EDITOR");
    const { id } = await params;

    const before = await db.artefact.findUnique({ where: { id }, include: FULL });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    // The full prior state goes to the audit log first, so a delete is always
    // recoverable from there.
    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "DELETE",
        entity: "Artefact",
        entityId: id,
        before: JSON.parse(JSON.stringify(before)),
      },
    });
    await db.artefact.delete({ where: { id } });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

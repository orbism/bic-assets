import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthError, requireRole } from "@/lib/session";
import { slugify } from "@/lib/import";
import { DETAIL_RELATION, sanitise } from "@/lib/record";
import type { Sheet } from "@/generated/prisma/enums";

export async function POST(req: Request) {
  try {
    const session = await requireRole("EDITOR");
    const body = await req.json();
    const sheet = body.sheet as Sheet;
    const name = String(body.name ?? "").trim();
    if (!sheet || !name) {
      return NextResponse.json({ error: "Sheet and name are required" }, { status: 400 });
    }

    // Keep slugs unique within a sheet without ever overwriting a record.
    const base = slugify(name);
    let slug = base;
    for (let n = 2; ; n++) {
      const clash = await db.artefact.findUnique({
        where: { sheet_slug: { sheet, slug } },
        select: { id: true },
      });
      if (!clash) break;
      slug = `${base}-${n}`;
    }

    const { data, detail } = sanitise(sheet, body);
    const relation = DETAIL_RELATION[sheet];

    const created = await db.artefact.create({
      data: {
        sheet,
        slug,
        name,
        ...data,
        ...(relation ? { [relation]: { create: detail } } : {}),
      },
      include: { memecoin: true, nft: true, collection: true, provfi: true },
    });

    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "CREATE",
        entity: "Artefact",
        entityId: created.id,
        after: JSON.parse(JSON.stringify(created)),
      },
    });

    return NextResponse.json({ id: created.id });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

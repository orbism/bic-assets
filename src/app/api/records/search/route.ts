import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthError, requireRole } from "@/lib/session";

export async function GET(req: Request) {
  try {
    await requireRole("EDITOR");
    const q = new URL(req.url).searchParams.get("q")?.trim();
    if (!q || q.length < 2) return NextResponse.json([]);

    const rows = await db.artefact.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { ticker: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, sheet: true },
      orderBy: { name: "asc" },
      take: 12,
    });

    return NextResponse.json(rows);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

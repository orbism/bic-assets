import { NextResponse } from "next/server";
import { scanAssets } from "@/lib/assets";
import { AuthError, requireRole } from "@/lib/session";

/**
 * Re-scan /public/assets. Adds new files and links, leaves manual attachments
 * and dismissals alone, and never deletes anything.
 */
export async function POST() {
  try {
    const session = await requireRole("ADMIN");
    const r = await scanAssets({ userId: session.userId, label: session.label });
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Scan failed" },
      { status: 500 },
    );
  }
}

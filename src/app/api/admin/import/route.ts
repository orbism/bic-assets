import { NextResponse } from "next/server";
import { runImport } from "@/lib/import";
import { AuthError, requireRole } from "@/lib/session";

/**
 * Re-run the CSV import against whatever is in /data. Upsert only: existing
 * records are overwritten field by field, nothing is deleted, and the previous
 * state of every changed row stays in the audit log.
 */
export async function POST() {
  try {
    const session = await requireRole("ADMIN");
    const result = await runImport({
      userId: session.userId,
      label: session.label,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed" },
      { status: 500 },
    );
  }
}

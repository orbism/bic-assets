import { stringify } from "csv-stringify/sync";
import { db } from "@/lib/db";
import { buildWhere, parseFilters, type SearchParams } from "@/lib/query";
import { MASTER_COLS, SHEET_BY_ENUM } from "@/lib/sheets";
import { AuthError } from "@/lib/session";
import { value, type Row } from "@/lib/value";

export async function GET(req: Request) {
  try {
    // Public: the export contains exactly the data the pages already show.
    const url = new URL(req.url);
    const sp: SearchParams = Object.fromEntries(url.searchParams.entries());
    const filters = parseFilters(sp);

    const rows = await db.artefact.findMany({
      where: buildWhere(filters),
      include: { memecoin: true, nft: true, collection: true, provfi: true },
      orderBy: [{ [filters.sort]: filters.dir }, { id: "asc" }],
    });

    // A single-sheet export uses that sheet's own columns; the master export
    // uses the shared set.
    const def = filters.sheet ? SHEET_BY_ENUM.get(filters.sheet) : undefined;
    const cols = def ? def.cols : MASTER_COLS;

    const records = rows.map((r) => {
      const out: Record<string, string> = {};
      if (!def) out["Sheet"] = SHEET_BY_ENUM.get(r.sheet)?.title ?? r.sheet;
      for (const c of cols) {
        if (c.key === "sheet") continue;
        const v = value(r as unknown as Row, c.key);
        out[c.label] = Array.isArray(v)
          ? v.join(", ")
          : v instanceof Date
            ? v.toISOString().slice(0, 10)
            : v == null
              ? ""
              : String(v);
      }
      return out;
    });

    const csv = stringify(records, { header: true });
    const name = `bic-${def?.slug ?? "all"}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${name}"`,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return Response.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

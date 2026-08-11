import DataTable from "@/components/DataTable";
import Filters from "@/components/Filters";
import ExportButton from "@/components/ExportButton";
import { FLAGS, MASTER_COLS, type FlagKey } from "@/lib/sheets";
import { facets, parseFilters, queryArtefacts, type SearchParams } from "@/lib/query";
import { SHEET_BY_ENUM } from "@/lib/sheets";

export default async function MasterPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);
  const [{ rows, total, pages }, f] = await Promise.all([
    queryArtefacts(filters),
    facets(filters.sheet),
  ]);

  const cols = MASTER_COLS.map((c) =>
    c.key === "sheet"
      ? { ...c, key: "sheetLabel" }
      : c,
  );
  const data = rows.map((r) => ({
    ...r,
    sheetLabel: SHEET_BY_ENUM.get(r.sheet)?.title ?? r.sheet,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Master tool</h1>
          <p className="text-sm text-muted">
            Every record from every sheet, in one place.
          </p>
        </div>
        <ExportButton />
      </div>

      <Filters
        facets={f}
        flagKeys={Object.keys(FLAGS) as FlagKey[]}
        showSheet
        total={total}
      />

      <DataTable
        rows={data}
        cols={cols}
        total={total}
        page={filters.page}
        pages={pages}
        basePath="/r"
      />
    </div>
  );
}

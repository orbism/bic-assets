import { notFound } from "next/navigation";
import DataTable from "@/components/DataTable";
import Filters from "@/components/Filters";
import ExportButton from "@/components/ExportButton";
import NewRecordButton from "@/components/NewRecordButton";
import { SHEET_BY_SLUG, SHEETS, type FlagKey } from "@/lib/sheets";
import { facets, parseFilters, queryArtefacts, type SearchParams } from "@/lib/query";
import { getSession, atLeast } from "@/lib/session";

export function generateStaticParams() {
  return SHEETS.map((s) => ({ sheet: s.slug }));
}

export default async function SheetPage({
  params,
  searchParams,
}: {
  params: Promise<{ sheet: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { sheet: slug } = await params;
  const def = SHEET_BY_SLUG.get(slug);
  if (!def) notFound();

  const sp = await searchParams;
  const filters = parseFilters(sp, def.sheet);
  const [{ rows, total, pages }, f, session] = await Promise.all([
    queryArtefacts(filters),
    facets(def.sheet),
    getSession(),
  ]);

  const flagKeys = def.cols
    .filter((c) => c.key.startsWith("f."))
    .map((c) => c.key.slice(2) as FlagKey);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">{def.title}</h1>
          <p className="text-sm text-muted">{def.blurb}</p>
        </div>
        <div className="flex gap-2">
          <ExportButton sheet={def.sheet} />
          {session && atLeast(session.role, "EDITOR") && (
            <NewRecordButton sheet={def.sheet} />
          )}
        </div>
      </div>

      <Filters facets={f} flagKeys={flagKeys} total={total} />

      <DataTable
        rows={rows}
        cols={def.cols}
        total={total}
        page={filters.page}
        pages={pages}
        basePath="/r"
      />
    </div>
  );
}

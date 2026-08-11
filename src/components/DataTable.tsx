"use client";

import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { Col } from "@/lib/sheets";
import { SHEET_BY_ENUM } from "@/lib/sheets";
import { value, type Row } from "@/lib/value";
import MediaThumb from "@/components/MediaThumb";
import { assetsOf } from "@/lib/media";

export type { Row };

const SORTABLE = new Set([
  "name",
  "ticker",
  "creatorName",
  "category",
  "launchDate",
  "sheet",
  "updatedAt",
  "createdAt",
]);

export { value };

export default function DataTable({
  rows,
  cols,
  total,
  page,
  pages,
  basePath,
}: {
  rows: Row[];
  cols: Col[];
  total: number;
  page: number;
  pages: number;
  basePath: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [showAll, setShowAll] = useState(false);

  const visible = showAll ? cols : cols.filter((c) => c.primary);
  const sort = params.get("sort") ?? "name";
  const dir = params.get("dir") ?? "asc";

  function go(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  function sortBy(key: string) {
    if (!SORTABLE.has(key)) return;
    go({ sort: key, dir: sort === key && dir === "asc" ? "desc" : "asc", page: null });
  }

  if (!rows.length) {
    return (
      <div className="card p-10 text-center text-muted">
        No records match these filters.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button className="btn" onClick={() => setShowAll((s) => !s)}>
          {showAll ? "Key columns" : `All ${cols.length} columns`}
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-surface-2/60">
              {visible.map((c) => (
                <th
                  key={c.key}
                  onClick={() => sortBy(c.key)}
                  className={`whitespace-nowrap px-3 py-2.5 text-left font-medium text-muted ${
                    SORTABLE.has(c.key) ? "cursor-pointer hover:text-text" : ""
                  }`}
                  title={c.label}
                >
                  <span className="flex items-center gap-1">
                    <span className="max-w-64 truncate">{c.label}</span>
                    {sort === c.key && (
                      <span className="text-accent">{dir === "asc" ? "↑" : "↓"}</span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b last:border-0 hover:bg-surface-2/50"
              >
                {visible.map((c, i) => (
                  <td key={c.key} className="max-w-80 px-3 py-2 align-top">
                    {i === 0 ? (
                      <span className="flex items-center gap-2.5">
                        <MediaThumb assets={assetsOf(r)} />
                        <span className="min-w-0">
                          <Link
                            href={`${basePath}/${r.id}`}
                            className="font-medium text-accent hover:underline"
                          >
                            {String(value(r, c.key) ?? "—")}
                          </Link>
                          {r.needsReview === true && (
                            <span className="ml-2 chip border-warn/40 text-warn">
                              review
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <Cell v={value(r, c.key)} type={c.type} />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Page {page} of {pages} · {total} records
          </span>
          <div className="flex gap-2">
            <button
              className="btn"
              disabled={page <= 1}
              onClick={() => go({ page: String(page - 1) })}
            >
              Previous
            </button>
            <button
              className="btn"
              disabled={page >= pages}
              onClick={() => go({ page: String(page + 1) })}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const FLAG_STYLE: Record<string, string> = {
  YES: "text-good",
  NO: "text-bad",
  UNKNOWN: "text-muted",
  NA: "text-muted",
};

export function Cell({ v, type }: { v: unknown; type: string }) {
  if (v === null || v === undefined || v === "") {
    return <span className="text-muted/50">—</span>;
  }

  if (type === "flag") {
    const s = String(v);
    return (
      <span className={FLAG_STYLE[s] ?? ""}>
        {s === "NA" ? "N/A" : s[0] + s.slice(1).toLowerCase()}
      </span>
    );
  }

  if (type === "list") {
    const items = Array.isArray(v) ? v : [v];
    if (!items.length) return <span className="text-muted/50">—</span>;
    return (
      <span className="flex flex-wrap gap-1">
        {items.map((i, n) => (
          <span key={n} className="chip font-mono text-[11px]">
            {truncMiddle(String(i))}
          </span>
        ))}
      </span>
    );
  }

  if (type === "date") {
    const d = new Date(String(v));
    return <span>{isNaN(+d) ? String(v) : d.toISOString().slice(0, 10)}</span>;
  }

  if (type === "link") {
    const s = String(v);
    if (/^https?:\/\//i.test(s)) {
      return (
        <a
          href={s}
          target="_blank"
          rel="noreferrer"
          className="text-accent hover:underline"
        >
          {s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
        </a>
      );
    }
    return <span>{s}</span>;
  }

  if (type === "longtext") {
    return (
      <span className="line-clamp-3 text-muted" title={String(v)}>
        {String(v)}
      </span>
    );
  }

  if (type === "grade") {
    return <span className="chip font-medium">{String(v)}</span>;
  }

  return <span>{String(v)}</span>;
}

const truncMiddle = (s: string, keep = 8) =>
  s.length > keep * 2 + 3 ? `${s.slice(0, keep)}…${s.slice(-keep)}` : s;

export const sheetTitle = (s: string) => SHEET_BY_ENUM.get(s as never)?.title ?? s;

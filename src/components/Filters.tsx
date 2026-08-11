"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FLAGS, type FlagKey } from "@/lib/sheets";

type Facet = { value: string; n: number };

export type FacetData = {
  categories: Facet[];
  chains: Facet[];
  tags: Facet[];
};

const YESNO = ["YES", "NO", "UNKNOWN", "NA"] as const;

export default function Filters({
  facets,
  flagKeys,
  showSheet,
  total,
}: {
  facets: FacetData;
  flagKeys: FlagKey[];
  showSheet?: boolean;
  total: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [open, setOpen] = useState(false);

  // Debounce the free-text box so typing does not fire a query per keystroke.
  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") !== q) set({ q: q || null, page: null });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function set(patch: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    startTransition(() => router.push(`${pathname}?${next}`, { scroll: false }));
  }

  function toggleMulti(key: string, value: string) {
    const cur = new Set((params.get(key) ?? "").split(",").filter(Boolean));
    if (cur.has(value)) cur.delete(value);
    else cur.add(value);
    set({ [key]: [...cur].join(","), page: null });
  }

  const active = [...params.keys()].filter(
    (k) => !["sort", "dir", "page"].includes(k) && params.get(k),
  );

  const isOn = (key: string, value: string) =>
    (params.get(key) ?? "").split(",").includes(value);

  return (
    <div className="card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          className="input min-w-56 flex-1"
          placeholder="Search name, ticker, creator, contract, notes…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        {showSheet && (
          <select
            className="input"
            value={params.get("sheet") ?? ""}
            onChange={(e) => set({ sheet: e.target.value || null, page: null })}
          >
            <option value="">All sheets</option>
            <option value="MEMECOIN">Memecoins</option>
            <option value="CELEBRITY_COIN">Celebrity &amp; Creator Coins</option>
            <option value="NFT">NFTs</option>
            <option value="COLLECTION">Collections</option>
            <option value="PROVFI">Prov.fi</option>
          </select>
        )}

        <button className="btn" onClick={() => setOpen((o) => !o)}>
          Filters
          {active.length > 0 && (
            <span className="rounded-full bg-accent-soft px-1.5 text-xs text-accent">
              {active.length}
            </span>
          )}
        </button>

        {active.length > 0 && (
          <button
            className="btn"
            onClick={() => startTransition(() => router.push(pathname))}
          >
            Clear
          </button>
        )}

        <span className="ml-auto text-sm text-muted">{total} records</span>
      </div>

      {open && (
        <div className="mt-3 grid gap-4 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
          <FacetGroup
            label="Chain"
            items={facets.chains}
            on={(v) => isOn("chain", v)}
            toggle={(v) => toggleMulti("chain", v)}
          />
          <FacetGroup
            label="Category"
            items={facets.categories}
            on={(v) => isOn("category", v)}
            toggle={(v) => toggleMulti("category", v)}
          />
          <FacetGroup
            label="Tag"
            items={facets.tags}
            on={(v) => isOn("tag", v)}
            toggle={(v) => toggleMulti("tag", v)}
          />

          <div className="lg:col-span-3">
            <p className="mb-1.5 text-xs font-medium text-muted">Provenance answers</p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {flagKeys.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <select
                    className="input h-8 w-28 shrink-0 text-xs"
                    value={params.get(`f.${k}`) ?? ""}
                    onChange={(e) =>
                      set({ [`f.${k}`]: e.target.value || null, page: null })
                    }
                  >
                    <option value="">Any</option>
                    {YESNO.map((v) => (
                      <option key={v} value={v}>
                        {v === "NA" ? "N/A" : v[0] + v.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                  <span className="text-muted">{FLAGS[k]}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 lg:col-span-3">
            <Check
              label="Has a contract address"
              checked={params.get("hasContract") === "1"}
              onChange={(c) => set({ hasContract: c ? "1" : null, page: null })}
            />
            <Check
              label="Needs review"
              checked={params.get("review") === "1"}
              onChange={(c) => set({ review: c ? "1" : null, page: null })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FacetGroup({
  label,
  items,
  on,
  toggle,
}: {
  label: string;
  items: Facet[];
  on: (v: string) => boolean;
  toggle: (v: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted">{label}</p>
      <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
        {items.map((i) => (
          <button
            key={i.value}
            onClick={() => toggle(i.value)}
            className={`chip transition-colors ${
              on(i.value)
                ? "border-accent bg-accent-soft text-accent"
                : "hover:bg-surface"
            }`}
          >
            {i.value}
            <span className="opacity-60">{i.n}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="size-4 rounded accent-[var(--accent)]"
      />
      {label}
    </label>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import MediaModal, { type MediaAsset } from "@/components/MediaModal";
import MediaUpload from "@/components/MediaUpload";
import AttachToRecord from "@/components/AttachToRecord";

type BrowserAsset = MediaAsset & {
  folder: string | null;
  attachedTo: { id: string; name: string; sheet: string }[];
};

const FILTERS = [
  ["", "All"],
  ["attached", "Attached"],
  ["unattached", "Unattached"],
] as const;

export default function MediaBrowser({
  assets,
  totals,
  canEdit,
}: {
  assets: BrowserAsset[];
  totals: { images: number; videos: number };
  canEdit: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [open, setOpen] = useState<number | null>(null);
  const [q, setQ] = useState(params.get("q") ?? "");

  useEffect(() => {
    const id = setTimeout(() => {
      if ((params.get("q") ?? "") === q) return;
      const next = new URLSearchParams(params.toString());
      if (q) next.set("q", q);
      else next.delete("q");
      router.push(`${pathname}?${next}`, { scroll: false });
    }, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function setShow(v: string) {
    const next = new URLSearchParams(params.toString());
    if (v) next.set("show", v);
    else next.delete("show");
    router.push(`${pathname}?${next}`, { scroll: false });
  }

  const show = params.get("show") ?? "";
  const groups = new Map<string, BrowserAsset[]>();
  for (const a of assets) {
    const k = a.folder ?? "Assets";
    groups.set(k, [...(groups.get(k) ?? []), a]);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Media</h1>
          <p className="text-sm text-muted">
            {totals.images} images · {totals.videos} videos
          </p>
        </div>
        {canEdit && <MediaUpload />}
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <input
          className="input min-w-56 flex-1"
          placeholder="Search media…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex gap-1">
          {FILTERS.map(([v, label]) => (
            <button
              key={v}
              onClick={() => setShow(v)}
              className={`rounded-xl px-2.5 py-1.5 text-sm transition-colors ${
                show === v
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-muted">{assets.length} files</span>
      </div>

      {!assets.length && (
        <div className="card p-10 text-center text-muted">No media matches.</div>
      )}

      {[...groups].map(([folder, items]) => (
        <section key={folder} className="space-y-2">
          <h2 className="text-sm font-medium text-muted">
            {folder === "Assets" ? "Assets" : folder.replace(/_/g, " ")}{" "}
            <span className="opacity-60">({items.length})</span>
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {items.map((a) => (
              <div key={a.id} className="card overflow-hidden">
                <button
                  onClick={() => setOpen(assets.indexOf(a))}
                  className="relative block aspect-square w-full bg-surface-2 transition-opacity hover:opacity-85"
                  aria-label={`Open ${a.label}`}
                >
                  {a.thumbPath || a.kind === "IMAGE" ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={a.thumbPath ?? a.path}
                      alt={a.label}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <span className="flex size-full items-center justify-center text-2xl text-muted">
                      ▶
                    </span>
                  )}
                  {a.kind === "VIDEO" && (
                    <span className="absolute bottom-1 right-1 rounded-md bg-black/55 px-1.5 text-[10px] leading-4 text-white">
                      video
                    </span>
                  )}
                  {a.missing && (
                    <span className="absolute left-1 top-1 rounded-md bg-bad px-1.5 text-[10px] leading-4 text-white">
                      missing
                    </span>
                  )}
                </button>

                <div className="space-y-1.5 p-2">
                  <p className="truncate text-xs font-medium" title={a.label}>
                    {a.label}
                  </p>
                  {a.attachedTo.length ? (
                    <div className="flex flex-wrap gap-1">
                      {a.attachedTo.slice(0, 3).map((r) => (
                        <Link
                          key={r.id + r.sheet}
                          href={`/r/${r.id}`}
                          className="chip max-w-full truncate hover:text-accent"
                          title={r.name}
                        >
                          {r.name}
                        </Link>
                      ))}
                      {a.attachedTo.length > 3 && (
                        <span className="chip">+{a.attachedTo.length - 3}</span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted">Unattached</p>
                  )}
                  {canEdit && <AttachToRecord assetId={a.id} />}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {open !== null && (
        <MediaModal assets={assets} index={open} onClose={() => setOpen(null)} />
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import MediaModal, { type MediaAsset } from "@/components/MediaModal";
import MediaUpload from "@/components/MediaUpload";

export default function MediaGallery({
  assets,
  artefactId,
  canEdit,
}: {
  assets: MediaAsset[];
  artefactId: string;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function detach(assetId: string) {
    if (!confirm("Remove this media from the record?\n\nThe file itself is kept.")) return;
    setBusy(true);
    await fetch(`/api/records/${artefactId}/assets`, {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    setBusy(false);
    router.refresh();
  }

  if (!assets.length && !canEdit) return null;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-medium">
          Media{assets.length ? ` (${assets.length})` : ""}
        </h2>
        {canEdit && (
          <div className="ml-auto">
            <MediaUpload artefactId={artefactId} />
          </div>
        )}
      </div>

      {assets.length ? (
        <div className="flex flex-wrap gap-3">
          {assets.map((a, i) => (
            <figure key={a.id} className="group relative">
              <button
                onClick={() => setOpen(i)}
                className="block size-32 overflow-hidden rounded-xl border bg-surface-2 transition-opacity hover:opacity-85"
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
              </button>

              {a.kind === "VIDEO" && (
                <span className="pointer-events-none absolute bottom-1 right-1 rounded-md bg-black/55 px-1.5 text-[10px] leading-4 text-white">
                  video
                </span>
              )}
              {a.missing && (
                <span className="pointer-events-none absolute left-1 top-1 rounded-md bg-bad px-1.5 text-[10px] leading-4 text-white">
                  missing
                </span>
              )}
              {canEdit && (
                <button
                  onClick={() => detach(a.id)}
                  disabled={busy}
                  className="absolute -right-1.5 -top-1.5 hidden size-6 items-center justify-center rounded-full border bg-surface text-xs text-muted shadow-sm hover:text-bad group-hover:flex"
                  title="Remove from this record"
                >
                  ✕
                </button>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">
          No media attached.{" "}
          {canEdit && "Upload a file, or attach one from the media page."}
        </p>
      )}

      {open !== null && (
        <MediaModal assets={assets} index={open} onClose={() => setOpen(null)} />
      )}
    </section>
  );
}

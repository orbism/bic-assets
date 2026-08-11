"use client";

import { useState } from "react";
import MediaModal, { type MediaAsset } from "@/components/MediaModal";

/** A row thumbnail. Opens the modal on the asset clicked, with the record's
 *  other assets reachable from there. */
export default function MediaThumb({
  assets,
  size = 40,
}: {
  assets: MediaAsset[];
  size?: number;
}) {
  const [open, setOpen] = useState<number | null>(null);
  const first = assets[0];

  if (!first) {
    return (
      <div
        className="shrink-0 rounded-lg border border-dashed opacity-40"
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  const src = first.thumbPath ?? (first.kind === "IMAGE" ? first.path : null);

  return (
    <>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(0);
        }}
        className="relative shrink-0 overflow-hidden rounded-lg border bg-surface-2 transition-opacity hover:opacity-80"
        style={{ width: size, height: size }}
        title={`${first.label}${assets.length > 1 ? ` (+${assets.length - 1} more)` : ""}`}
        aria-label={`Open ${first.label}`}
      >
        {src ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={src}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full items-center justify-center text-xs text-muted">
            ▶
          </span>
        )}

        {first.kind === "VIDEO" && (
          <span className="absolute bottom-0 right-0 rounded-tl-md bg-black/55 px-1 text-[9px] leading-4 text-white">
            ▶
          </span>
        )}
        {assets.length > 1 && (
          <span className="absolute left-0 top-0 rounded-br-md bg-black/55 px-1 text-[9px] leading-4 text-white">
            {assets.length}
          </span>
        )}
      </button>

      {open !== null && (
        <MediaModal assets={assets} index={open} onClose={() => setOpen(null)} />
      )}
    </>
  );
}

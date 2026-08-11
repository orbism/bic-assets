"use client";

import { useCallback, useEffect, useState } from "react";

export type MediaAsset = {
  id: string;
  path: string;
  thumbPath: string | null;
  kind: "IMAGE" | "VIDEO";
  label: string;
  bytes: number | null;
  missing?: boolean;
};

const fileName = (p: string) => decodeURIComponent(p.split("/").pop() ?? "file");

const prettyBytes = (n: number | null) => {
  if (!n) return null;
  const units = ["B", "KB", "MB", "GB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
};

export default function MediaModal({
  assets,
  index,
  onClose,
}: {
  assets: MediaAsset[];
  index: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const asset = assets[i];

  const next = useCallback(
    (d: number) => setI((v) => (v + d + assets.length) % assets.length),
    [assets.length],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") next(1);
      if (e.key === "ArrowLeft") next(-1);
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the dialog from scrolling.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [next, onClose]);

  if (!asset) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={asset.label}
      className="fixed inset-0 z-50 flex flex-col bg-black/45 p-4 backdrop-blur-sm sm:p-8"
      onClick={onClose}
    >
      <div
        className="card mx-auto flex max-h-full w-full max-w-4xl flex-col overflow-hidden p-0 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b px-4 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{asset.label}</p>
            <p className="truncate text-xs text-muted">
              {fileName(asset.path)}
              {prettyBytes(asset.bytes) ? ` · ${prettyBytes(asset.bytes)}` : ""}
              {assets.length > 1 ? ` · ${i + 1} of ${assets.length}` : ""}
            </p>
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <a className="btn" href={asset.path} download={fileName(asset.path)}>
              Download
            </a>
            <button className="btn w-9 justify-center px-0" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-surface-2 p-3">
          {asset.missing ? (
            <p className="p-10 text-sm text-muted">This file is no longer on disk.</p>
          ) : asset.kind === "VIDEO" ? (
            <video
              key={asset.path}
              src={asset.path}
              poster={asset.thumbPath ?? undefined}
              controls
              autoPlay
              loop
              playsInline
              className="max-h-[70vh] w-auto max-w-full rounded-xl"
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={asset.path}
              src={asset.path}
              alt={asset.label}
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain"
            />
          )}
        </div>

        {assets.length > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-2">
            <button className="btn" onClick={() => next(-1)}>
              ← Previous
            </button>
            <button className="btn" onClick={() => next(1)}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

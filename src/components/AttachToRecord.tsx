"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Hit = { id: string; name: string; sheet: string };

/** Type-ahead over records, used to attach a media file by hand. */
export default function AttachToRecord({ assetId }: { assetId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);

  const tooShort = !open || q.trim().length < 2;

  useEffect(() => {
    if (tooShort) return;
    const ctrl = new AbortController();
    const id = setTimeout(async () => {
      const res = await fetch(`/api/records/search?q=${encodeURIComponent(q)}`, {
        signal: ctrl.signal,
      }).catch(() => null);
      if (res?.ok) setHits(await res.json());
    }, 200);
    return () => {
      clearTimeout(id);
      ctrl.abort();
    };
  }, [q, tooShort]);

  const visible = tooShort ? [] : hits;

  async function attach(artefactId: string) {
    setBusy(true);
    await fetch(`/api/records/${artefactId}/assets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ assetId }),
    });
    setBusy(false);
    setOpen(false);
    setQ("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        className="text-xs text-muted hover:text-accent"
        onClick={() => setOpen(true)}
      >
        + Attach to record
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <input
        autoFocus
        className="input h-8 w-full text-xs"
        placeholder="Find a record…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      />
      {visible.length > 0 && (
        <ul className="max-h-40 overflow-y-auto rounded-xl border bg-surface text-xs">
          {visible.map((h) => (
            <li key={h.id}>
              <button
                disabled={busy}
                onClick={() => attach(h.id)}
                className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left hover:bg-surface-2"
              >
                <span className="truncate">{h.name}</span>
                <span className="ml-auto shrink-0 text-muted">
                  {h.sheet.toLowerCase().replace("_", " ")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <button className="text-xs text-muted hover:text-text" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

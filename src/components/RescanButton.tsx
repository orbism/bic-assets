"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RescanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/assets/scan", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setResult(
      res.ok
        ? `${json.assets} files, ${json.created} new, ${json.links} new links, ${json.unmatched?.length ?? 0} unattached${json.missing ? `, ${json.missing} missing` : ""}.`
        : (json.error ?? "Scan failed"),
    );
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? "Scanning…" : "Re-scan media"}
      </button>
      {result && <span className="text-sm text-muted">{result}</span>}
    </div>
  );
}

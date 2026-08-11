"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ReimportButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function run() {
    if (
      !confirm(
        "Re-run the import?\n\nRecords matched by sheet and slug will be overwritten with the CSV values. Nothing is deleted.",
      )
    )
      return;
    setBusy(true);
    setResult(null);
    const res = await fetch("/api/admin/import", { method: "POST" });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    setResult(
      res.ok
        ? `${json.created} created, ${json.updated} updated, ${json.total} total.`
        : (json.error ?? "Import failed"),
    );
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <button className="btn" onClick={run} disabled={busy}>
        {busy ? "Importing…" : "Re-run import"}
      </button>
      {result && <span className="text-sm text-muted">{result}</span>}
    </div>
  );
}

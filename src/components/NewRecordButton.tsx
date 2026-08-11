"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Sheet } from "@/generated/prisma/enums";

/** Creates a minimal record, then hands off to the full editor. */
export default function NewRecordButton({ sheet }: { sheet: Sheet }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sheet, name }),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Could not create");
      return;
    }
    const { id } = await res.json();
    router.push(`/r/${id}`);
  }

  if (!open) {
    return (
      <button className="btn btn-primary" onClick={() => setOpen(true)}>
        New record
      </button>
    );
  }

  return (
    <form onSubmit={create} className="flex items-center gap-2">
      <input
        autoFocus
        className="input"
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button className="btn btn-primary" disabled={busy || !name.trim()}>
        {busy ? "Creating…" : "Create"}
      </button>
      <button type="button" className="btn" onClick={() => setOpen(false)}>
        Cancel
      </button>
      {error && <span className="text-sm text-bad">{error}</span>}
    </form>
  );
}

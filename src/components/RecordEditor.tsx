"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Cell } from "@/components/DataTable";
import { value, type Row } from "@/lib/value";
import type { Col } from "@/lib/sheets";

const YESNO = ["", "YES", "NO", "UNKNOWN", "NA"];

export default function RecordEditor({
  record,
  cols,
  canEdit,
}: {
  record: Row;
  cols: Col[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const get = (key: string) => {
    if (key in draft) return draft[key];
    const v = value(record, key);
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (key === "launchDate") return String(v).slice(0, 10);
    return String(v);
  };

  const editable = cols.filter((c) => c.key !== "sheetLabel");

  async function save() {
    setBusy(true);
    setError(null);

    const body: Record<string, unknown> = { detail: {}, flags: {} };
    for (const [key, v] of Object.entries(draft)) {
      if (key.startsWith("f.")) {
        if (v) (body.flags as Record<string, string>)[key.slice(2)] = v;
      } else if (key.startsWith("d.")) {
        (body.detail as Record<string, string>)[key.slice(2)] = v;
      } else {
        body[key] = v;
      }
    }
    // Flags are stored as one object, so unchanged answers must be resent.
    body.flags = {
      ...((record.flags as Record<string, string>) ?? {}),
      ...(body.flags as Record<string, string>),
    };

    const res = await fetch(`/api/records/${record.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);

    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Save failed");
      return;
    }
    setEditing(false);
    setDraft({});
    router.refresh();
  }

  async function remove() {
    if (
      !confirm(
        `Delete "${record.name}"?\n\nThe full record is written to the audit log first and can be recovered from there.`,
      )
    )
      return;
    setBusy(true);
    const res = await fetch(`/api/records/${record.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Delete failed");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight">
          {String(record.name)}
        </h1>
        <div className="ml-auto flex gap-2">
          {canEdit && !editing && (
            <button className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
          {canEdit && editing && (
            <>
              <button
                className="btn"
                onClick={() => {
                  setEditing(false);
                  setDraft({});
                  setError(null);
                }}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save"}
              </button>
            </>
          )}
          {canEdit && !editing && (
            <button className="btn text-bad" onClick={remove} disabled={busy}>
              Delete
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-xl border border-bad/40 bg-bad/5 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
        {editable.map((c) => (
          <div key={c.key} className="min-w-0">
            <dt className="mb-0.5 text-xs text-muted">{c.label}</dt>
            <dd className="text-sm">
              {editing ? (
                c.type === "flag" ? (
                  <select
                    className="input w-full"
                    value={get(c.key)}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [c.key]: e.target.value }))
                    }
                  >
                    {YESNO.map((v) => (
                      <option key={v} value={v}>
                        {v === "" ? "—" : v === "NA" ? "N/A" : v[0] + v.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                ) : c.type === "longtext" ? (
                  <textarea
                    className="input h-20 w-full py-2"
                    value={get(c.key)}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [c.key]: e.target.value }))
                    }
                  />
                ) : (
                  <input
                    className="input w-full"
                    type={c.type === "date" ? "date" : "text"}
                    value={get(c.key)}
                    placeholder={c.type === "list" ? "comma separated" : undefined}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, [c.key]: e.target.value }))
                    }
                  />
                )
              ) : (
                <Cell v={value(record, c.key)} type={c.type} />
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

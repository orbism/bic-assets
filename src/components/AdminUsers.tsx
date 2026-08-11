"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type U = {
  id: string;
  label: string | null;
  role: string;
  disabled: boolean;
  identities: { kind: string; value: string }[];
};

const ROLES = ["VIEWER", "EDITOR", "ADMIN"];

export default function AdminUsers({ users }: { users: U[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("EMAIL");
  const [value, setValue] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("VIEWER");
  const [linkTo, setLinkTo] = useState("");

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Request failed");
      return false;
    }
    router.refresh();
    return true;
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const ok = await send("/api/admin/users", "POST", {
      kind,
      value,
      password: kind === "EMAIL" ? password : undefined,
      role,
      linkTo: linkTo || undefined,
    });
    if (ok) {
      setValue("");
      setPassword("");
      setLinkTo("");
    }
  }

  return (
    <section className="card p-4">
      <h2 className="mb-1 font-medium">Users</h2>
      <p className="mb-3 text-sm text-muted">
        Access is granted here only. Add a wallet or an email, or link a second
        identity to someone who already has an account.
      </p>

      <form onSubmit={add} className="mb-4 flex flex-wrap items-center gap-2">
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="EMAIL">Email</option>
          <option value="WALLET">Wallet</option>
        </select>
        <input
          className="input min-w-64 flex-1"
          placeholder={kind === "EMAIL" ? "person@example.com" : "0x…"}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {kind === "EMAIL" && (
          <input
            className="input"
            type="password"
            placeholder="Initial password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        )}
        <select
          className="input"
          value={linkTo}
          onChange={(e) => setLinkTo(e.target.value)}
        >
          <option value="">New user</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              Link to {u.label ?? u.identities[0]?.value}
            </option>
          ))}
        </select>
        {!linkTo && (
          <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0] + r.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        )}
        <button className="btn btn-primary" disabled={busy || !value.trim()}>
          Add
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-xl border border-bad/40 bg-bad/5 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted">
              <th className="py-2 pr-3 font-medium">User</th>
              <th className="py-2 pr-3 font-medium">Identities</th>
              <th className="py-2 pr-3 font-medium">Role</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0">
                <td className="py-2 pr-3">{u.label ?? "—"}</td>
                <td className="py-2 pr-3">
                  <span className="flex flex-wrap gap-1">
                    {u.identities.map((i) => (
                      <span key={i.value} className="chip font-mono text-[11px]">
                        {i.kind === "WALLET" ? "◈" : "@"} {i.value}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="py-2 pr-3">
                  <select
                    className="input h-8"
                    value={u.role}
                    disabled={busy}
                    onChange={(e) =>
                      send("/api/admin/users", "PATCH", { id: u.id, role: e.target.value })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r[0] + r.slice(1).toLowerCase()}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2">
                  <button
                    className="btn h-8"
                    disabled={busy}
                    onClick={() =>
                      send("/api/admin/users", "PATCH", {
                        id: u.id,
                        disabled: !u.disabled,
                      })
                    }
                  >
                    {u.disabled ? "Disabled — enable" : "Active — disable"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

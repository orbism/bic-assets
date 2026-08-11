"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

type Ethereum = {
  request: (a: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"email" | "wallet" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    router.push(next);
    router.refresh();
  };

  async function signInEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    setBusy(null);
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Sign in failed");
      return;
    }
    done();
  }

  async function signInWallet() {
    const eth = (window as unknown as { ethereum?: Ethereum }).ethereum;
    if (!eth) {
      setError("No EVM wallet detected in this browser.");
      return;
    }
    setBusy("wallet");
    setError(null);
    try {
      const [address] = (await eth.request({
        method: "eth_requestAccounts",
      })) as string[];

      const { nonce } = await (await fetch("/api/auth/siwe")).json();
      const message = [
        `${location.host} wants you to sign in with your Ethereum account:`,
        address,
        "",
        "Sign in to the BIC Asset Tracker.",
        "",
        `URI: ${location.origin}`,
        "Version: 1",
        "Chain ID: 1",
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join("\n");

      const signature = (await eth.request({
        method: "personal_sign",
        params: [message, address],
      })) as string;

      const res = await fetch("/api/auth/siwe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, signature, address }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "Sign in failed");
        return;
      }
      done();
    } catch {
      setError("Wallet signature was rejected.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card space-y-4 p-5">
      <button
        className="btn btn-primary w-full justify-center"
        onClick={signInWallet}
        disabled={busy !== null}
      >
        {busy === "wallet" ? "Check your wallet…" : "Sign in with wallet"}
      </button>

      <div className="flex items-center gap-3 text-xs text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={signInEmail} className="space-y-2">
        <input
          className="input w-full"
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="input w-full"
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn w-full justify-center" disabled={busy !== null}>
          {busy === "email" ? "Signing in…" : "Sign in with email"}
        </button>
      </form>

      {error && (
        <p className="rounded-xl border border-bad/40 bg-bad/5 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between pt-1 text-xs text-muted">
        <span>Access is granted by an admin.</span>
        <ThemeToggle />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { SHEETS } from "@/lib/sheets";
import type { Session } from "@/lib/session";

export default function Nav({ session }: { session: Session | null }) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/", label: "Master" },
    ...SHEETS.map((s) => ({ href: `/s/${s.slug}`, label: s.title })),
    { href: "/media", label: "Media" },
    { href: "/rules", label: "Rules" },
  ];

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-20 border-b bg-bg/85 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-2 px-4 py-2.5">
        <Link href="/" className="mr-2 font-semibold tracking-tight">
          BIC<span className="text-muted"> Asset Tracker</span>
        </Link>

        <nav className="flex flex-wrap items-center gap-1">
          {links.map((l) => {
            const active =
              l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-2.5 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted hover:bg-surface-2 hover:text-text"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {session?.role === "ADMIN" && (
            <Link
              href="/admin"
              className={`rounded-xl px-2.5 py-1.5 text-sm transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              Admin
            </Link>
          )}
          {session ? (
            <>
              <span
                className="chip max-w-44 truncate"
                title={`${session.label} · ${session.role.toLowerCase()}`}
              >
                {session.label}
              </span>
              <ThemeToggle />
              <button className="btn" onClick={logout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link className="btn" href="/login">
                Sign in
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

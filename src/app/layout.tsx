import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/session";
import { THEME_COOKIE } from "@/lib/theme";

export const metadata: Metadata = {
  title: "BIC Asset Tracker",
  description: "Records of provenance for onchain artefacts.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, jar] = await Promise.all([getSession(), cookies()]);

  // Resolved on the server so the first paint is already the right theme.
  // No cookie means no class, which lets prefers-color-scheme decide in CSS.
  const choice = jar.get(THEME_COOKIE)?.value;
  const themeClass = choice === "dark" ? "dark" : choice === "light" ? "light" : "";

  return (
    <html lang="en" className={themeClass}>
      <body className="min-h-dvh antialiased">
        <Nav session={session} />
        <main className="mx-auto max-w-[1600px] px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

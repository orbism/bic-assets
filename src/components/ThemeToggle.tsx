"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE, THEME_MAX_AGE } from "@/lib/theme";

/** The class on <html> is stamped during SSR from the cookie, so it is the
 *  source of truth; with no class set, the system preference decides. */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

function isDark() {
  const { classList } = document.documentElement;
  if (classList.contains("dark")) return true;
  if (classList.contains("light")) return false;
  return matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function ThemeToggle() {
  // Server render has no window, so it assumes light; the class on <html>
  // already paints the right colours either way.
  const dark = useSyncExternalStore(subscribe, isDark, () => false);

  const toggle = () => {
    const next = dark ? "light" : "dark";
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.classList.toggle("light", next === "light");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_MAX_AGE}; samesite=lax`;
  };

  return (
    <button
      onClick={toggle}
      className="btn w-9 justify-center px-0"
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light" : "Dark"}
    >
      {dark ? "☾" : "☀"}
    </button>
  );
}

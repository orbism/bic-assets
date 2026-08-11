import { chromium } from "playwright";

/**
 * Loads the app in a real browser and fails on any console error, warning or
 * uncaught exception. HTTP-level checks cannot see these: a page can return
 * 200 with clean HTML while React complains in the console.
 *
 * Usage: node scripts/check-console.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3100";

const PATHS = [
  "/",
  "/s/memecoins",
  "/s/nfts",
  "/s/celebrity-coins",
  "/s/collections",
  "/s/prov-fi",
  "/media",
  "/rules",
  "/login",
  "/?q=doge&chain=Solana",
];

// Noise from the dev server and the platform, not from our code.
const IGNORE = [
  /Download the React DevTools/i,
  /\[Fast Refresh\]/i,
  /Failed to load resource: the server responded with a status of 404/i,
];

const browser = await chromium.launch();
const problems = [];

for (const theme of ["dark", "light"]) {
  const context = await browser.newContext({
    colorScheme: theme === "dark" ? "dark" : "light",
  });
  await context.addCookies([
    { name: "theme", value: theme, url: BASE },
  ]);

  for (const path of PATHS) {
    const page = await context.newPage();
    const found = [];

    page.on("console", (msg) => {
      if (!["error", "warning"].includes(msg.type())) return;
      const text = msg.text();
      if (IGNORE.some((re) => re.test(text))) return;
      found.push(`${msg.type()}: ${text}`);
    });
    page.on("pageerror", (err) => found.push(`pageerror: ${err.message}`));

    const res = await page.goto(BASE + path, { waitUntil: "networkidle" });
    if (!res?.ok()) found.push(`http ${res?.status()}`);

    // Give React a beat to hydrate and surface anything it complains about.
    await page.waitForTimeout(400);
    await page.close();

    const label = `${theme.padEnd(5)} ${path}`;
    if (found.length) {
      problems.push([label, found]);
      console.log(`FAIL  ${label}`);
      for (const f of found) console.log(`        ${f}`);
    } else {
      console.log(`PASS  ${label}`);
    }
  }

  await context.close();
}

// Client-side navigation. This matters: some React warnings (a <script> inside
// a component, for one) only fire when the client processes the RSC payload,
// so a suite of full page loads will never see them.
{
  const context = await browser.newContext();
  const page = await context.newPage();
  const soft = [];
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) {
      soft.push(`${m.type()}: ${m.text()}`);
    }
  });
  page.on("pageerror", (e) => soft.push(`pageerror: ${e.message}`));

  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  // Located by href rather than by label, so renaming a nav item cannot
  // silently turn this into a no-op.
  for (const href of ["/s/nfts", "/media", "/rules", "/s/memecoins", "/"]) {
    await page.locator(`nav a[href="${href}"]`).first().click();
    await page.waitForLoadState("networkidle");
  }
  // And into a record, which swaps the whole route segment.
  await page.locator('a[href^="/r/"]').first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(400);

  if (soft.length) {
    problems.push(["client navigation", soft]);
    console.log("FAIL  client-side navigation");
    for (const f of soft) console.log(`        ${f}`);
  } else {
    console.log("PASS  client-side navigation across every page");
  }
  await context.close();
}

// Exercise the media modal, which only mounts on interaction.
const context = await browser.newContext();
const page = await context.newPage();
const modal = [];
page.on("console", (m) => {
  if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) {
    modal.push(`${m.type()}: ${m.text()}`);
  }
});
page.on("pageerror", (e) => modal.push(`pageerror: ${e.message}`));

await page.goto(BASE + "/media", { waitUntil: "networkidle" });
await page.locator('button[aria-label^="Open"]').first().click();
await page.waitForSelector('[role="dialog"]');
await page.keyboard.press("ArrowRight");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);

if (modal.length) {
  problems.push(["media modal", modal]);
  console.log("FAIL  media modal");
  for (const f of modal) console.log(`        ${f}`);
} else {
  console.log("PASS  media modal opens, navigates and closes");
}

await browser.close();

console.log(
  problems.length
    ? `\n${problems.length} page(s) with console problems`
    : "\nNo console errors or warnings",
);
process.exit(problems.length ? 1 : 0);

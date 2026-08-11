import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/lib/db";
import type { AssetKind } from "@/generated/prisma/enums";

export const ASSET_ROOT = join(process.cwd(), "public", "assets");
const PUBLIC_PREFIX = "/assets";

const IMAGE = new Set(["jpg", "jpeg", "png", "gif", "webp", "avif", "svg"]);
const VIDEO = new Set(["mp4", "webm", "mov", "m4v"]);

/** Size/thumbnail markers that make a file a variant of its neighbour rather
 *  than a separate artwork. Order matters: longest first. */
const VARIANT =
  /[-_ ]?(square)?(thumbnail|thumb)$|[-_ ]?(small medium|small|large|medium)$/i;

/** Case, punctuation and accents all vary between the sheets and the files on
 *  disk, and macOS stores filenames decomposed (NFD) while source literals are
 *  composed (NFC) - so decompose, drop the combining marks, then strip. */
export const normalise = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");

function baseName(file: string) {
  let b = file.split("/").pop()!.replace(/\.[^.]+$/, "");
  // Applied repeatedly for names like "Shark Cat Small Medium".
  for (let i = 0; i < 3; i++) b = b.replace(VARIANT, "").trim();
  return b;
}

const isThumb = (file: string) =>
  VARIANT.test(file.split("/").pop()!.replace(/\.[^.]+$/, ""));

const ext = (f: string) => f.split(".").pop()!.toLowerCase();

/**
 * Files whose names do not match any record. Each maps to the record names to
 * attach to; matching is by normalised name, so every sheet carrying that meme
 * picks it up. Hand-checked against the source sheets.
 */
export const MANUAL_MATCHES: Record<string, string[]> = {
  "Nightclub-Meme": ["Unimpressed Nightclub Girl"],
  "Stepping-vs-jumping-on-a-rake": ["Jumping on a rake"],
  "Raccoon-Pedro": [
    'Raccoon Dancing in a Circle / "Pedro Pedro Pedro" | Know Your Meme',
    "Raccoon Dancing in a Circle",
  ],
  "Coup-d’État": ["tank yoga coup (Coup D'Etat)"],
  "Its-totally-okay-to-let-your-goofy-side-shine-through": ["justin silva goofy"],
  "Its-totally-ok": ["justin silva goofy"],
  "Yes-The-Planet-Got-Destroyed": [
    "Yes, The Planet Got Destroyed - Token Collection | Highlight",
  ],
  "Horse-running-past-mountain-3-coffees-no-lunch": ["running horse"],
  "ElonRWA I drew you": ["ElonRWA", "Elon, I drew you!"],
  "OG SMINEM": ["Sminem"],
  "Sminem-Bear-Sminem": ["sminem 2, 3,"],
  "Sminem-Christ-Sminem": ["sminem 2, 3,"],
  "Sminem-Computer-Sminem": ["sminem 2, 3,"],
  "Sminem-Tank-Sminem": ["sminem 2, 3,"],
  "Me-Gusta-Good-Kitty-Cartoon": ["Me Gusta"],
  "Chiitan Coin": ["chiitan"],
  "HANBAO 1": ["Hanbao"],
  "HANBAO 2": ["Hanbao"],
  Pwease: ["Pwease OG"],
};

/** Keyed by normalised name so accents and punctuation cannot break a lookup. */
const MANUAL_BY_KEY = new Map(
  Object.entries(MANUAL_MATCHES).map(([k, v]) => [normalise(k), v]),
);

/** Files that are not artwork for any single record. */
const NEVER_MATCH = new Set(["ecosystem_videos"]);

type Group = {
  base: string;
  folder: string | null;
  primary: string;
  thumb: string | null;
  kind: AssetKind;
  bytes: number;
};

function walk(dir: string, rel = ""): string[] {
  let out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".DS_Store") continue;
    const abs = join(dir, entry);
    const r = rel ? `${rel}/${entry}` : entry;
    if (statSync(abs).isDirectory()) out = out.concat(walk(abs, r));
    else out.push(r);
  }
  return out;
}

/** Collapse the files on disk into one group per artwork. */
export function scanDisk(): Group[] {
  const files = walk(ASSET_ROOT).filter((f) => {
    const e = ext(f);
    return IMAGE.has(e) || VIDEO.has(e);
  });

  const groups = new Map<string, string[]>();
  for (const f of files) {
    const folder = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "";
    const key = `${folder}|${normalise(baseName(f))}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }

  return [...groups.values()].map((members) => {
    const videos = members.filter((m) => VIDEO.has(ext(m)));
    const images = members.filter((m) => IMAGE.has(ext(m)));
    const fulls = members.filter((m) => !isThumb(m));

    // A video is always the primary; otherwise the largest non-thumb image.
    const primary =
      videos[0] ??
      fulls.sort((a, b) => size(b) - size(a))[0] ??
      images.sort((a, b) => size(b) - size(a))[0];

    const thumb =
      images.filter((m) => m !== primary).sort((a, b) => size(a) - size(b))[0] ??
      null;

    const first = members[0];
    return {
      base: baseName(primary),
      folder: first.includes("/") ? first.slice(0, first.lastIndexOf("/")) : null,
      primary,
      thumb,
      kind: (VIDEO.has(ext(primary)) ? "VIDEO" : "IMAGE") as AssetKind,
      bytes: size(primary),
    };
  });
}

const size = (rel: string) => {
  try {
    return statSync(join(ASSET_ROOT, rel)).size;
  } catch {
    return 0;
  }
};

const publicPath = (rel: string) =>
  `${PUBLIC_PREFIX}/${rel.split("/").map(encodeURIComponent).join("/")}`;

export type ScanResult = {
  assets: number;
  created: number;
  links: number;
  unmatched: string[];
  missing: number;
};

/**
 * Re-runnable. Adds assets and AUTO links; never deletes a link, and never
 * re-creates one an admin has dismissed. Files that vanish from disk keep
 * their row and are flagged `missing` rather than being removed.
 */
export async function scanAssets(actor?: {
  userId?: string;
  label?: string;
}): Promise<ScanResult> {
  const groups = scanDisk();

  const records = await db.artefact.findMany({
    select: { id: true, name: true, slug: true, ticker: true },
  });
  // Several files are named after the ticker rather than the meme (TRCK, MOMMY),
  // so tickers are matchable too, with or without the leading $.
  const byName = new Map<string, string[]>();
  for (const r of records) {
    const keys = [normalise(r.name), normalise(r.slug)];
    if (r.ticker) keys.push(normalise(r.ticker.replace(/^\$/, "")));
    for (const key of keys) {
      if (key) byName.set(key, [...(byName.get(key) ?? []), r.id]);
    }
  }

  let created = 0;
  let links = 0;
  const unmatched: string[] = [];
  const seen = new Set<string>();

  for (const g of groups) {
    const path = publicPath(g.primary);
    seen.add(path);

    const data = {
      kind: g.kind,
      source: "LOCAL" as const,
      thumbPath: g.thumb ? publicPath(g.thumb) : null,
      label: g.base,
      folder: g.folder,
      bytes: g.bytes,
      missing: false,
    };

    const existing = await db.asset.findUnique({ where: { path }, select: { id: true } });
    const asset = await db.asset.upsert({
      where: { path },
      create: { path, ...data },
      update: data,
    });
    if (!existing) created++;

    const manual = MANUAL_BY_KEY.get(normalise(g.base));
    const targets = new Set(
      (manual
        ? manual.flatMap((n) => byName.get(normalise(n)) ?? [])
        : (g.folder && NEVER_MATCH.has(g.folder)
            ? []
            : (byName.get(normalise(g.base)) ?? []))),
    );

    if (!targets.size) {
      unmatched.push(g.primary);
      continue;
    }

    for (const artefactId of targets) {
      const link = await db.artefactAsset.findUnique({
        where: { artefactId_assetId: { artefactId, assetId: asset.id } },
      });
      if (link) continue; // respects a previous dismissal
      await db.artefactAsset.create({ data: { artefactId, assetId: asset.id } });
      links++;
    }
  }

  // Local files that disappeared: flag, never delete.
  const stale = await db.asset.findMany({
    where: { source: "LOCAL", path: { notIn: [...seen] } },
    select: { id: true },
  });
  if (stale.length) {
    await db.asset.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { missing: true },
    });
  }

  await db.auditLog.create({
    data: {
      userId: actor?.userId ?? null,
      actorLabel: actor?.label ?? "asset scan",
      action: "IMPORT",
      entity: "Asset",
      after: {
        assets: groups.length,
        created,
        links,
        unmatched: unmatched.length,
        missing: stale.length,
      },
    },
  });

  return { assets: groups.length, created, links, unmatched, missing: stale.length };
}

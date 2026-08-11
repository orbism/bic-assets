import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "csv-parse/sync";
import { db } from "@/lib/db";
import type { FlagKey } from "@/lib/sheets";
import type { Sheet, YesNo } from "@/generated/prisma/enums";

export const DATA_DIR = join(process.cwd(), "data");
const PREFIX = "BIC Records of Provenance for Onchain Artefacts - ";

// ---------- value parsing ----------

const YES = /^(y|yes|true|yep|confirmed)\b/i;
const NO = /^(n|no|false|nope)\b/i;
const UNKNOWN = /^(unknown|unsure|\?|tbd|maybe|#)\b/i;
const NOT_APPLICABLE = /^(n\/a|na|not applicable|-)$/i;

/** Free text -> enum for filtering. The raw string is always kept too. */
export function parseYesNo(raw: string): YesNo | null {
  const s = raw.trim();
  if (!s) return null;
  if (NOT_APPLICABLE.test(s)) return "NA";
  if (YES.test(s)) return "YES";
  if (NO.test(s)) return "NO";
  if (UNKNOWN.test(s)) return "UNKNOWN";
  // Prose answers carry meaning we cannot safely reduce; treat as unknown
  // for filtering while flagsRaw keeps the sentence intact.
  return "UNKNOWN";
}

export function splitList(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const MONTHS =
  "jan feb mar apr may jun jul aug sep oct nov dec".split(" ");

/** Best effort only. `launchRaw` always keeps the original string. */
export function parseDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // 20-January-2022 / 3-Nov-2021
  let m = s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/);
  if (m) {
    const mi = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    if (mi >= 0) return utc(+m[3], mi, +m[1]);
  }
  // M/D/YYYY (Google Sheets US locale export)
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return utc(+m[3], +m[1] - 1, +m[2]);
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return utc(+m[1], +m[2] - 1, +m[3]);
  return null;
}

const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d));

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64) || "row"
  );
}

const url = (s: string) => (/^https?:\/\//i.test(s.trim()) ? s.trim() : null);

// ---------- CSV access ----------

type Row = string[];

function readSheet(suffix: string): { header: Row; rows: Row[] } {
  const files = readdirSync(DATA_DIR).filter(
    (f) => f.startsWith(PREFIX + suffix) && f.endsWith(".csv"),
  );
  if (files.length !== 1) {
    throw new Error(
      `Expected exactly one CSV for "${suffix}", found ${files.length}`,
    );
  }
  const text = readFileSync(join(DATA_DIR, files[0]), "utf8");
  const all = parse(text, { relaxColumnCount: true, bom: true }) as Row[];
  return { header: all[0] ?? [], rows: all.slice(1) };
}

/** Look a cell up by its exact header text. Throws if the header moved. */
function byHeader(header: Row) {
  const idx = new Map<string, number>();
  header.forEach((h, i) => {
    const k = h.trim();
    if (k && !idx.has(k)) idx.set(k, i);
  });
  return (row: Row, name: string): string => {
    const i = idx.get(name.trim());
    if (i === undefined) throw new Error(`Missing column: "${name}"`);
    return (row[i] ?? "").trim();
  };
}

// ---------- record shape ----------

type Detail = Record<string, unknown>;

export type Rec = {
  sheet: Sheet;
  slug: string;
  name: string;
  data: Record<string, unknown>;
  flags: Partial<Record<FlagKey, YesNo>>;
  flagsRaw: Partial<Record<FlagKey, string>>;
  detail: Detail;
  detailModel: "memecoin" | "nft" | "collection" | "provfi" | null;
  sourceRow: Record<string, string>;
  sourceSheet: string;
  sourceLine: number;
  needsReview?: boolean;
};

function rawRow(header: Row, row: Row): Record<string, string> {
  const o: Record<string, string> = {};
  row.forEach((v, i) => {
    if ((v ?? "").trim()) o[header[i]?.trim() || `col${i}`] = v;
  });
  return o;
}

function collectFlags(
  get: (name: string) => string,
  map: Partial<Record<FlagKey, string>>,
) {
  const flags: Partial<Record<FlagKey, YesNo>> = {};
  const flagsRaw: Partial<Record<FlagKey, string>> = {};
  for (const [key, header] of Object.entries(map) as [FlagKey, string][]) {
    const raw = get(header);
    if (!raw) continue;
    flagsRaw[key] = raw;
    const v = parseYesNo(raw);
    if (v) flags[key] = v;
  }
  return { flags, flagsRaw };
}

// ---------- token sheets (Memecoins, Celebrity & Creator Coins) ----------

const TOKEN_FLAG_HEADERS = (physical: string, minted: string) => ({
  consent: "Was the token, or underlying token, minted with the creator's consent?  ",
  blessed: "Has the creator since blessed the token?",
  ipRights: "Does the project have IP rights?",
  intendedTraded: "Was the token intended to be traded?",
  ongoingRelationship:
    "Does the project have a continuing relationship with the creator?",
  mintedElsewhere: minted,
  physicalOrigin: physical,
  originalSource: "Is the token the original source of the content?",
  insiderTrading:
    "Is there any reason to suspect insider trading by the team, or that they unfairly coerced the creator?",
  verificationDoubts:
    "Are there any doubts about the authenticity of the creator's verification?",
  subjectCanRepresent:
    "Does the subject of the meme have the capacity to represent their own interests?",
  representedFairly: "If not, do we feel they have been represented fairly?",
});

function tokenRecords(
  sheet: Sheet,
  suffix: string,
  opts: {
    physicalHeader: string;
    mintedHeader: string;
    creatorSocialHeader: string;
    extraFlags?: Partial<Record<FlagKey, string>>;
    hasFractionalized?: boolean;
    hasKym?: boolean;
    hasDiscord?: boolean;
  },
): Rec[] {
  const { header, rows } = readSheet(suffix);
  const g = byHeader(header);
  const out: Rec[] = [];

  rows.forEach((row, i) => {
    const get = (n: string) => g(row, n);
    // Some rows carry a ticker and creator but no Name. Falling back keeps
    // them rather than silently dropping the row.
    const name = get("Name") || get("Ticker") || get("Creator Name");
    if (!name) return;
    const namedByFallback = !get("Name");

    const { flags, flagsRaw } = collectFlags(get, {
      ...TOKEN_FLAG_HEADERS(opts.physicalHeader, opts.mintedHeader),
      ...opts.extraFlags,
    });

    out.push({
      sheet,
      slug: slugify(name),
      name,
      data: {
        ticker: get("Ticker") || null,
        creatorName: get("Creator Name") || null,
        creatorSocial: get(opts.creatorSocialHeader) || null,
        category: get("category") || null,
        note: get("Note") || null,
        chains: splitList(get("Chains (, to separate chains, origin chain first)")),
        contracts: splitList(get("CA (, to separate chains, order matters)")),
        websiteUrl: url(get("Website Link")),
        xUrl: url(get("X Link")),
        tgUrl: url(get("TG Link")),
        discordUrl: opts.hasDiscord ? url(get("Discord Link")) : null,
        kymUrl: opts.hasKym ? url(get("KYM Link")) : null,
        imageUrl: url(get("Image Link (prefer IPFS)")),
        launchDate: parseDate(get("Launch date")),
        launchRaw: get("Launch date") || null,
        description: get("Description (max. 90 characters)") || null,
        tagsCategory: splitList(get("Tags (categories)")),
        tagsProvenance: splitList(get("Tags (provenance)")),
      },
      flags,
      flagsRaw,
      detailModel: "memecoin",
      detail: {
        decimals: intOrNull(get("Decimals")),
        provenanceGrade: get("Discretionary Provenance Grade") || null,
        memePopularity: get("Meme popularity") || null,
        fairLaunchScore: get("Fair launch & distribution score") || null,
        athMarketcap:
          get("ATH marketcap for an unofficial token of this subject") || null,
        overallGrade: get("Overall discretionary grade") || null,
        projectSocials: get("Project socials") || null,
        provenanceProof: get("Provenance proof") || null,
        onboardingAgents: get("Name(s) of onboarding agent(s)") || null,
        listedOnIndex: get("Listed on index?") || null,
        tokenSlug: get("ID / Slug (TOKEN)") || null,
        blockOrigin: splitList(get("Block Origin (block, separate with ,)")),
        fractionalizedOf: opts.hasFractionalized
          ? get("Is the token a fractionalized NFT? Link to NFT sheet if yes") ||
            null
          : null,
      },
      sourceRow: rawRow(header, row),
      sourceSheet: suffix,
      sourceLine: i + 2,
      needsReview: namedByFallback,
    });
  });

  return out;
}

const intOrNull = (s: string) => {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
};

// ---------- NFTs ----------

function nftRecords(): Rec[] {
  const { header, rows } = readSheet("NFTs");
  const g = byHeader(header);
  const out: Rec[] = [];

  rows.forEach((row, i) => {
    const get = (n: string) => g(row, n);
    const name = get("Meme name");
    if (!name) return;

    const { flags, flagsRaw } = collectFlags(get, {
      fullyOnchain: "Is the artwork fully onchain?",
      ipRights: "Does the creator retain IP rights?",
      mintedElsewhere:
        "Has this meme been minted in any other format not directly linked to this token?",
      physicalOrigin: "Is the origin of the meme a physical artwork?",
      originalSource: "Is the token the original source of the content?",
      verificationDoubts:
        "Are there any doubts about the authenticity of the creator's verification?",
    });

    out.push({
      sheet: "NFT",
      slug: slugify(get("ID (MEME)") || name),
      name,
      data: {
        creatorName: get("Creator Name") || null,
        creatorSocial: get("Creator social media") || null,
        creatorAddr: get("Creator address") || null,
        kymUrl: url(get("KYM")),
        marketplaceUrl: url(get("Marketplace link")),
        provenanceUrl: get("Links to support provenance") || null,
        note: get("Note") || null,
      },
      flags,
      flagsRaw,
      detailModel: "nft",
      detail: {
        tokenAddress: get("Token address") || null,
        lastSalePrice: get("Price of last sale") || null,
        lastSaleDate: get("Date of last sale") || null,
        currentOwner: get("Current owner") || null,
        currentOwnerAddr: get("Current owner address") || null,
        firstSalePrice: get("Price of first sale") || null,
        firstSaleDate: get("Date of first sale") || null,
        initialOwner: get("Initial owner") || null,
        initialOwnerAddr: get("Initial owner address") || null,
        memeId: get("ID (MEME)") || null,
      },
      sourceRow: rawRow(header, row),
      sourceSheet: "NFTs",
      sourceLine: i + 2,
    });
  });

  return out;
}

// ---------- Prov.fi ----------

function provfiRecords(): Rec[] {
  const { header, rows } = readSheet("Memes - Prov.fi");
  const g = byHeader(header);
  return rows.flatMap((row, i) => {
    const get = (n: string) => g(row, n);
    const name = get("Meme");
    if (!name) return [];
    return [
      {
        sheet: "PROVFI" as Sheet,
        slug: slugify(get("ID (MEME ID)") || name),
        name,
        data: {},
        flags: {},
        flagsRaw: {},
        detailModel: "provfi" as const,
        detail: {
          memeId: get("ID (MEME ID)") || null,
          tokenId: get("Token (TOKEN ID)") || null,
          tokenProxy: get("Token Proxy (TOKEN ID)") || null,
        },
        sourceRow: rawRow(header, row),
        sourceSheet: "Memes - Prov.fi",
        sourceLine: i + 2,
      },
    ];
  });
}

// ---------- Collections (three blocks) ----------

/**
 * Block C: ten memecoin-shaped rows whose columns are offset inconsistently
 * from the Memecoins layout. Mapped by hand from cell content and approved
 * before seeding; `sourceRow` keeps the untouched original either way.
 * Numbers are the source column index the value was taken from.
 */
const BLOCK_C: Record<
  string,
  { data?: Record<string, unknown>; detail?: Detail; note?: string }
> = {
  "Car Meme": {
    data: {
      ticker: "$CAR",
      creatorName: "President of the Central African Republic.",
      creatorSocial: "https://x.com/FA_Touadera",
      chains: ["Solana"],
      contracts: ["7oBYdEhV4GkXC19ZfgAvXpJWp2Rn9pm1Bx2cVNxFpump"],
      xUrl: "https://x.com/CARMemecoinNews",
      launchRaw: "2/9/2025",
      launchDate: utc(2025, 1, 9),
      category: "Politics",
      note: "The first Official Government Meme Coin ever created. This account suspended for now but: https://x.com/CARMeme_News",
      description:
        "$CAR is an experiment designed to show how something as simple as a meme can unite people, support national development, and put the Central African Republic on the world stage in a unique way.",
      tagsCategory: ["POLITICS"],
      tagsProvenance: ["POLITICS"],
    },
    detail: { projectSocials: "https://x.com/CARMemecoinNews" },
  },
  "Jupiter's Wen": {
    data: {
      ticker: "$WEN",
      chains: ["Solana"],
      contracts: ["WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk"],
      xUrl: "https://x.com/wenwencoin",
      websiteUrl: "https://www.wenwencoin.com/",
      tgUrl: "https://t.me/wenwencoinsol",
      tagsProvenance: ["IP"],
    },
    detail: { projectSocials: "https://x.com/wenwencoin", tokenSlug: "wen-wen" },
  },
  Catsumi: {
    data: {
      ticker: "$SUMI",
      creatorName: "Moriko",
      chains: ["Base"],
      contracts: ["0xe8aAe6251c6Cf39927b0ff31399030C60BEC798f"],
      xUrl: "https://x.com/CatsumiCoin",
      websiteUrl: "https://sumicoin.io/",
      tgUrl: "https://t.me/catsumicoin",
      tagsProvenance: ["IP"],
    },
    detail: { projectSocials: "https://x.com/CatsumiCoin", tokenSlug: "catsumi" },
  },
  Floppa: {
    data: {
      ticker: "$FLOPPA",
      creatorName: "Andrei Bondarev",
      creatorSocial: "#",
      chains: ["Base", "Solana"],
      contracts: [
        "0x776aaef8d8760129a0398cf8674ee28cefc0eab9",
        "F6Aj973E5vGHyGnVsKC39rAFwnFukF11JmpPQ7xPUFF8",
      ],
      xUrl: "https://x.com/floppa",
      launchRaw: "3/30/2024",
      launchDate: utc(2024, 2, 30),
      category: "Meme",
      websiteUrl: "https://floppa.wtf/",
      tgUrl: "https://t.me/floppacatbase",
      imageUrl:
        "https://i.kym-cdn.com/photos/images/original/002/028/716/ef3.jpg",
      description: "Memecoin of the Big Floppa backed by the cat's owner.",
      tagsProvenance: ["CAT"],
      note: "questionable if has provenance\n\nWhile the meme is originally of a specific cat, it seems it became popular in part from meme pages of another cat of the same species. this token is backe dby two of the largest meme pages, but i cannot tell if they have anything to do with the original owner. https://www.instagram.com/p/C6hAC0CMb_l",
    },
    detail: {
      tokenSlug: "floppa",
      provenanceProof:
        "https://x.com/caracalpumba/status/1821557184305770612",
    },
  },
  "Genius Pepe": {
    data: {
      ticker: "$GENIUS",
      creatorName: "Matt Furie",
      creatorSocial: "https://x.com/Matt_Furie",
      chains: ["Ethereum"],
      contracts: ["0x362bf4c20952d9eb06cf473bfc3ca79592c831b0"],
      category: "Meme",
      websiteUrl: "https://www.dankbank.co/meme/Genius-Pepe",
    },
    detail: { provenanceProof: "Fractionalized via DankBank" },
  },
  "Feels Pepe": {
    data: {
      ticker: "$FEELSPEPE",
      creatorName: "Matt Furie",
      creatorSocial: "https://x.com/Matt_Furie",
      chains: ["Ethereum"],
      contracts: ["0x1994e631a6a718c1473d5dad575d9b0d940e2e8f"],
      category: "Meme",
      websiteUrl: "https://www.dankbank.co/meme/Feels-Pepe",
    },
    detail: { provenanceProof: "Fractionalized via DankBank" },
  },
  "Satan Pepe": {
    data: {
      ticker: "$SATAN",
      creatorName: "Matt Furie",
      creatorSocial: "https://x.com/Matt_Furie",
      chains: ["Ethereum"],
      contracts: ["0x84b26537ed37d7ee4cf9a16bf148b623cfeb7a88"],
      category: "Meme",
      websiteUrl: "https://www.dankbank.co/meme/Satan-Pepe",
    },
    detail: { provenanceProof: "Fractionalized via DankBank" },
  },
  Tang: {
    data: {
      ticker: "$TANG",
      creatorName: "evil_tangyuan412",
      creatorSocial: "https://www.instagram.com/evil_tangyuan412/",
      chains: ["Base"],
      // Verbatim from source: begins with the letter "O", not "0x". Not corrected.
      contracts: ["Oxcc3aba72bb8d3e38745b4fb9941141a85b3b1fd8"],
      xUrl: "https://x.com/basetangyuancat",
      category: "Meme",
      websiteUrl: "https://basedtangcat.com/",
      tgUrl: "https://t.me/basedtangcat",
      imageUrl:
        "https://basedtangcat.com/assets/images/image01.png?v=8158e222",
      description: "Memecoin of the famous cat with a deformed paw",
      note: "has only contacted owner, no endorsement",
    },
    detail: { provenanceGrade: "F", tokenSlug: "tang" },
    note: "Contract address starts with the letter O rather than 0x in the source sheet.",
  },
  "Dank Pepe": {
    data: {
      ticker: "$DANKPEPE",
      creatorName: "Shawn Leary",
      creatorSocial: "https://x.com/shawnleary",
      chains: ["Ethereum"],
      contracts: ["0x8a06dbbb2e58310b0bb988f2250b2f1fadaa9f87"],
      category: "Meme",
      websiteUrl: "https://www.dankbank.co/meme/DANKPEPE",
      note: "This refers to the counterparty asset.",
    },
    detail: { provenanceProof: "Fractionalized via DankBank" },
  },
  Points: {
    data: {
      ticker: "$POINTS",
      creatorName: "Matthias",
      creatorSocial: "https://x.com/iamMatthias",
      chains: [],
      contracts: ["0xd7C1EB0fe4A30d3B2a846C04aa6300888f087A5F"],
      launchRaw: "12/12/2023",
      launchDate: utc(2023, 11, 12),
      category: "Meme",
    },
    detail: {
      projectSocials: "https://x.com/PointsMemeCoin",
      provenanceProof:
        "https://x.com/jcmeowjc/status/1737319731609444829",
    },
    note: "No chain listed in the source sheet.",
  },
};

function collectionRecords(): Rec[] {
  const suffix = "Collections and Other Notable Culture";
  const { header, rows } = readSheet(suffix);
  const out: Rec[] = [];

  rows.forEach((row, i) => {
    const cell = (n: number) => (row[n] ?? "").trim();
    const name = cell(0);
    if (!name) return;
    const src = rawRow(header, row);
    const line = i + 2;

    // Block C: memecoin-shaped rows, hand-mapped above.
    const mapped = BLOCK_C[name];
    if (mapped) {
      out.push({
        sheet: "MEMECOIN",
        slug: slugify(name),
        name,
        data: { ...mapped.data, ...(mapped.note ? {} : {}) },
        flags: {},
        flagsRaw: {},
        detailModel: "memecoin",
        detail: mapped.detail ?? {},
        sourceRow: src,
        sourceSheet: suffix,
        sourceLine: line,
        needsReview: Boolean(mapped.note),
      });
      return;
    }

    // Block B: celebrity NFT projects. Detected by the literal marker in the
    // sheet rather than by row position.
    if (cell(7).toLowerCase() === "celebrity") {
      out.push({
        sheet: "COLLECTION",
        slug: slugify(name),
        name,
        data: {
          rowType: "Celebrity NFT project",
          category: "celebrity",
          creatorAddr: cell(3) || null,
          xUrl: url(cell(4)),
          launchDate: parseDate(cell(5)),
          launchRaw: cell(5) || null,
          contracts: cell(3) ? [cell(3)] : [],
        },
        flags: {},
        flagsRaw: {},
        detailModel: "collection",
        detail: {
          projectName: cell(2) || null,
          subjectXUrl: url(cell(1)),
        },
        sourceRow: src,
        sourceSheet: suffix,
        sourceLine: line,
      });
      return;
    }

    // Block A: the sheet's stated header shape.
    out.push({
      sheet: "COLLECTION",
      slug: slugify(name),
      name,
      data: {
        rowType: "Collection",
        creatorSocial: cell(2) || null,
        creatorAddr: cell(3) || null,
        explorerUrl: url(cell(4)),
        marketplaceUrl: cell(5) || null,
      },
      flags: {},
      flagsRaw: {},
      detailModel: "collection",
      detail: {
        derivativeOf: cell(1) || null,
        provenanceLinks: cell(6) || null,
      },
      sourceRow: src,
      sourceSheet: suffix,
      sourceLine: line,
    });
  });

  return out;
}

// ---------- assemble + write ----------

export function buildRecords(): Rec[] {
  const recs = [
    ...tokenRecords("MEMECOIN", "Memecoins", {
      physicalHeader: "Is the origin of the meme a physical piece of art?",
      mintedHeader:
        "Has this meme been minted more than once, or in any other format not directly linked to this token?",
      creatorSocialHeader: "Creator social media",
      extraFlags: {
        fractionalizePermission:
          "Did the creator give permission to fractionalize the NFT?",
      },
      hasFractionalized: true,
      hasKym: true,
      hasDiscord: true,
    }),
    ...tokenRecords("CELEBRITY_COIN", "Celebrity and Creator Coins", {
      physicalHeader: "Is the origin of the meme a physical artwork?",
      mintedHeader:
        "Has this meme been minted in any other format not directly linked to this token?",
      creatorSocialHeader: "Creator social media (# if unknown)",
      hasDiscord: true,
    }),
    ...nftRecords(),
    ...collectionRecords(),
    ...provfiRecords(),
  ];

  // Disambiguate slug collisions within a sheet, keeping first-seen order.
  const seen = new Map<string, number>();
  for (const r of recs) {
    const k = `${r.sheet}/${r.slug}`;
    const n = seen.get(k) ?? 0;
    seen.set(k, n + 1);
    if (n > 0) r.slug = `${r.slug}-${n + 1}`;
  }

  return recs;
}

const DETAIL_MODEL = {
  memecoin: "memecoinDetail",
  nft: "nftDetail",
  collection: "collectionDetail",
  provfi: "provfiDetail",
} as const;

export type ImportResult = { created: number; updated: number; total: number };

/**
 * Upsert every record. Never deletes: rows removed from a CSV stay in the DB.
 */
export async function runImport(actor?: {
  userId?: string;
  label?: string;
}): Promise<ImportResult> {
  const recs = buildRecords();
  let created = 0;
  let updated = 0;

  for (const r of recs) {
    const base = {
      name: r.name,
      flags: r.flags,
      flagsRaw: r.flagsRaw,
      sourceRow: r.sourceRow,
      sourceSheet: r.sourceSheet,
      sourceLine: r.sourceLine,
      needsReview: r.needsReview ?? false,
      ...r.data,
    };

    const existing = await db.artefact.findUnique({
      where: { sheet_slug: { sheet: r.sheet, slug: r.slug } },
      select: { id: true },
    });

    const artefact = await db.artefact.upsert({
      where: { sheet_slug: { sheet: r.sheet, slug: r.slug } },
      create: { sheet: r.sheet, slug: r.slug, ...base },
      update: base,
    });

    if (r.detailModel) {
      const model = db[DETAIL_MODEL[r.detailModel]] as {
        upsert: (a: unknown) => Promise<unknown>;
      };
      await model.upsert({
        where: { artefactId: artefact.id },
        create: { artefactId: artefact.id, ...r.detail },
        update: r.detail,
      });
    }

    if (existing) updated++;
    else created++;
  }

  await db.auditLog.create({
    data: {
      userId: actor?.userId ?? null,
      actorLabel: actor?.label ?? "import script",
      action: "IMPORT",
      entity: "Artefact",
      after: { created, updated, total: recs.length },
    },
  });

  return { created, updated, total: recs.length };
}

import { FLAGS, type FlagKey } from "@/lib/sheets";
import type { Sheet, YesNo } from "@/generated/prisma/enums";

export const DETAIL_RELATION: Record<Sheet, "memecoin" | "nft" | "collection" | "provfi"> = {
  MEMECOIN: "memecoin",
  CELEBRITY_COIN: "memecoin",
  NFT: "nft",
  COLLECTION: "collection",
  PROVFI: "provfi",
};

/** Artefact scalar fields a user may edit. Everything else (ids, source row,
 *  timestamps) is off limits so imported provenance cannot be overwritten. */
const ARTEFACT_FIELDS = {
  name: "string",
  rowType: "string",
  ticker: "string",
  creatorName: "string",
  creatorSocial: "string",
  creatorAddr: "string",
  category: "string",
  note: "string",
  chains: "list",
  contracts: "list",
  websiteUrl: "string",
  xUrl: "string",
  tgUrl: "string",
  discordUrl: "string",
  kymUrl: "string",
  imageUrl: "string",
  marketplaceUrl: "string",
  explorerUrl: "string",
  provenanceUrl: "string",
  launchRaw: "string",
  launchDate: "date",
  description: "string",
  tagsCategory: "list",
  tagsProvenance: "list",
  needsReview: "bool",
} as const;

const DETAIL_FIELDS: Record<string, Record<string, "string" | "list" | "int">> = {
  memecoin: {
    decimals: "int",
    provenanceGrade: "string",
    memePopularity: "string",
    fairLaunchScore: "string",
    athMarketcap: "string",
    overallGrade: "string",
    projectSocials: "string",
    provenanceProof: "string",
    onboardingAgents: "string",
    listedOnIndex: "string",
    tokenSlug: "string",
    blockOrigin: "list",
    fractionalizedOf: "string",
  },
  nft: {
    tokenAddress: "string",
    lastSalePrice: "string",
    lastSaleDate: "string",
    currentOwner: "string",
    currentOwnerAddr: "string",
    firstSalePrice: "string",
    firstSaleDate: "string",
    initialOwner: "string",
    initialOwnerAddr: "string",
    memeId: "string",
  },
  collection: {
    derivativeOf: "string",
    provenanceLinks: "string",
    projectName: "string",
    subjectXUrl: "string",
  },
  provfi: { memeId: "string", tokenId: "string", tokenProxy: "string" },
};

const VALID_YESNO = new Set(["YES", "NO", "UNKNOWN", "NA"]);

const asList = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(String).map((s) => s.trim()).filter(Boolean)
    : String(v ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

/** Whitelist the incoming payload down to fields we allow. */
export function sanitise(sheet: Sheet, body: Record<string, unknown>) {
  const data: Record<string, unknown> = {};

  for (const [key, kind] of Object.entries(ARTEFACT_FIELDS)) {
    if (!(key in body)) continue;
    const raw = body[key];
    if (kind === "list") data[key] = asList(raw);
    else if (kind === "bool") data[key] = Boolean(raw);
    else if (kind === "date") {
      const d = raw ? new Date(String(raw)) : null;
      data[key] = d && !isNaN(+d) ? d : null;
    } else data[key] = raw === "" || raw == null ? null : String(raw);
  }

  if (body.flags && typeof body.flags === "object") {
    const flags: Partial<Record<FlagKey, YesNo>> = {};
    for (const [k, v] of Object.entries(body.flags as Record<string, string>)) {
      if (k in FLAGS && VALID_YESNO.has(v)) flags[k as FlagKey] = v as YesNo;
    }
    data.flags = flags;
  }

  const relation = DETAIL_RELATION[sheet];
  const spec = DETAIL_FIELDS[relation] ?? {};
  const detail: Record<string, unknown> = {};
  const src = (body.detail ?? {}) as Record<string, unknown>;
  for (const [key, kind] of Object.entries(spec)) {
    if (!(key in src)) continue;
    const raw = src[key];
    if (kind === "list") detail[key] = asList(raw);
    else if (kind === "int") {
      const n = parseInt(String(raw), 10);
      detail[key] = Number.isFinite(n) ? n : null;
    } else detail[key] = raw === "" || raw == null ? null : String(raw);
  }

  return { data, detail };
}

import type { Sheet } from "@/generated/prisma/enums";

/** Canonical yes/no questions. Sheet CSVs word these slightly differently;
 *  the importer maps each sheet's column onto one of these keys. */
export const FLAGS = {
  consent: "Minted with the creator's consent?",
  blessed: "Creator has since blessed it?",
  ipRights: "Project/creator holds IP rights?",
  intendedTraded: "Intended to be traded?",
  ongoingRelationship: "Continuing relationship with creator?",
  mintedElsewhere: "Minted in another unlinked format?",
  physicalOrigin: "Origin is a physical artwork?",
  originalSource: "Token is the original source of the content?",
  insiderTrading: "Suspected insider trading or coercion?",
  verificationDoubts: "Doubts about creator verification?",
  subjectCanRepresent: "Subject can represent their own interests?",
  representedFairly: "If not, represented fairly?",
  fractionalizePermission: "Permission given to fractionalize?",
  fullyOnchain: "Artwork fully onchain?",
} as const;

export type FlagKey = keyof typeof FLAGS;

export type ColType =
  | "text"
  | "longtext"
  | "link"
  | "list"
  | "date"
  | "flag"
  | "grade";

export type Col = {
  /** `name` = Artefact field, `d.x` = detail field, `f.x` = flag */
  key: string;
  label: string;
  type: ColType;
  /** shown in the default table view */
  primary?: boolean;
};

export type SheetDef = {
  sheet: Sheet;
  slug: string;
  title: string;
  blurb: string;
  cols: Col[];
};

const SHARED_LINKS: Col[] = [
  { key: "websiteUrl", label: "Website", type: "link" },
  { key: "xUrl", label: "X", type: "link" },
  { key: "tgUrl", label: "Telegram", type: "link" },
  { key: "discordUrl", label: "Discord", type: "link" },
  { key: "kymUrl", label: "KYM", type: "link" },
  { key: "imageUrl", label: "Image", type: "link" },
];

const TOKEN_FLAGS: FlagKey[] = [
  "consent",
  "blessed",
  "ipRights",
  "intendedTraded",
  "ongoingRelationship",
  "mintedElsewhere",
  "physicalOrigin",
  "originalSource",
  "insiderTrading",
  "verificationDoubts",
  "subjectCanRepresent",
  "representedFairly",
];

const flagCols = (keys: FlagKey[]): Col[] =>
  keys.map((k) => ({ key: `f.${k}`, label: FLAGS[k], type: "flag" as const }));

const TOKEN_COLS: Col[] = [
  { key: "name", label: "Name", type: "text", primary: true },
  { key: "ticker", label: "Ticker", type: "text", primary: true },
  { key: "creatorName", label: "Creator", type: "text", primary: true },
  { key: "chains", label: "Chains", type: "list", primary: true },
  { key: "contracts", label: "Contract", type: "list", primary: true },
  { key: "category", label: "Category", type: "text", primary: true },
  { key: "d.overallGrade", label: "Overall grade", type: "grade", primary: true },
  { key: "d.provenanceGrade", label: "Provenance grade", type: "grade" },
  { key: "d.memePopularity", label: "Meme popularity", type: "grade" },
  { key: "d.fairLaunchScore", label: "Fair launch score", type: "grade" },
  { key: "d.athMarketcap", label: "ATH mcap (unofficial)", type: "text" },
  { key: "launchDate", label: "Launch date", type: "date" },
  { key: "creatorSocial", label: "Creator social", type: "link" },
  ...SHARED_LINKS,
  { key: "d.projectSocials", label: "Project socials", type: "link" },
  { key: "d.provenanceProof", label: "Provenance proof", type: "link" },
  { key: "d.onboardingAgents", label: "Onboarding agent(s)", type: "text" },
  { key: "d.fractionalizedOf", label: "Fractionalized NFT", type: "text" },
  { key: "d.decimals", label: "Decimals", type: "text" },
  { key: "d.tokenSlug", label: "Token slug", type: "text" },
  { key: "d.listedOnIndex", label: "Listed on index", type: "text" },
  { key: "d.blockOrigin", label: "Block origin", type: "list" },
  { key: "tagsCategory", label: "Tags (category)", type: "list" },
  { key: "tagsProvenance", label: "Tags (provenance)", type: "list" },
  { key: "description", label: "Description", type: "longtext" },
  { key: "note", label: "Note", type: "longtext" },
];

export const SHEETS: SheetDef[] = [
  {
    sheet: "MEMECOIN",
    slug: "memecoins",
    title: "Memecoins",
    blurb: "Tokens with a tangible connection to the creator of their image.",
    cols: [
      ...TOKEN_COLS.slice(0, 7),
      ...flagCols(["fractionalizePermission", ...TOKEN_FLAGS]),
      ...TOKEN_COLS.slice(7),
    ],
  },
  {
    sheet: "CELEBRITY_COIN",
    slug: "celebrity-coins",
    title: "Celebrity & Creator Coins",
    blurb: "Tokens tied to a named celebrity or creator.",
    cols: [
      ...TOKEN_COLS.slice(0, 7),
      ...flagCols(TOKEN_FLAGS),
      ...TOKEN_COLS.slice(7),
    ],
  },
  {
    sheet: "NFT",
    slug: "nfts",
    title: "NFTs",
    blurb: "Memes minted as NFTs, with sale and ownership provenance.",
    cols: [
      { key: "name", label: "Meme name", type: "text", primary: true },
      { key: "creatorName", label: "Creator", type: "text", primary: true },
      { key: "d.tokenAddress", label: "Token address", type: "link", primary: true },
      { key: "d.currentOwner", label: "Current owner", type: "text", primary: true },
      { key: "d.lastSalePrice", label: "Last sale", type: "text", primary: true },
      { key: "d.lastSaleDate", label: "Last sale date", type: "text", primary: true },
      ...flagCols([
        "fullyOnchain",
        "ipRights",
        "mintedElsewhere",
        "physicalOrigin",
        "originalSource",
        "verificationDoubts",
      ]),
      { key: "creatorSocial", label: "Creator social", type: "link" },
      { key: "creatorAddr", label: "Creator address", type: "text" },
      { key: "marketplaceUrl", label: "Marketplace", type: "link" },
      { key: "kymUrl", label: "KYM", type: "link" },
      { key: "d.currentOwnerAddr", label: "Current owner address", type: "text" },
      { key: "d.firstSalePrice", label: "First sale", type: "text" },
      { key: "d.firstSaleDate", label: "First sale date", type: "text" },
      { key: "d.initialOwner", label: "Initial owner", type: "text" },
      { key: "d.initialOwnerAddr", label: "Initial owner address", type: "text" },
      { key: "provenanceUrl", label: "Provenance links", type: "link" },
      { key: "d.memeId", label: "Meme ID", type: "text" },
      { key: "note", label: "Note", type: "longtext" },
    ],
  },
  {
    sheet: "COLLECTION",
    slug: "collections",
    title: "Collections & Other Notable Culture",
    blurb:
      "Derivative collections, celebrity NFT projects, and other culture put onchain.",
    cols: [
      { key: "name", label: "Name", type: "text", primary: true },
      { key: "rowType", label: "Type", type: "text", primary: true },
      { key: "d.derivativeOf", label: "Alternative / derivative of", type: "text", primary: true },
      { key: "d.projectName", label: "Project", type: "text", primary: true },
      { key: "creatorSocial", label: "Creator social", type: "link", primary: true },
      { key: "creatorAddr", label: "Creator address", type: "text" },
      { key: "contracts", label: "Contract", type: "list" },
      { key: "chains", label: "Chains", type: "list" },
      { key: "d.subjectXUrl", label: "Subject X", type: "link" },
      { key: "xUrl", label: "Project X", type: "link" },
      { key: "launchDate", label: "Launch date", type: "date" },
      { key: "explorerUrl", label: "Explorer", type: "link" },
      { key: "marketplaceUrl", label: "Marketplace", type: "link" },
      { key: "d.provenanceLinks", label: "Provenance links", type: "longtext" },
      { key: "category", label: "Category", type: "text" },
      { key: "note", label: "Note", type: "longtext" },
    ],
  },
  {
    sheet: "PROVFI",
    slug: "prov-fi",
    title: "Memes — Prov.fi",
    blurb: "Meme ID to token ID mapping used by Prov.fi.",
    cols: [
      { key: "name", label: "Meme", type: "text", primary: true },
      { key: "d.memeId", label: "Meme ID", type: "text", primary: true },
      { key: "d.tokenId", label: "Token ID", type: "text", primary: true },
      { key: "d.tokenProxy", label: "Token proxy", type: "text", primary: true },
    ],
  },
];

export const SHEET_BY_SLUG = new Map(SHEETS.map((s) => [s.slug, s]));
export const SHEET_BY_ENUM = new Map(SHEETS.map((s) => [s.sheet, s]));

/** Columns offered by the master tool, i.e. the ones every sheet shares. */
export const MASTER_COLS: Col[] = [
  { key: "name", label: "Name", type: "text", primary: true },
  { key: "sheet", label: "Sheet", type: "text", primary: true },
  { key: "ticker", label: "Ticker", type: "text", primary: true },
  { key: "creatorName", label: "Creator", type: "text", primary: true },
  { key: "chains", label: "Chains", type: "list", primary: true },
  { key: "contracts", label: "Contract", type: "list", primary: true },
  { key: "category", label: "Category", type: "text", primary: true },
  { key: "launchDate", label: "Launch date", type: "date" },
  { key: "creatorSocial", label: "Creator social", type: "link" },
  ...SHARED_LINKS,
  { key: "tagsCategory", label: "Tags (category)", type: "list" },
  { key: "tagsProvenance", label: "Tags (provenance)", type: "list" },
  ...flagCols(Object.keys(FLAGS) as FlagKey[]),
  { key: "description", label: "Description", type: "longtext" },
  { key: "note", label: "Note", type: "longtext" },
];

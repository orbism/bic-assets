import { db } from "@/lib/db";
import { FLAGS, type FlagKey } from "@/lib/sheets";
import { Prisma } from "@/generated/prisma/client";
import { ASSET_INCLUDE } from "@/lib/media";
import type { Sheet, YesNo } from "@/generated/prisma/enums";

export type SearchParams = Record<string, string | string[] | undefined>;

export const PAGE_SIZE = 50;

const one = (p: SearchParams, k: string) => {
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
};

const many = (p: SearchParams, k: string) => {
  const v = p[k];
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).flatMap((s) =>
    s.split(",").map((x) => x.trim()).filter(Boolean),
  );
};

/** Fields the table can sort on. Anything else is rejected. */
export const SORTABLE = new Set([
  "name",
  "ticker",
  "creatorName",
  "category",
  "launchDate",
  "sheet",
  "updatedAt",
  "createdAt",
]);

export type Filters = {
  q?: string;
  sheet?: Sheet;
  categories: string[];
  chains: string[];
  tags: string[];
  flags: Partial<Record<FlagKey, YesNo>>;
  needsReview: boolean;
  hasContract: boolean;
  sort: string;
  dir: "asc" | "desc";
  page: number;
};

export function parseFilters(p: SearchParams, sheet?: Sheet): Filters {
  const flags: Partial<Record<FlagKey, YesNo>> = {};
  for (const key of Object.keys(FLAGS) as FlagKey[]) {
    const v = one(p, `f.${key}`);
    if (v && ["YES", "NO", "UNKNOWN", "NA"].includes(v)) flags[key] = v as YesNo;
  }

  const sort = one(p, "sort") ?? "name";
  return {
    q: one(p, "q"),
    sheet: sheet ?? (one(p, "sheet") as Sheet | undefined),
    categories: many(p, "category"),
    chains: many(p, "chain"),
    tags: many(p, "tag"),
    flags,
    needsReview: one(p, "review") === "1",
    hasContract: one(p, "hasContract") === "1",
    sort: SORTABLE.has(sort) ? sort : "name",
    dir: one(p, "dir") === "desc" ? "desc" : "asc",
    page: Math.max(1, parseInt(one(p, "page") ?? "1", 10) || 1),
  };
}

export function buildWhere(f: Filters): Prisma.ArtefactWhereInput {
  const AND: Prisma.ArtefactWhereInput[] = [];

  if (f.sheet) AND.push({ sheet: f.sheet });
  if (f.needsReview) AND.push({ needsReview: true });
  if (f.hasContract) AND.push({ NOT: { contracts: { isEmpty: true } } });
  if (f.categories.length) AND.push({ category: { in: f.categories } });
  if (f.chains.length) AND.push({ chains: { hasSome: f.chains } });
  if (f.tags.length) {
    AND.push({
      OR: [
        { tagsCategory: { hasSome: f.tags } },
        { tagsProvenance: { hasSome: f.tags } },
      ],
    });
  }

  for (const [key, value] of Object.entries(f.flags)) {
    AND.push({ flags: { path: [key], equals: value } });
  }

  if (f.q) {
    const c = { contains: f.q, mode: "insensitive" as const };
    AND.push({
      OR: [
        { name: c },
        { ticker: c },
        { creatorName: c },
        { creatorSocial: c },
        { creatorAddr: c },
        { category: c },
        { description: c },
        { note: c },
        { slug: c },
        { contracts: { has: f.q } },
        { chains: { has: f.q } },
      ],
    });
  }

  return AND.length ? { AND } : {};
}

const DETAILS = {
  memecoin: true,
  nft: true,
  collection: true,
  provfi: true,
  ...ASSET_INCLUDE,
} as const;

export async function queryArtefacts(f: Filters) {
  const where = buildWhere(f);
  const [rows, total] = await Promise.all([
    db.artefact.findMany({
      where,
      include: DETAILS,
      orderBy: [{ [f.sort]: f.dir }, { id: "asc" }],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.artefact.count({ where }),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export type ArtefactRow = Awaited<ReturnType<typeof queryArtefacts>>["rows"][number];

/** Distinct values for the filter dropdowns, scoped to one sheet or all. */
export async function facets(sheet?: Sheet) {
  const scope = sheet ? Prisma.sql`WHERE sheet = ${sheet}::"Sheet"` : Prisma.empty;
  const [cats, chains, tags] = await Promise.all([
    db.artefact.groupBy({
      by: ["category"],
      where: { ...(sheet ? { sheet } : {}), NOT: { category: null } },
      _count: true,
      orderBy: { category: "asc" },
    }),
    db.$queryRaw<{ value: string; n: bigint }[]>`
      SELECT value, count(*) AS n
      FROM (SELECT unnest(chains) AS value FROM "Artefact" ${scope}) t
      GROUP BY value ORDER BY value
    `,
    db.$queryRaw<{ value: string; n: bigint }[]>`
      SELECT value, count(*) AS n
      FROM (
        SELECT unnest("tagsCategory" || "tagsProvenance") AS value
        FROM "Artefact" ${scope}
      ) t
      GROUP BY value ORDER BY value
    `,
  ]);

  return {
    categories: cats.map((c) => ({ value: c.category!, n: c._count })),
    chains: chains.map((c) => ({ value: c.value, n: Number(c.n) })),
    tags: tags.map((c) => ({ value: c.value, n: Number(c.n) })),
  };
}

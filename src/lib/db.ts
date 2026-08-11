import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const pick = (...names: string[]) => {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return { name, value };
  }
  return null;
};

/** Names that look like connection strings but must never serve traffic:
 *  the migration shadow database is empty by design, and direct/unpooled URLs
 *  bypass the pooler. Connecting to one of these silently reads the wrong
 *  database, so they are excluded rather than merely deprioritised. */
const NOT_RUNTIME = /SHADOW|DIRECT|UNPOOLED|NON_POOLING|MIGRAT/i;

/** Vercel storage integrations prefix their variables with the store name, so
 *  a Prisma Postgres store called "bicassets" produces
 *  bicassets_PRISMA_DATABASE_URL rather than DATABASE_URL. Explicit names win;
 *  a prefixed one is accepted rather than leaving the app dead on arrival. */
function connectionString() {
  const explicit = pick("DATABASE_URL", "POSTGRES_PRISMA_URL", "POSTGRES_URL");
  if (explicit) return explicit;

  const suffixed = Object.keys(process.env)
    .filter((k) => /_(PRISMA_)?(DATABASE|POSTGRES)_URL$/.test(k))
    .filter((k) => !NOT_RUNTIME.test(k))
    .sort(); // deterministic when a project has several stores attached
  return suffixed.length ? pick(...suffixed) : null;
}

function create(): PrismaClient {
  const found = connectionString();
  if (!found) {
    throw new Error(
      "No database connection string found. Set DATABASE_URL (checked also: " +
        "POSTGRES_PRISMA_URL, POSTGRES_URL, and any *_DATABASE_URL from a " +
        "Vercel storage integration). On Vercel, confirm the variable is " +
        "exposed to the environment being deployed.",
    );
  }
  const url = found.value;

  // Names the source without ever printing the credential, so a
  // wrong-database problem is one log line rather than an investigation.
  let where = "unknown host";
  try {
    where = url.startsWith("prisma+postgres://")
      ? "prisma postgres (pooled)"
      : new URL(url).host;
  } catch {}
  console.log(`[db] using ${found.name} -> ${where}`);
  // Prisma Postgres (local `prisma dev` and the hosted product) speaks the
  // prisma+postgres protocol; anything else is a plain Postgres connection.
  return url.startsWith("prisma+postgres://")
    ? new PrismaClient({ accelerateUrl: url } as never)
    : new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/**
 * Cached globally in every environment, not just development: production
 * builds split routes into separate chunks, each of which would otherwise get
 * its own client and connection pool, and enough of those make Postgres start
 * closing connections (P1017).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
const client = () => (globalForPrisma.prisma ??= create());

/**
 * Connects on first use rather than on import. `next build` imports every
 * route module to collect its config, so constructing the client at module
 * scope makes the build itself require database credentials - and fail without
 * them, even though nothing is querying anything yet.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const value = Reflect.get(client(), prop);
    return typeof value === "function" ? value.bind(client()) : value;
  },
});

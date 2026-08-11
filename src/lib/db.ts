import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/** Vercel's Postgres integrations expose different names; DATABASE_URL wins. */
function connectionString() {
  return (
    process.env.DATABASE_URL ??
    process.env.POSTGRES_PRISMA_URL ??
    process.env.POSTGRES_URL ??
    null
  );
}

function create(): PrismaClient {
  const url = connectionString();
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. On Vercel, check the variable is exposed to " +
        "the environment being deployed (Production/Preview/Development).",
    );
  }
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

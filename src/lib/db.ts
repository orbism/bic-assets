import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

/** Prisma Postgres (local `prisma dev` and the hosted product) speaks the
 *  prisma+postgres protocol; anything else is a plain Postgres connection. */
function create(): PrismaClient {
  return url!.startsWith("prisma+postgres://")
    ? new PrismaClient({ accelerateUrl: url } as never)
    : new PrismaClient({ adapter: new PrismaPg({ connectionString: url! }) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/**
 * Cached globally in every environment, not just development. Production
 * builds split routes into separate chunks, each of which would otherwise
 * construct its own client and its own connection pool - enough of them and
 * Postgres starts closing connections (P1017).
 */
export const db: PrismaClient = (globalForPrisma.prisma ??= create());

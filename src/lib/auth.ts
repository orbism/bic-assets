import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import type { IdentityKind } from "@/generated/prisma/enums";

/** ADMIN_WALLET accepts a comma-separated list; each entry is its own admin.
 *  ADMIN_EMAIL stays single, since its password comes from one variable. */
export const adminWallets = () =>
  (process.env.ADMIN_WALLET ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

/**
 * Create a bootstrap admin from the environment the first time it signs in,
 * so setting ADMIN_EMAIL / ADMIN_WALLET is enough on a fresh deploy and does
 * not also require running the seed script. Only ever matches a value present
 * in the environment, and only ever creates admins named there.
 */
async function bootstrapFromEnv(kind: IdentityKind, value: string) {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;

  const allowed =
    kind === "WALLET"
      ? adminWallets()
      : [ADMIN_EMAIL?.trim().toLowerCase()].filter(Boolean);
  if (!allowed.includes(value)) return null;

  // An email admin without a password could never sign in anyway.
  if (kind === "EMAIL" && !ADMIN_PASSWORD) return null;

  const user = await db.user.create({
    data: {
      label: value,
      role: "ADMIN",
      identities: {
        create: {
          kind,
          value,
          passwordHash:
            kind === "EMAIL" ? await hash(ADMIN_PASSWORD!, 10) : null,
        },
      },
    },
  });

  await db.auditLog.create({
    data: {
      userId: user.id,
      actorLabel: value,
      action: "USER_CHANGE",
      entity: "User",
      entityId: user.id,
      after: { bootstrappedFromEnv: true, kind, value, role: "ADMIN" },
    },
  });

  return db.identity.findUnique({
    where: { kind_value: { kind, value } },
    include: { user: true },
  });
}

/** Resolve an identity to its user. Returns null when the identity is not
 *  registered or the account is disabled - access is admin-granted only. */
export async function resolveIdentity(kind: IdentityKind, value: string) {
  const v = value.trim().toLowerCase();

  const identity =
    (await db.identity.findUnique({
      where: { kind_value: { kind, value: v } },
      include: { user: true },
    })) ?? (await bootstrapFromEnv(kind, v));

  if (!identity || identity.user.disabled) return null;
  return identity;
}

export async function recordLogin(userId: string, label: string) {
  await db.auditLog.create({
    data: { userId, actorLabel: label, action: "LOGIN", entity: "User", entityId: userId },
  });
}

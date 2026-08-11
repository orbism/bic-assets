import "dotenv/config";
import { hash } from "bcryptjs";
import { db } from "../src/lib/db";
import { runImport } from "../src/lib/import";
import type { Role } from "../src/generated/prisma/enums";

async function ensureUser(
  kind: "EMAIL" | "WALLET",
  value: string,
  role: Role,
  password?: string,
) {
  const v = value.trim().toLowerCase();
  if (!v) return;
  const existing = await db.identity.findUnique({
    where: { kind_value: { kind, value: v } },
    include: { user: true },
  });
  if (existing) {
    if (existing.user.role !== role) {
      await db.user.update({ where: { id: existing.userId }, data: { role } });
      console.log(`  updated role for ${kind} ${v} -> ${role}`);
    }
    return;
  }
  await db.user.create({
    data: {
      label: v,
      role,
      identities: {
        create: {
          kind,
          value: v,
          passwordHash: password ? await hash(password, 10) : null,
        },
      },
    },
  });
  console.log(`  created ${role} ${kind} ${v}`);
}

async function main() {
  console.log("Users:");
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_WALLET, SEED_USERS } = process.env;

  if (ADMIN_EMAIL) {
    if (!ADMIN_PASSWORD) throw new Error("ADMIN_EMAIL set without ADMIN_PASSWORD");
    await ensureUser("EMAIL", ADMIN_EMAIL, "ADMIN", ADMIN_PASSWORD);
  }
  if (ADMIN_WALLET) await ensureUser("WALLET", ADMIN_WALLET, "ADMIN");

  for (const entry of (SEED_USERS ?? "").split(",").filter(Boolean)) {
    const [kind, value, role] = entry.split(":").map((s) => s.trim());
    if (!kind || !value) continue;
    await ensureUser(
      kind.toUpperCase() === "WALLET" ? "WALLET" : "EMAIL",
      value,
      (role?.toUpperCase() as Role) || "VIEWER",
    );
  }

  console.log("Records:");
  const r = await runImport({ label: "seed script" });
  console.log(`  ${r.created} created, ${r.updated} updated, ${r.total} total`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

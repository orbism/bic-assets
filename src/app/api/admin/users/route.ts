import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { isAddress } from "viem";
import { db } from "@/lib/db";
import { AuthError, requireRole } from "@/lib/session";
import type { Role } from "@/generated/prisma/enums";

const ROLES = new Set(["ADMIN", "EDITOR", "VIEWER"]);

/** Add a user, or link an identity to an existing one. */
export async function POST(req: Request) {
  try {
    const session = await requireRole("ADMIN");
    const body = await req.json();

    const kind = body.kind === "WALLET" ? "WALLET" : "EMAIL";
    const value = String(body.value ?? "").trim().toLowerCase();
    const role = ROLES.has(body.role) ? (body.role as Role) : "VIEWER";
    const linkTo = body.linkTo ? String(body.linkTo) : null;

    if (!value) return NextResponse.json({ error: "Value required" }, { status: 400 });
    if (kind === "WALLET" && !isAddress(value)) {
      return NextResponse.json({ error: "Not a valid EVM address" }, { status: 400 });
    }
    if (kind === "EMAIL" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      return NextResponse.json({ error: "Not a valid email" }, { status: 400 });
    }
    if (kind === "EMAIL" && !body.password) {
      return NextResponse.json({ error: "Password required for email users" }, { status: 400 });
    }

    const taken = await db.identity.findUnique({ where: { kind_value: { kind, value } } });
    if (taken) {
      return NextResponse.json({ error: "Already registered" }, { status: 409 });
    }

    const passwordHash = body.password ? await hash(String(body.password), 10) : null;

    const user = linkTo
      ? await db.user.update({
          where: { id: linkTo },
          data: { identities: { create: { kind, value, passwordHash } } },
          include: { identities: true },
        })
      : await db.user.create({
          data: {
            label: String(body.label ?? "").trim() || value,
            role,
            identities: { create: { kind, value, passwordHash } },
          },
          include: { identities: true },
        });

    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "USER_CHANGE",
        entity: "User",
        entityId: user.id,
        after: { kind, value, role: user.role, linked: Boolean(linkTo) },
      },
    });

    return NextResponse.json({ id: user.id });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

/** Change a role, disable, or re-enable. Users are never hard deleted. */
export async function PATCH(req: Request) {
  try {
    const session = await requireRole("ADMIN");
    const body = await req.json();
    const id = String(body.id ?? "");

    const before = await db.user.findUnique({ where: { id }, include: { identities: true } });
    if (!before) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (id === session.userId && (body.role === "VIEWER" || body.role === "EDITOR" || body.disabled)) {
      return NextResponse.json(
        { error: "You cannot remove your own admin access" },
        { status: 400 },
      );
    }

    const data: { role?: Role; disabled?: boolean } = {};
    if (ROLES.has(body.role)) data.role = body.role as Role;
    if (typeof body.disabled === "boolean") data.disabled = body.disabled;

    const after = await db.user.update({ where: { id }, data });

    await db.auditLog.create({
      data: {
        userId: session.userId,
        actorLabel: session.label,
        action: "USER_CHANGE",
        entity: "User",
        entityId: id,
        before: { role: before.role, disabled: before.disabled },
        after: { role: after.role, disabled: after.disabled },
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    throw e;
  }
}

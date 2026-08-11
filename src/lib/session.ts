import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma/enums";

export const SESSION_COOKIE = "bic_session";
export const NONCE_COOKIE = "bic_nonce";

const secret = () => {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
};

export type Session = { userId: string; role: Role; label: string };

export async function sign(payload: Session, ttl = "7d") {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ttl)
    .sign(secret());
}

export async function verify(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: String(payload.userId),
      role: payload.role as Role,
      label: String(payload.label ?? ""),
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return token ? verify(token) : null;
}

export async function setSession(s: Session) {
  (await cookies()).set(SESSION_COOKIE, await sign(s), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, ADMIN: 2 };

export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];

/** Throws a Response-shaped error for API routes. */
export async function requireRole(min: Role): Promise<Session> {
  const s = await getSession();
  if (!s) throw new AuthError(401, "Not signed in");
  if (!atLeast(s.role, min)) throw new AuthError(403, "Insufficient permissions");
  return s;
}

export class AuthError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

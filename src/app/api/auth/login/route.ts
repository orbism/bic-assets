import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { recordLogin, resolveIdentity } from "@/lib/auth";
import { setSession } from "@/lib/session";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password required" }, { status: 400 });
  }

  const identity = await resolveIdentity("EMAIL", email);
  // Same message either way, so the response does not reveal which emails exist.
  const bad = NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  if (!identity?.passwordHash) return bad;
  if (!(await compare(password, identity.passwordHash))) return bad;

  const label = identity.user.label ?? identity.value;
  await setSession({ userId: identity.userId, role: identity.user.role, label });
  await recordLogin(identity.userId, label);
  return NextResponse.json({ ok: true });
}

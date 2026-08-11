import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { recoverMessageAddress } from "viem";
import { SignJWT, jwtVerify } from "jose";
import { recordLogin, resolveIdentity } from "@/lib/auth";
import { NONCE_COOKIE, setSession } from "@/lib/session";

const secret = () => new TextEncoder().encode(process.env.AUTH_SECRET!);

/** Issue a short-lived signed nonce. Kept in a cookie so no table is needed. */
export async function GET() {
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const token = await new SignJWT({ nonce })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("10m")
    .sign(secret());

  (await cookies()).set(NONCE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });

  return NextResponse.json({ nonce });
}

export async function POST(req: Request) {
  const { message, signature, address } = await req.json().catch(() => ({}));
  if (!message || !signature || !address) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const jar = await cookies();
  const token = jar.get(NONCE_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: "Nonce expired" }, { status: 400 });

  let nonce: string;
  try {
    nonce = String((await jwtVerify(token, secret())).payload.nonce);
  } catch {
    return NextResponse.json({ error: "Nonce expired" }, { status: 400 });
  }
  if (!message.includes(`Nonce: ${nonce}`)) {
    return NextResponse.json({ error: "Nonce mismatch" }, { status: 400 });
  }
  if (!message.toLowerCase().includes(String(address).toLowerCase())) {
    return NextResponse.json({ error: "Address mismatch" }, { status: 400 });
  }

  // EOA signature recovery. Smart-account (ERC-1271) wallets would need an
  // RPC round trip and are not supported yet.
  const recovered = await recoverMessageAddress({ message, signature }).catch(
    () => null,
  );
  if (!recovered || recovered.toLowerCase() !== String(address).toLowerCase()) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  jar.delete(NONCE_COOKIE);

  const identity = await resolveIdentity("WALLET", address);
  if (!identity) {
    return NextResponse.json(
      { error: "This wallet has not been granted access" },
      { status: 403 },
    );
  }

  const label = identity.user.label ?? identity.value;
  await setSession({ userId: identity.userId, role: identity.user.role, label });
  await recordLogin(identity.userId, label);
  return NextResponse.json({ ok: true });
}

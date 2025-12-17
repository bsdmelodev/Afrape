import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const SESSION_COOKIE = "session";
const secret = new TextEncoder().encode(env.AUTH_SECRET);

const cookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 dias
};

export async function createSessionCookie(userId: number) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const store = cookies();
  (await store).set(SESSION_COOKIE, token, cookieConfig);
}

export async function readSessionUserId() {
  const store = cookies();
  const token = (await store).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    const userId = payload.userId;
    if (typeof userId === "string") {
      const parsed = Number.parseInt(userId, 10);
      return Number.isNaN(parsed) ? null : parsed;
    }
    if (typeof userId === "number") return userId;
    return null;
  } catch (err) {
    console.error("Erro ao validar sessão", err);
    clearSessionCookie();
    return null;
  }
}

export async function clearSessionCookie() {
  const store = cookies();
  (await store).delete(SESSION_COOKIE);
}

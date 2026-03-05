import { cookies, headers } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const SESSION_COOKIE = "session";
const secret = new TextEncoder().encode(env.AUTH_SECRET);

const cookieConfig = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 7, // 7 dias
};

function parseSecureCookieOverride() {
  const raw = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (raw === "true") return true;
  if (raw === "false") return false;
  return null;
}

async function shouldUseSecureCookie() {
  if (process.env.NODE_ENV !== "production") return false;

  const secureOverride = parseSecureCookieOverride();
  if (secureOverride !== null) return secureOverride;

  const requestHeaders = await headers();
  const forwardedProto = requestHeaders.get("x-forwarded-proto");
  if (!forwardedProto) return false;

  return forwardedProto.split(",")[0]?.trim().toLowerCase() === "https";
}

export async function createSessionCookie(userId: number) {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const secure = await shouldUseSecureCookie();
  const store = cookies();
  (await store).set(SESSION_COOKIE, token, { ...cookieConfig, secure });
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
    return null;
  }
}

export async function clearSessionCookie() {
  const store = cookies();
  (await store).delete(SESSION_COOKIE);
}

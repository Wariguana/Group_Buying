import "server-only";

import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE_NAME = "group_buying_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

type SessionRole = "HQ_ADMIN" | "STORE_ADMIN";

export type SessionPayload = {
  userId: string;
  role: SessionRole;
  storeId: string | null;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET 必須至少 32 個字元。");
  }

  return new TextEncoder().encode(secret);
}

export async function createSessionToken(session: SessionPayload) {
  return new SignJWT({ role: session.role, storeId: session.storeId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSessionSecret());
}

export async function verifySessionToken(token: string | undefined) {
  if (!token) {
    return null;
  }

  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });

    const role = payload.role;
    const storeId = payload.storeId;

    if (
      typeof payload.sub !== "string" ||
      (role !== "HQ_ADMIN" && role !== "STORE_ADMIN") ||
      (storeId !== null && typeof storeId !== "string")
    ) {
      return null;
    }

    return {
      userId: payload.sub,
      role,
      storeId,
    } satisfies SessionPayload;
  } catch {
    return null;
  }
}

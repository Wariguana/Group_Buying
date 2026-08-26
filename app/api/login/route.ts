import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import {
  createSessionToken,
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
} from "@/app/lib/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "請填寫帳號與密碼。" }, { status: 400 });
  }

  const { username, password } =
    typeof body === "object" && body !== null
      ? (body as { username?: unknown; password?: unknown })
      : {};

  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username.trim() ||
    !password
  ) {
    return NextResponse.json({ message: "請填寫帳號與密碼。" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { username: username.trim() },
  });

  const passwordMatches = user
    ? await bcrypt.compare(password, user.passwordHash)
    : false;

  if (!user || !user.enabled || !passwordMatches) {
    return NextResponse.json({ message: "帳號或密碼錯誤。" }, { status: 401 });
  }

  const token = await createSessionToken({
    userId: user.id,
    role: user.role,
    storeId: user.storeId,
  });
  const response = NextResponse.json({ success: true });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

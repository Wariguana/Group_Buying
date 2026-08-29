import { NextResponse } from "next/server";

import { prisma } from "@/app/lib/prisma";
import {
  createCustomerSessionToken,
  CUSTOMER_SESSION_COOKIE_NAME,
  CUSTOMER_SESSION_MAX_AGE_SECONDS,
} from "@/app/lib/session";

export const runtime = "nodejs";

type LineVerifyResponse = {
  sub?: unknown;
  name?: unknown;
};

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "LINE 身分資料格式錯誤。" }, { status: 400 });
  }

  const idToken =
    typeof body === "object" && body !== null
      ? (body as { idToken?: unknown }).idToken
      : undefined;

  if (typeof idToken !== "string" || !idToken.trim()) {
    return NextResponse.json({ message: "無法取得 LINE 身分憑證。" }, { status: 400 });
  }

  const channelId = process.env.LINE_CHANNEL_ID;

  if (!channelId) {
    return NextResponse.json({ message: "LINE 登入尚未完成伺服器設定。" }, { status: 500 });
  }

  let lineResponse: Response;

  try {
    lineResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        id_token: idToken,
        client_id: channelId,
      }),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json({ message: "暫時無法驗證 LINE 身分，請稍後再試。" }, { status: 503 });
  }

  if (!lineResponse.ok) {
    return NextResponse.json({ message: "LINE 身分驗證失敗，請重新開啟頁面。" }, { status: 401 });
  }

  const verified = (await lineResponse.json()) as LineVerifyResponse;

  if (typeof verified.sub !== "string" || !verified.sub) {
    return NextResponse.json({ message: "LINE 未回傳可辨識的客戶資料。" }, { status: 401 });
  }

  const displayName =
    typeof verified.name === "string" && verified.name.trim()
      ? verified.name.trim()
      : null;

  const customer = await prisma.customer.upsert({
    where: { lineUserId: verified.sub },
    create: {
      lineUserId: verified.sub,
      displayName,
    },
    update: displayName ? { displayName } : {},
    select: {
      id: true,
      displayName: true,
      phone: true,
    },
  });

  const token = await createCustomerSessionToken({ customerId: customer.id });
  const response = NextResponse.json({
    customer: {
      displayName: customer.displayName,
      needsPhone: !customer.phone,
    },
  });

  response.cookies.set({
    name: CUSTOMER_SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
  });

  return response;
}

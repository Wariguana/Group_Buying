import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { expireUncollectedOrders } from "@/app/lib/expire-uncollected-orders";

export const runtime = "nodejs";

function jsonResponse(body: object, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json; charset=utf-8");

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function hasValidCronSecret(request: Request, cronSecret: string) {
  const authorization = request.headers.get("authorization");
  const expectedValue = `Bearer ${cronSecret}`;

  if (!authorization) {
    return false;
  }

  const receivedBuffer = Buffer.from(authorization, "utf8");
  const expectedBuffer = Buffer.from(expectedValue, "utf8");

  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return jsonResponse(
      { message: "伺服器尚未設定 CRON_SECRET 環境變數。" },
      { status: 503 },
    );
  }

  if (!hasValidCronSecret(request, cronSecret)) {
    return jsonResponse({ message: "未授權的排程請求。" }, { status: 401 });
  }

  const result = await expireUncollectedOrders();

  return jsonResponse({
    message: `已處理 ${result.expiredOrderCount} 筆逾期未取訂單。`,
    ...result,
  });
}

import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

type LineWebhookEvent = {
  type?: string;
  source?: {
    type?: string;
    groupId?: string;
  };
};

type LineWebhookBody = {
  events?: LineWebhookEvent[];
};

function hasValidSignature(body: string, signature: string, secret: string) {
  const expectedSignature = createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(signature, "utf8");

  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

export async function POST(request: Request) {
  const secret = process.env.LINE_MESSAGING_CHANNEL_SECRET;

  if (!secret) {
    return NextResponse.json(
      { message: "伺服器尚未設定 LINE Messaging API Channel Secret。" },
      { status: 500 }
    );
  }

  const signature = request.headers.get("x-line-signature");
  const rawBody = await request.text();

  if (!signature || !hasValidSignature(rawBody, signature, secret)) {
    return NextResponse.json({ message: "LINE webhook 簽章無效。" }, { status: 401 });
  }

  let body: LineWebhookBody;

  try {
    body = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return NextResponse.json({ message: "LINE webhook 資料格式錯誤。" }, { status: 400 });
  }

  const events = Array.isArray(body.events) ? body.events : [];
  const groupIds = events.flatMap((event) =>
    event.source?.type === "group" && event.source.groupId
      ? [event.source.groupId]
      : []
  );

  console.info("LINE webhook 已驗證", {
    eventTypes: events.map((event) => event.type ?? "unknown"),
    groupIds,
  });

  return NextResponse.json({ ok: true });
}

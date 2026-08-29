import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/app/lib/customer-auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

function isValidPhone(phone: string) {
  return /^[0-9+\-()\s]{8,20}$/.test(phone);
}

export async function PATCH(request: Request) {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return NextResponse.json({ message: "LINE 登入已失效，請重新開啟頁面。" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "手機資料格式錯誤。" }, { status: 400 });
  }

  const phone =
    typeof body === "object" && body !== null
      ? (body as { phone?: unknown }).phone
      : undefined;

  if (typeof phone !== "string" || !isValidPhone(phone.trim())) {
    return NextResponse.json({ message: "請輸入正確的聯絡電話。" }, { status: 400 });
  }

  await prisma.customer.update({
    where: { id: customer.id },
    data: { phone: phone.trim() },
  });

  return NextResponse.json({ success: true });
}

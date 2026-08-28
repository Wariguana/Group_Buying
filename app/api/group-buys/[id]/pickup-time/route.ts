import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

function getDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role !== "STORE_ADMIN" || !user.storeId) {
    return NextResponse.json(
      { message: "只有分店管理員可以調整本店取貨時間。" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const pickupStart = getDate(data.pickupStart);
  const pickupEnd = getDate(data.pickupEnd);

  if (!pickupStart || !pickupEnd || pickupEnd <= pickupStart) {
    return NextResponse.json(
      { message: "請確認取貨時間，結束時間必須晚於開始時間。" },
      { status: 400 }
    );
  }

  const groupBuyStore = await prisma.groupBuyStore.findUnique({
    where: {
      groupBuyId_storeId: {
        groupBuyId: id,
        storeId: user.storeId,
      },
    },
    select: {
      id: true,
    },
  });

  if (!groupBuyStore) {
    return NextResponse.json(
      { message: "找不到指派給本店的團購。" },
      { status: 404 }
    );
  }

  const updatedGroupBuyStore = await prisma.groupBuyStore.update({
    where: {
      id: groupBuyStore.id,
    },
    data: {
      pickupStart,
      pickupEnd,
    },
    select: {
      groupBuyId: true,
      storeId: true,
      pickupStart: true,
      pickupEnd: true,
    },
  });

  return NextResponse.json({ groupBuyStore: updatedGroupBuyStore });
}

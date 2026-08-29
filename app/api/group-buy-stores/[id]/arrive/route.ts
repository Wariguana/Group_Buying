import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  const { id } = await context.params;
  const groupBuyStore = await prisma.groupBuyStore.findUnique({
    where: { id },
    select: { id: true, storeId: true },
  });

  if (!groupBuyStore) {
    return NextResponse.json({ message: "找不到此門市團購。" }, { status: 404 });
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && user.storeId !== groupBuyStore.storeId) {
    return NextResponse.json(
      { message: "你沒有權限處理其他門市的訂單。" },
      { status: 403 }
    );
  }

  const result = await prisma.order.updateMany({
    where: { groupBuyStoreId: groupBuyStore.id, status: "ORDERED" },
    data: { status: "ARRIVED", arrivedAt: new Date() },
  });

  return NextResponse.json({
    updatedCount: result.count,
    message:
      result.count > 0
        ? `已將 ${result.count} 筆訂單標記為已到貨。`
        : "目前沒有可標記為已到貨的訂單。",
  });
}

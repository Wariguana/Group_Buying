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
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      groupBuyStore: {
        select: {
          storeId: true,
        },
      },
    },
  });

  if (!order) {
    return NextResponse.json({ message: "找不到此訂單。" }, { status: 404 });
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && user.storeId !== order.groupBuyStore.storeId) {
    return NextResponse.json(
      { message: "你沒有權限處理其他門市的訂單。" },
      { status: 403 }
    );
  }

  const result = await prisma.order.updateMany({
    where: {
      id: order.id,
      status: "ARRIVED",
    },
    data: {
      status: "PICKED_UP_PAID",
      paidAt: new Date(),
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { message: "只有已到貨的訂單可以標記為已取貨並付款。" },
      { status: 409 }
    );
  }

  return NextResponse.json({
    message: "已標記為已取貨並付款。",
  });
}

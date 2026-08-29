import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/app/lib/customer-auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: RouteContext<"/api/orders/[id]/cancel">,
) {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return NextResponse.json({ message: "請先完成 LINE 身分驗證。" }, { status: 401 });
  }

  const { id } = await context.params;
  const now = new Date();

  const result = await prisma.order.updateMany({
    where: {
      id,
      customerId: customer.id,
      status: "ORDERED",
      groupBuyStore: {
        groupBuy: {
          endAt: { gt: now },
        },
      },
    },
    data: {
      status: "CANCELED",
      canceledAt: now,
    },
  });

  if (result.count !== 1) {
    return NextResponse.json(
      { message: "此訂單目前無法取消，請重新整理訂單狀態。" },
      { status: 400 },
    );
  }

  return NextResponse.json({ success: true, canceledAt: now.toISOString() });
}

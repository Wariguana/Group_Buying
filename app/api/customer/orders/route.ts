import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/app/lib/customer-auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return NextResponse.json({ message: "請先完成 LINE 身分驗證。" }, { status: 401 });
  }

  const orders = await prisma.order.findMany({
    where: { customerId: customer.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNo: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      totalAmount: true,
      note: true,
      status: true,
      createdAt: true,
      canceledAt: true,
      groupBuyStore: {
        select: {
          pickupStart: true,
          pickupEnd: true,
          store: {
            select: {
              name: true,
              address: true,
            },
          },
          groupBuy: {
            select: {
              id: true,
              title: true,
              endAt: true,
            },
          },
        },
      },
    },
  });

  const now = new Date();

  return NextResponse.json({
    orders: orders.map((order) => ({
      id: order.id,
      orderNo: order.orderNo,
      productName: order.productName,
      unit: order.unit,
      unitPrice: order.unitPrice.toString(),
      quantity: order.quantity,
      totalAmount: order.totalAmount.toString(),
      note: order.note,
      status: order.status,
      createdAt: order.createdAt.toISOString(),
      canceledAt: order.canceledAt?.toISOString() ?? null,
      canCancel: order.status === "ORDERED" && order.groupBuyStore.groupBuy.endAt > now,
      store: order.groupBuyStore.store,
      groupBuy: {
        id: order.groupBuyStore.groupBuy.id,
        title: order.groupBuyStore.groupBuy.title,
        endAt: order.groupBuyStore.groupBuy.endAt.toISOString(),
      },
      pickupStart: order.groupBuyStore.pickupStart.toISOString(),
      pickupEnd: order.groupBuyStore.pickupEnd.toISOString(),
    })),
  });
}

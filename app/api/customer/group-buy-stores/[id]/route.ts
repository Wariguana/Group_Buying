import { NextResponse } from "next/server";

import { getCurrentCustomer } from "@/app/lib/customer-auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/customer/group-buy-stores/[id]">,
) {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return NextResponse.json({ message: "請先完成 LINE 身分驗證。" }, { status: 401 });
  }

  const { id } = await context.params;
  const groupBuyStore = await prisma.groupBuyStore.findUnique({
    where: { id },
    include: {
      groupBuy: {
        select: {
          title: true,
          content: true,
          imageUrls: true,
          productName: true,
          unit: true,
          originalPrice: true,
          groupPrice: true,
          minimumQuantity: true,
          quantityMultiple: true,
          perCustomerLimit: true,
          totalQuantityLimit: true,
          startAt: true,
          endAt: true,
          status: true,
        },
      },
      store: {
        select: {
          name: true,
          address: true,
          phone: true,
          enabled: true,
        },
      },
    },
  });

  const now = new Date();

  if (
    !groupBuyStore ||
    !groupBuyStore.store.enabled ||
    groupBuyStore.groupBuy.status !== "PUBLISHED" ||
    groupBuyStore.groupBuy.startAt > now ||
    groupBuyStore.groupBuy.endAt <= now
  ) {
    return NextResponse.json({ message: "此團購目前無法下單。" }, { status: 404 });
  }

  return NextResponse.json({
    groupBuyStore: {
      id: groupBuyStore.id,
      pickupStart: groupBuyStore.pickupStart.toISOString(),
      pickupEnd: groupBuyStore.pickupEnd.toISOString(),
      store: {
        name: groupBuyStore.store.name,
        address: groupBuyStore.store.address,
        phone: groupBuyStore.store.phone,
      },
      groupBuy: {
        title: groupBuyStore.groupBuy.title,
        content: groupBuyStore.groupBuy.content,
        imageUrls: groupBuyStore.groupBuy.imageUrls,
        productName: groupBuyStore.groupBuy.productName,
        unit: groupBuyStore.groupBuy.unit,
        originalPrice: groupBuyStore.groupBuy.originalPrice?.toString() ?? null,
        groupPrice: groupBuyStore.groupBuy.groupPrice.toString(),
        minimumQuantity: groupBuyStore.groupBuy.minimumQuantity,
        quantityMultiple: groupBuyStore.groupBuy.quantityMultiple,
        perCustomerLimit: groupBuyStore.groupBuy.perCustomerLimit,
        totalQuantityLimit: groupBuyStore.groupBuy.totalQuantityLimit,
        startAt: groupBuyStore.groupBuy.startAt.toISOString(),
        endAt: groupBuyStore.groupBuy.endAt.toISOString(),
      },
    },
  });
}

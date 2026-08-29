import { NextResponse } from "next/server";

import { Prisma } from "@/generated/prisma/client";

import { getCurrentCustomer } from "@/app/lib/customer-auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

class OrderValidationError extends Error {}

function getPositiveInteger(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0
    ? value
    : null;
}

function getOptionalNote(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const note = value.trim();
  return note && note.length <= 500 ? note : null;
}

function createOrderNo() {
  const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `GB${timestamp}${random}`;
}

export async function POST(request: Request) {
  const customer = await getCurrentCustomer();

  if (!customer) {
    return NextResponse.json({ message: "請先完成 LINE 身分驗證。" }, { status: 401 });
  }

  if (!customer.phone) {
    return NextResponse.json({ message: "請先完成聯絡電話設定。" }, { status: 400 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "訂單資料格式錯誤。" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ message: "訂單資料格式錯誤。" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;
  const groupBuyStoreId =
    typeof data.groupBuyStoreId === "string" ? data.groupBuyStoreId : null;
  const quantity = getPositiveInteger(data.quantity);
  const note = getOptionalNote(data.note);

  if (!groupBuyStoreId || !quantity) {
    return NextResponse.json({ message: "請選擇正確的訂購數量。" }, { status: 400 });
  }

  if (data.note !== undefined && data.note !== null && !note && data.note !== "") {
    return NextResponse.json({ message: "備註最多可輸入 500 個字。" }, { status: 400 });
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const order = await prisma.$transaction(
        async (transaction) => {
          const groupBuyStore = await transaction.groupBuyStore.findUnique({
            where: { id: groupBuyStoreId },
            include: {
              store: {
                select: { enabled: true },
              },
              groupBuy: {
                select: {
                  id: true,
                  status: true,
                  startAt: true,
                  endAt: true,
                  productName: true,
                  unit: true,
                  groupPrice: true,
                  minimumQuantity: true,
                  quantityMultiple: true,
                  perCustomerLimit: true,
                  totalQuantityLimit: true,
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
            throw new OrderValidationError("此團購目前無法下單。");
          }

          if (quantity < groupBuyStore.groupBuy.minimumQuantity) {
            throw new OrderValidationError(
              `此商品最低訂購量為 ${groupBuyStore.groupBuy.minimumQuantity}。`,
            );
          }

          if (quantity % groupBuyStore.groupBuy.quantityMultiple !== 0) {
            throw new OrderValidationError(
              `此商品訂購數量必須為 ${groupBuyStore.groupBuy.quantityMultiple} 的倍數。`,
            );
          }

          const activeOrderFilter = {
            status: { not: "CANCELED" as const },
            groupBuyStore: { groupBuyId: groupBuyStore.groupBuy.id },
          };

          const [customerOrderTotal, groupBuyOrderTotal] = await Promise.all([
            transaction.order.aggregate({
              where: {
                ...activeOrderFilter,
                customerId: customer.id,
              },
              _sum: { quantity: true },
            }),
            transaction.order.aggregate({
              where: activeOrderFilter,
              _sum: { quantity: true },
            }),
          ]);

          const customerOrderedQuantity = customerOrderTotal._sum.quantity ?? 0;
          const groupBuyOrderedQuantity = groupBuyOrderTotal._sum.quantity ?? 0;

          if (
            groupBuyStore.groupBuy.perCustomerLimit !== null &&
            customerOrderedQuantity + quantity > groupBuyStore.groupBuy.perCustomerLimit
          ) {
            throw new OrderValidationError(
              `此商品每人限購 ${groupBuyStore.groupBuy.perCustomerLimit}，你目前已訂購 ${customerOrderedQuantity}。`,
            );
          }

          if (
            groupBuyStore.groupBuy.totalQuantityLimit !== null &&
            groupBuyOrderedQuantity + quantity > groupBuyStore.groupBuy.totalQuantityLimit
          ) {
            throw new OrderValidationError("此團購剩餘數量不足。");
          }

          return transaction.order.create({
            data: {
              orderNo: createOrderNo(),
              customerId: customer.id,
              groupBuyStoreId: groupBuyStore.id,
              productName: groupBuyStore.groupBuy.productName,
              unit: groupBuyStore.groupBuy.unit,
              unitPrice: groupBuyStore.groupBuy.groupPrice,
              quantity,
              totalAmount: groupBuyStore.groupBuy.groupPrice.mul(quantity),
              note,
            },
            select: {
              orderNo: true,
              productName: true,
              quantity: true,
              totalAmount: true,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );

      return NextResponse.json(
        {
          order: {
            ...order,
            totalAmount: order.totalAmount.toString(),
          },
        },
        { status: 201 },
      );
    } catch (error) {
      if (error instanceof OrderValidationError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < 2
      ) {
        continue;
      }

      return NextResponse.json({ message: "建立訂單失敗，請稍後再試。" }, { status: 500 });
    }
  }

  return NextResponse.json({ message: "建立訂單失敗，請稍後再試。" }, { status: 500 });
}

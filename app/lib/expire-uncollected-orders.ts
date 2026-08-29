import "server-only";

import { prisma } from "@/app/lib/prisma";

/**
 * 將取貨結束時間已過、但尚未完成取貨付款的訂單標記為逾期未取。
 * 可安全重複執行：只會更新 ORDERED 與 ARRIVED 狀態。
 */
export async function expireUncollectedOrders(now = new Date()) {
  const result = await prisma.order.updateMany({
    where: {
      status: {
        in: ["ORDERED", "ARRIVED"],
      },
      groupBuyStore: {
        pickupEnd: {
          lt: now,
        },
      },
    },
    data: {
      status: "EXPIRED_UNCOLLECTED",
      expiredAt: now,
    },
  });

  return {
    expiredOrderCount: result.count,
    executedAt: now,
  };
}

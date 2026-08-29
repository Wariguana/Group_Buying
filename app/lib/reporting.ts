import { Prisma } from "@/generated/prisma/client";

type ReportUser = {
  role: "HQ_ADMIN" | "STORE_ADMIN";
  storeId: string | null;
};

export function getTaiwanReportDate(
  value: string | undefined,
  isEndOfDay = false,
) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(
    `${value}${isEndOfDay ? "T23:59:59.999" : "T00:00:00"}+08:00`,
  );
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getReportStoreScope(
  user: ReportUser,
  selectedStoreId?: string,
): Prisma.OrderWhereInput {
  if (user.role !== "HQ_ADMIN") {
    return { groupBuyStore: { storeId: user.storeId! } };
  }
  return selectedStoreId ? { groupBuyStore: { storeId: selectedStoreId } } : {};
}

export function getReceivedAtFilter(start?: string, end?: string) {
  const startAt = getTaiwanReportDate(start);
  const endAt = getTaiwanReportDate(end, true);
  return startAt || endAt
    ? {
        paidAt: {
          ...(startAt ? { gte: startAt } : {}),
          ...(endAt ? { lte: endAt } : {}),
        },
      }
    : {};
}

/** Limits report data by the date a group buy was opened, not by order or payment date. */
export function getGroupBuyStartDateFilter(start?: string, end?: string): Prisma.OrderWhereInput {
  const startAt = getTaiwanReportDate(start);
  const endAt = getTaiwanReportDate(end, true);

  return startAt || endAt
    ? {
        groupBuyStore: {
          groupBuy: {
            startAt: {
              ...(startAt ? { gte: startAt } : {}),
              ...(endAt ? { lte: endAt } : {}),
            },
          },
        },
      }
    : {};
}

export const receivedOrderStatus = "PICKED_UP_PAID" as const;

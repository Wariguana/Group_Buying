import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { ExportButton } from "../export-button";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

type StoreRankingPageProps = {
  searchParams: Promise<{ start?: string; end?: string; page?: string }>;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function StoreRankingPage({
  searchParams,
}: StoreRankingPageProps) {
  const user = await getCurrentUser();

  if (!user) redirect("/");
  if (user.role !== "HQ_ADMIN" && !user.storeId) redirect("/home");

  const isHqAdmin = user.role === "HQ_ADMIN";
  const params = await searchParams;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 200;

  const groupBuyDateFilter = getGroupBuyStartDateFilter(
    params.start,
    params.end,
  );

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      AND: [
        groupBuyDateFilter,
        ...(!isHqAdmin
          ? [{ groupBuyStore: { storeId: user.storeId! } }]
          : []),
      ],
    },
    orderBy: { paidAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      quantity: true,
      totalAmount: true,
      groupBuyStore: {
        select: {
          store: {
            select: {
              id: true,
              name: true,
            },
          },
          groupBuy: {
            select: {
              title: true,
              productName: true,
              unit: true,
            },
          },
        },
      },
    },
  });
  const hasNextPage = paidOrders.length > pageSize;
  const visibleOrders = hasNextPage ? paidOrders.slice(0, pageSize) : paidOrders;

  const stores = new Map<
    string,
    {
      id: string;
      name: string;
      orderCount: number;
      quantity: number;
      revenue: number;
    }
  >();

  for (const order of visibleOrders) {
    const store = order.groupBuyStore.store;
    const existing = stores.get(store.id);

    if (existing) {
      existing.orderCount += 1;
      existing.quantity += order.quantity;
      existing.revenue += Number(order.totalAmount);
    } else {
      stores.set(store.id, {
        id: store.id,
        name: store.name,
        orderCount: 1,
        quantity: order.quantity,
        revenue: Number(order.totalAmount),
      });
    }
  }

  const rows = Array.from(stores.values()).sort(
    (left, right) =>
      right.revenue - left.revenue ||
      right.quantity - left.quantity,
  );

  const detailRows = new Map<
    string,
    {
      store: string;
      groupBuy: string;
      productName: string;
      unit: string | null;
      quantity: number;
      revenue: number;
    }
  >();

  for (const order of visibleOrders) {
    const store = order.groupBuyStore.store.name;
    const groupBuy = order.groupBuyStore.groupBuy.title;
    const productName =
      order.groupBuyStore.groupBuy.productName;
    const unit =
      order.groupBuyStore.groupBuy.unit;

    const key =
      `${store}:${groupBuy}:${productName}:${unit ?? ""}`;

    const row = detailRows.get(key);

    if (row) {
      row.quantity += order.quantity;
      row.revenue += Number(order.totalAmount);
    } else {
      detailRows.set(key, {
        store,
        groupBuy,
        productName,
        unit,
        quantity: order.quantity,
        revenue: Number(order.totalAmount),
      });
    }
  }

  const details = [...detailRows.values()].sort(
    (left, right) =>
      right.revenue - left.revenue ||
      right.quantity - left.quantity,
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司報表" : "分店報表"}
            </p>

            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              各店銷售排行
            </h1>

            <p className="mt-3 text-slate-600">
              僅統計已收款訂單，依開團日期篩選；排行為本頁資料。
            </p>
          </div>

          <Link
            href="/reports"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            返回營運總覽
          </Link>
        </div>

        <form
          key={`${params.start ?? ""}-${params.end ?? ""}`}
          className="mt-6 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50 p-4"
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            開始日期
            <input
              type="date"
              name="start"
              defaultValue={params.start ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            結束日期
            <input
              type="date"
              name="end"
              defaultValue={params.end ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
          >
            套用篩選
          </button>

          <Link
            href="/reports/store-ranking"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            清除篩選
          </Link>

          <ExportButton
            href={`/api/reports/store-ranking/export${
              params.start || params.end
                ? `?${new URLSearchParams({
                    ...(params.start
                      ? { start: params.start }
                      : {}),
                    ...(params.end
                      ? { end: params.end }
                      : {}),
                  })}`
                : ""
            }`}
          />
        </form>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">排名</th>
                <th className="px-4 py-3">門市</th>
                <th className="px-4 py-3 text-right">
                  已收款訂單數
                </th>
                <th className="px-4 py-3 text-right">
                  已收款數量
                </th>
                <th className="px-4 py-3 text-right">
                  已收款營業額
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    此篩選條件下沒有已收款訂單。
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className="text-slate-700"
                  >
                    <td className="px-4 py-3 font-medium">
                      {index + 1}
                    </td>

                    <td className="px-4 py-3 font-medium">
                      {row.name}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.orderCount}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.quantity}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-[#007F83]">
                      {formatAmount(row.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <section className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <div className="border-b bg-slate-50 px-5 py-4">
            <h2 className="font-bold">
              門市／團購銷售明細
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              由排行可直接追查到各門市的團購與商品銷售。
            </p>
          </div>

          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">
                  門市
                </th>

                <th className="px-4 py-3">
                  團購名稱
                </th>

                <th className="px-4 py-3">
                  商品
                </th>

                <th className="px-4 py-3 text-right">
                  已收款數量
                </th>

                <th className="px-4 py-3 text-right">
                  已收款營業額
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {details.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    此篩選條件下沒有銷售明細。
                  </td>
                </tr>
              ) : (
                details.map((row) => (
                  <tr
                    key={`${row.store}:${row.groupBuy}:${row.productName}:${row.unit ?? ""}`}
                  >
                    <td className="px-4 py-3">
                      {row.store}
                    </td>

                    <td className="px-4 py-3">
                      {row.groupBuy}
                    </td>

                    <td className="px-4 py-3">
                      {row.productName}
                      {row.unit
                        ? ` (${row.unit})`
                        : ""}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {row.quantity}
                    </td>

                    <td className="px-4 py-3 text-right text-[#007F83]">
                      {formatAmount(row.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>第 {page} 頁，每頁最多 {pageSize} 筆訂單。</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={`/reports/store-ranking?${new URLSearchParams({ ...(params.start ? { start: params.start } : {}), ...(params.end ? { end: params.end } : {}), page: String(page - 1) })}`} className="rounded border px-3 py-2">上一頁</Link> : null}
            {hasNextPage ? <Link href={`/reports/store-ranking?${new URLSearchParams({ ...(params.start ? { start: params.start } : {}), ...(params.end ? { end: params.end } : {}), page: String(page + 1) })}`} className="rounded border px-3 py-2">下一頁</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

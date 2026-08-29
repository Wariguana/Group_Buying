import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type GroupBuysReportPageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
    groupBuy?: string;
  }>;
};

function getTaiwanDate(value: string | undefined, isEndOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const time = isEndOfDay ? "T23:59:59.999" : "T00:00:00";
  const date = new Date(`${value}${time}+08:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function GroupBuysReportPage({
  searchParams,
}: GroupBuysReportPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "HQ_ADMIN" && !user.storeId) {
    redirect("/home");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";
  const params = await searchParams;
  const stores = isHqAdmin
    ? await prisma.store.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const selectedStoreId =
    isHqAdmin && stores.some((store) => store.id === params.store)
      ? params.store!
      : "";
  const groupBuyStoreScope = !isHqAdmin
    ? { storeId: user.storeId! }
    : selectedStoreId
      ? { storeId: selectedStoreId }
      : {};
  const groupBuys = await prisma.groupBuy.findMany({
    where: {
      groupBuyStores: {
        some: groupBuyStoreScope,
      },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  const selectedGroupBuyId = groupBuys.some(
    (groupBuy) => groupBuy.id === params.groupBuy,
  )
    ? params.groupBuy!
    : "";
  const startAt = getTaiwanDate(params.start);
  const endAt = getTaiwanDate(params.end, true);
  const paidAtFilter =
    startAt || endAt
      ? {
          paidAt: {
            ...(startAt ? { gte: startAt } : {}),
            ...(endAt ? { lte: endAt } : {}),
          },
        }
      : {};

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      ...paidAtFilter,
      groupBuyStore: {
        ...groupBuyStoreScope,
        ...(selectedGroupBuyId ? { groupBuyId: selectedGroupBuyId } : {}),
      },
    },
    select: {
      productName: true,
      quantity: true,
      totalAmount: true,
      groupBuyStore: {
        select: {
          groupBuy: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const reportByGroupBuy = new Map<
    string,
    {
      id: string;
      title: string;
      productName: string;
      orderCount: number;
      quantity: number;
      revenue: number;
    }
  >();

  for (const order of paidOrders) {
    const groupBuy = order.groupBuyStore.groupBuy;
    const existing = reportByGroupBuy.get(groupBuy.id);

    if (existing) {
      existing.orderCount += 1;
      existing.quantity += order.quantity;
      existing.revenue += Number(order.totalAmount);
      continue;
    }

    reportByGroupBuy.set(groupBuy.id, {
      id: groupBuy.id,
      title: groupBuy.title,
      productName: order.productName,
      orderCount: 1,
      quantity: order.quantity,
      revenue: Number(order.totalAmount),
    });
  }

  const rows = Array.from(reportByGroupBuy.values()).sort(
    (left, right) => right.revenue - left.revenue,
  );
  const totalRevenue = rows.reduce((total, row) => total + row.revenue, 0);
  const totalQuantity = rows.reduce((total, row) => total + row.quantity, 0);

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司報表" : "分店報表"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">團購分析</h1>
            <p className="mt-3 text-slate-600">
              以團購名稱彙總已取貨並付款的訂單，依付款取貨時間篩選。
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
          key={`${params.start ?? ""}-${params.end ?? ""}-${selectedStoreId}-${selectedGroupBuyId}`}
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
          {isHqAdmin ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              門市
              <select
                name="store"
                defaultValue={selectedStoreId}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">全部門市</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            團購名稱
            <select
              name="groupBuy"
              defaultValue={selectedGroupBuyId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">全部團購</option>
              {groupBuys.map((groupBuy) => (
                <option key={groupBuy.id} value={groupBuy.id}>
                  {groupBuy.title}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
          >
            套用篩選
          </button>
          <Link
            href="/reports/group-buys"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            清除篩選
          </Link>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">有銷售的團購數</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {rows.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已付款銷售數量</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalQuantity}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已付款營業額</p>
            <p className="mt-2 text-3xl font-bold text-[#007F83]">
              {formatAmount(totalRevenue)}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">排名</th>
                <th className="px-4 py-3">團購名稱</th>
                <th className="px-4 py-3">商品</th>
                <th className="px-4 py-3 text-right">已付款訂單數</th>
                <th className="px-4 py-3 text-right">已付款數量</th>
                <th className="px-4 py-3 text-right">已付款營業額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    此篩選條件下沒有已付款訂單。
                  </td>
                </tr>
              ) : (
                rows.map((row, index) => (
                  <tr key={row.id} className="text-slate-700">
                    <td className="px-4 py-3 font-medium">{index + 1}</td>
                    <td className="px-4 py-3 font-medium">{row.title}</td>
                    <td className="px-4 py-3">{row.productName}</td>
                    <td className="px-4 py-3 text-right">{row.orderCount}</td>
                    <td className="px-4 py-3 text-right">{row.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#007F83]">
                      {formatAmount(row.revenue)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

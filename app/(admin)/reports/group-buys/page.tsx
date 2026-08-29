import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

type GroupBuysReportPageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
    groupBuy?: string;
    page?: string;
  }>;
};

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
  const groupBuyDateFilter = getGroupBuyStartDateFilter(params.start, params.end);
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 200;

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      AND: [groupBuyDateFilter],
      groupBuyStore: {
        ...groupBuyStoreScope,
        ...(selectedGroupBuyId ? { groupBuyId: selectedGroupBuyId } : {}),
      },
    },
    orderBy: { paidAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true,
      orderNo: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      totalAmount: true,
      paidAt: true,
      customer: { select: { displayName: true, phone: true } },
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
  const hasNextPage = paidOrders.length > pageSize;
  const visibleOrders = hasNextPage ? paidOrders.slice(0, pageSize) : paidOrders;

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

  for (const order of visibleOrders) {
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
  const exportSearchParams = new URLSearchParams();

  if (params.start) exportSearchParams.set("start", params.start);
  if (params.end) exportSearchParams.set("end", params.end);
  if (selectedStoreId) exportSearchParams.set("store", selectedStoreId);
  if (selectedGroupBuyId)
    exportSearchParams.set("groupBuy", selectedGroupBuyId);

  const exportHref = `/api/reports/group-buys/export${exportSearchParams.size ? `?${exportSearchParams}` : ""}`;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司報表" : "分店報表"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              訂單銷售－依團購名稱
            </h1>
            <p className="mt-3 text-slate-600">
              依團購名稱篩選已收款訂單，逐筆核對客戶與商品。
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
          <a
            href={exportHref}
            className="rounded-lg border border-[#007F83] px-4 py-2 text-sm font-medium text-[#007F83] transition hover:bg-[#e6f4f4]"
          >
            匯出 Excel
          </a>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">本頁有銷售的團購數</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {rows.length}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">本頁已收款銷售數量</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalQuantity}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">本頁已收款營業額</p>
            <p className="mt-2 text-3xl font-bold text-[#007F83]">
              {formatAmount(totalRevenue)}
            </p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">收款時間</th>
                <th className="px-4 py-3">訂單編號</th>
                <th className="px-4 py-3">團購名稱</th>
                <th className="px-4 py-3">客戶／電話</th>
                <th className="px-4 py-3">商品</th>
                <th className="px-4 py-3 text-right">單價</th>
                <th className="px-4 py-3 text-right">數量</th>
                <th className="px-4 py-3 text-right">收款金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    此篩選條件下沒有已收款訂單。
                  </td>
                </tr>
              ) : (
                visibleOrders.map((order) => (
                  <tr key={order.id} className="text-slate-700">
                    <td className="px-4 py-3">
                      {order.paidAt
                        ? new Intl.DateTimeFormat("zh-TW", {
                            dateStyle: "short",
                            timeStyle: "short",
                          }).format(order.paidAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{order.orderNo}</td>
                    <td className="px-4 py-3">
                      {order.groupBuyStore.groupBuy.title}
                    </td>
                    <td className="px-4 py-3">
                      <p>{order.customer.displayName ?? "LINE 客戶"}</p>
                      <p className="text-slate-500">
                        {order.customer.phone ?? "未填寫"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {order.productName}
                      {order.unit ? ` (${order.unit})` : ""}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {formatAmount(Number(order.unitPrice))}
                    </td>
                    <td className="px-4 py-3 text-right">{order.quantity}</td>
                    <td className="px-4 py-3 text-right font-medium text-[#007F83]">
                      {formatAmount(Number(order.totalAmount))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>第 {page} 頁，每頁最多 {pageSize} 筆。</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/reports/group-buys?${new URLSearchParams({ ...Object.fromEntries(exportSearchParams), page: String(page - 1) })}`}
                className="rounded border px-3 py-2"
              >
                上一頁
              </Link>
            ) : null}
            {hasNextPage ? (
              <Link
                href={`/reports/group-buys?${new URLSearchParams({ ...Object.fromEntries(exportSearchParams), page: String(page + 1) })}`}
                className="rounded border px-3 py-2"
              >
                下一頁
              </Link>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}

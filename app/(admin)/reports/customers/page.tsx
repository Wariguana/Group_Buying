import Link from "next/link";
import { redirect } from "next/navigation";
import { ExportButton } from "../export-button";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

type CustomersReportPageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
    customer?: string;
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

export default async function CustomersReportPage({
  searchParams,
}: CustomersReportPageProps) {
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
  const customerQuery = params.customer?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 200;
  const groupBuyDateFilter = getGroupBuyStartDateFilter(params.start, params.end);
  const storeScope = !isHqAdmin
    ? { groupBuyStore: { storeId: user.storeId! } }
    : selectedStoreId
      ? { groupBuyStore: { storeId: selectedStoreId } }
      : {};
  const customerFilter = customerQuery
    ? {
        customer: {
          OR: [
            {
              displayName: {
                contains: customerQuery,
                mode: "insensitive" as const,
              },
            },
            { phone: { contains: customerQuery } },
          ],
        },
      }
    : {};

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      AND: [storeScope, groupBuyDateFilter],
      ...customerFilter,
    },
    orderBy: { paidAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: {
      id: true,
      orderNo: true,
      customerId: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      totalAmount: true,
      paidAt: true,
      customer: {
        select: {
          displayName: true,
          phone: true,
        },
      },
      groupBuyStore: { select: { groupBuy: { select: { title: true } } } },
    },
  });
  const hasNextPage = paidOrders.length > pageSize;
  const visibleOrders = hasNextPage ? paidOrders.slice(0, pageSize) : paidOrders;

  const customers = new Map<
    string,
    {
      id: string;
      displayName: string | null;
      phone: string | null;
      orderCount: number;
      quantity: number;
      revenue: number;
    }
  >();

  for (const order of visibleOrders) {
    const existing = customers.get(order.customerId);

    if (existing) {
      existing.orderCount += 1;
      existing.quantity += order.quantity;
      existing.revenue += Number(order.totalAmount);
      continue;
    }

    customers.set(order.customerId, {
      id: order.customerId,
      displayName: order.customer.displayName,
      phone: order.customer.phone,
      orderCount: 1,
      quantity: order.quantity,
      revenue: Number(order.totalAmount),
    });
  }

  const rows = Array.from(customers.values()).sort(
    (left, right) =>
      right.revenue - left.revenue || right.quantity - left.quantity,
  );
  const exportSearchParams = new URLSearchParams();
  if (params.start) exportSearchParams.set("start", params.start);
  if (params.end) exportSearchParams.set("end", params.end);
  if (selectedStoreId) exportSearchParams.set("store", selectedStoreId);
  if (customerQuery) exportSearchParams.set("customer", customerQuery);
  const exportHref = `/api/reports/customers/export${exportSearchParams.size ? `?${exportSearchParams}` : ""}`;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司報表" : "分店報表"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              訂單銷售－依客戶
            </h1>
            <p className="mt-3 text-slate-600">
              依客戶姓名或電話篩選已收款訂單；Excel 另附每筆客戶購買明細。
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
          key={`${params.start ?? ""}-${params.end ?? ""}-${selectedStoreId}-${customerQuery}`}
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
            客戶姓名或電話
            <input
              type="search"
              name="customer"
              defaultValue={customerQuery}
              placeholder="搜尋客戶"
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
            href="/reports/customers"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            清除篩選
          </Link>
          <ExportButton href={exportHref} />
        </form>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-4 py-3">收款日期</th>
                <th className="px-4 py-3">訂單編號</th>
                <th className="px-4 py-3">客戶</th>
                <th className="px-4 py-3">電話</th>
                <th className="px-4 py-3">團購／商品</th>
                <th className="px-4 py-3 text-right">單價</th>
                <th className="px-4 py-3 text-right">數量</th>
                <th className="px-4 py-3 text-right">收款金額</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
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
                            timeZone: "Asia/Taipei",
                          }).format(order.paidAt)
                        : "—"}
                    </td>
                    <td className="px-4 py-3">{order.orderNo}</td>
                    <td className="px-4 py-3 font-medium">
                      {order.customer.displayName ?? "LINE 客戶"}
                    </td>
                    <td className="px-4 py-3">
                      {order.customer.phone ?? "未填寫"}
                    </td>
                    <td className="px-4 py-3">
                      <p>{order.groupBuyStore.groupBuy.title}</p>
                      <p className="text-slate-500">
                        {order.productName}
                        {order.unit ? ` (${order.unit})` : ""}
                      </p>
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
            {page > 1 ? <Link href={`/reports/customers?${new URLSearchParams({ ...Object.fromEntries(exportSearchParams), page: String(page - 1) })}`} className="rounded border px-3 py-2">上一頁</Link> : null}
            {hasNextPage ? <Link href={`/reports/customers?${new URLSearchParams({ ...Object.fromEntries(exportSearchParams), page: String(page + 1) })}`} className="rounded border px-3 py-2">下一頁</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

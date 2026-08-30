import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";
import { ReportFilters, ReportHeader, ReportShell } from "../report-ui";

type Props = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
    groupBuy?: string;
    customer?: string;
    status?: string;
    page?: string;
  }>;
};
const labels: Record<string, string> = {
  ORDERED: "已訂購",
  ARRIVED: "已到貨",
  PICKED_UP_PAID: "已收款",
  CANCELED: "已取消",
  EXPIRED_UNCOLLECTED: "逾期未取",
};
const money = (value: number) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(value);
const formatDate = (value: Date | null) =>
  value
    ? new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "short",
        timeZone: "Asia/Taipei",
      }).format(value)
    : "—";

export default async function OrderSalesReport({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "HQ_ADMIN" && !user.storeId) redirect("/home");
  const params = await searchParams;
  const isHq = user.role === "HQ_ADMIN";
  const stores = isHq
    ? await prisma.store.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const storeId =
    isHq && stores.some((store) => store.id === params.store)
      ? params.store!
      : "";
  const groupBuyScope = !isHq
    ? { storeId: user.storeId! }
    : storeId
      ? { storeId }
      : {};
  const groupBuys = await prisma.groupBuy.findMany({
    where: { groupBuyStores: { some: groupBuyScope } },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true },
  });
  const groupBuyId = groupBuys.some(
    (groupBuy) => groupBuy.id === params.groupBuy,
  )
    ? params.groupBuy!
    : "";
  const customer = params.customer?.trim().slice(0, 100) ?? "";
  const groupBuyDateFilter = getGroupBuyStartDateFilter(params.start, params.end);
  const status = labels[params.status ?? ""] ? params.status! : "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 200;
  const where = {
    ...(!isHq
      ? { groupBuyStore: { storeId: user.storeId! } }
      : storeId
        ? { groupBuyStore: { storeId } }
        : {}),
    ...(groupBuyId ? { groupBuyStore: { ...groupBuyScope, groupBuyId } } : {}),
    ...(status ? { status: status as "ORDERED" } : {}),
    AND: [
      ...(!isHq ? [{ groupBuyStore: { storeId: user.storeId! } }] : storeId ? [{ groupBuyStore: { storeId } }] : []),
      ...(groupBuyId ? [{ groupBuyStore: { ...groupBuyScope, groupBuyId } }] : []),
      groupBuyDateFilter,
    ],
    ...(customer
      ? {
          customer: {
            OR: [
              {
                displayName: {
                  contains: customer,
                  mode: "insensitive" as const,
                },
              },
              { phone: { contains: customer } },
            ],
          },
        }
      : {}),
  };
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
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
      status: true,
      createdAt: true,
      paidAt: true,
      customer: { select: { displayName: true, phone: true } },
      groupBuyStore: {
        select: {
          store: { select: { name: true } },
          groupBuy: { select: { title: true } },
        },
      },
    },
  });
  const hasNextPage = orders.length > pageSize;
  const visibleOrders = hasNextPage ? orders.slice(0, pageSize) : orders;
  const exportParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value) exportParams.set(key, value);
  return (
    <ReportShell>
      <ReportHeader
        role={isHq ? "總公司報表" : "分店報表"}
        title="訂單銷售明細"
        description="唯讀查帳報表；依開團日期篩選，可直接核對收款與訂單狀態。"
      />
      <ReportFilters>
        <label>
          開始日期
          <input
            className="ml-2 rounded border p-2"
            type="date"
            name="start"
            defaultValue={params.start}
          />
        </label>
        <label>
          結束日期
          <input
            className="ml-2 rounded border p-2"
            type="date"
            name="end"
            defaultValue={params.end}
          />
        </label>
        {isHq && (
          <label>
            門市
            <select
              className="ml-2 rounded border p-2"
              name="store"
              defaultValue={storeId}
            >
              <option value="">全部門市</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          團購
          <select
            className="ml-2 rounded border p-2"
            name="groupBuy"
            defaultValue={groupBuyId}
          >
            <option value="">全部團購</option>
            {groupBuys.map((g) => (
              <option key={g.id} value={g.id}>
                {g.title}
              </option>
            ))}
          </select>
        </label>
        <label>
          客戶
          <input
            className="ml-2 rounded border p-2"
            name="customer"
            defaultValue={customer}
          />
        </label>
        <label>
          狀態
          <select
            className="ml-2 rounded border p-2"
            name="status"
            defaultValue={status}
          >
            <option value="">全部狀態</option>
            {Object.entries(labels).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="rounded-lg bg-[#007F83] px-4 py-2 text-white">
          套用篩選
        </button>
        <Link href="/reports/orders" className="rounded-lg border px-4 py-2">
          清除篩選
        </Link>
        <a
          href={`/api/reports/orders/export?${exportParams}`}
          className="rounded-lg border border-[#007F83] px-4 py-2 text-[#007F83]"
        >
          匯出 Excel
        </a>
      </ReportFilters>
      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100">
            <tr>
              {[
                "訂單編號",
                "門市／團購",
                "客戶／電話",
                "商品",
                "下單日期",
                "收款日期",
                "數量",
                "金額",
                "狀態",
              ].map((h) => (
                <th key={h} className="px-4 py-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {visibleOrders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">{o.orderNo}</td>
                <td className="px-4 py-3">
                  <p>{o.groupBuyStore.store.name}</p>
                  <p className="text-slate-500">
                    {o.groupBuyStore.groupBuy.title}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <p>{o.customer.displayName ?? "LINE 客戶"}</p>
                  <p className="text-slate-500">
                    {o.customer.phone ?? "未填寫"}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {o.productName}
                  {o.unit ? ` (${o.unit})` : ""}
                </td>
                <td className="px-4 py-3">{formatDate(o.createdAt)}</td>
                <td className="px-4 py-3">{formatDate(o.paidAt)}</td>
                <td className="px-4 py-3 text-right">{o.quantity}</td>
                <td className="px-4 py-3 text-right">
                  {money(Number(o.totalAmount))}
                </td>
                <td className="px-4 py-3">{labels[o.status]}</td>
              </tr>
            ))}
            {visibleOrders.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  沒有符合條件的訂單。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>第 {page} 頁，每頁最多 {pageSize} 筆。</span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link href={`/reports/orders?${new URLSearchParams({ ...Object.fromEntries(exportParams), page: String(page - 1) })}`} className="rounded border px-3 py-2">上一頁</Link>
          ) : null}
          {hasNextPage ? (
            <Link href={`/reports/orders?${new URLSearchParams({ ...Object.fromEntries(exportParams), page: String(page + 1) })}`} className="rounded border px-3 py-2">下一頁</Link>
          ) : null}
        </div>
      </div>
    </ReportShell>
  );
}

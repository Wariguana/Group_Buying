import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    timeZone: "Asia/Taipei",
  }).format(value);
}

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const roleLabel =
    user.role === "HQ_ADMIN" ? "總公司管理員" : "分店管理員";
  const isHqAdmin = user.role === "HQ_ADMIN";
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const groupBuyScope = isHqAdmin
    ? {}
    : { groupBuyStores: { some: { storeId: user.storeId! } } };
  const orderScope = isHqAdmin
    ? {}
    : { groupBuyStore: { storeId: user.storeId! } };
  const activeStoreScope = isHqAdmin ? {} : { storeId: user.storeId! };

  const [
    monthlyGroupBuys,
    activeGroupBuyCount,
    activeGroupBuys,
    pendingOrderCount,
    monthlyRevenue,
  ] =
    await Promise.all([
      prisma.groupBuy.findMany({
        where: {
          AND: [
            groupBuyScope,
            { startAt: { gte: monthStart, lt: nextMonthStart } },
          ],
        },
        select: { status: true },
      }),
      prisma.groupBuy.count({
        where: {
          AND: [
            groupBuyScope,
            {
              status: "PUBLISHED",
              startAt: { lte: now },
              endAt: { gte: now },
            },
          ],
        },
      }),
      prisma.groupBuy.findMany({
        where: {
          AND: [
            groupBuyScope,
            {
              status: "PUBLISHED",
              startAt: { lte: now },
              endAt: { gte: now },
            },
          ],
        },
        orderBy: { endAt: "asc" },
        take: 5,
        select: {
          id: true,
          title: true,
          productName: true,
          endAt: true,
          groupBuyStores: {
            where: activeStoreScope,
            select: { store: { select: { name: true } } },
          },
        },
      }),
      prisma.order.count({
        where: {
          AND: [orderScope, { status: { in: ["ORDERED", "ARRIVED"] } }],
        },
      }),
      prisma.order.aggregate({
        where: {
          AND: [
            orderScope,
            {
              status: "PICKED_UP_PAID",
              groupBuyStore: {
                groupBuy: {
                  startAt: { gte: monthStart, lt: nextMonthStart },
                },
              },
            },
          ],
        },
        _sum: { totalAmount: true },
      }),
    ]);
  const monthlyStatusCount = (status: string) =>
    monthlyGroupBuys.filter((groupBuy) => groupBuy.status === status).length;

  return (
    <>
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          團購管理系統
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          歡迎回來，{user.username}
        </h1>

        <p className="mt-3 text-slate-600">
          你目前以「{roleLabel}」身分登入。
        </p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">本月開團數</p>
          <p className="mt-2 text-3xl font-bold">{monthlyGroupBuys.length}</p>
          <p className="mt-2 text-sm text-slate-500">
            依開團日期統計。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">進行中團購</p>
          <p className="mt-2 text-3xl font-bold">{activeGroupBuyCount}</p>
          <p className="mt-2 text-sm text-slate-500">
            已發布且目前仍在開團期間。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">待處理訂單</p>
          <p className="mt-2 text-3xl font-bold">{pendingOrderCount}</p>
          <p className="mt-2 text-sm text-slate-500">
            已訂購與已到貨、尚未取貨付款的訂單。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">本月開團已收款</p>
          <p className="mt-2 text-3xl font-bold text-[#007F83]">
            {formatAmount(Number(monthlyRevenue._sum.totalAmount ?? 0))}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            僅計入已取貨並付款的訂單。
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <div>
            <p className="text-sm font-medium text-[#007F83]">即時狀況</p>
            <h2 className="mt-1 text-xl font-bold">目前進行中的團購</h2>
          </div>

          {activeGroupBuys.length === 0 ? (
            <p className="mt-6 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
              目前沒有進行中的團購。
            </p>
          ) : (
            <div className="mt-5 divide-y divide-slate-100">
              {activeGroupBuys.map((groupBuy) => (
                <div key={groupBuy.id} className="py-4 first:pt-0">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="font-bold text-slate-900">{groupBuy.title}</p>
                    <p className="text-sm font-medium text-amber-700">
                      截止：{formatDate(groupBuy.endAt)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {groupBuy.productName}・
                    {groupBuy.groupBuyStores.map((item) => item.store.name).join("、")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm font-medium text-[#007F83]">本月開團</p>
          <h2 className="mt-1 text-xl font-bold">團購狀態</h2>

          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              ["草稿", "DRAFT", "bg-slate-100 text-slate-700"],
              ["已發布", "PUBLISHED", "bg-emerald-50 text-emerald-700"],
              ["已暫停", "PAUSED", "bg-amber-50 text-amber-700"],
              ["已結束", "ENDED", "bg-sky-50 text-sky-700"],
            ].map(([label, status, color]) => (
              <div key={status} className={`rounded-xl p-4 ${color}`}>
                <p className="text-sm">{label}</p>
                <p className="mt-1 text-2xl font-bold">
                  {monthlyStatusCount(status)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { OrderArrivalActions } from "@/app/(admin)/orders/order-arrival-actions";
import { OrderPickupActions } from "@/app/(admin)/orders/order-pickup-actions";

type OrderDetailPageProps = {
  params: Promise<{
    groupBuyStoreId: string;
  }>;

  searchParams: Promise<{
    page?: string;
  }>;
};

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    ORDERED: "已訂購",
    ARRIVED: "已到貨",
    PICKED_UP_PAID: "已取貨並付款",
    CANCELED: "已取消",
    EXPIRED_UNCOLLECTED: "逾期未取",
  };

  return labels[status] ?? status;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeZone: "Asia/Taipei",
  }).format(date);
}

export default async function OrderDetailPage({
  params,
  searchParams,
}: OrderDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && !user.storeId) {
    redirect("/home");
  }

  const { groupBuyStoreId } = await params;
  const search = await searchParams;

  const page = Math.max(
    1,
    Number.parseInt(search.page ?? "1", 10) || 1
  );

  const pageSize = 50;

  /*
   * 先確認這個 GroupBuyStore 存在，
   * 同時處理分店管理員權限。
   *
   * HQ_ADMIN 可以看全部。
   * STORE_ADMIN 只能看自己的 store。
   */
  const groupBuyStore = await prisma.groupBuyStore.findFirst({
    where: {
      id: groupBuyStoreId,

      ...(isHqAdmin
        ? {}
        : {
            storeId: user.storeId!,
          }),
    },

    select: {
      id: true,

      store: {
        select: {
          name: true,
        },
      },

      groupBuy: {
        select: {
          title: true,
          productName: true,
          unit: true,
          startAt: true,
          endAt: true,
        },
      },
    },
  });

  if (!groupBuyStore) {
    notFound();
  }

  /*
   * 查這一團目前各狀態數量。
   *
   * 注意：
   * 這是 aggregate，
   * 不會把整團所有 Order 載回 Node.js。
   */
  const statusGroups = await prisma.order.groupBy({
    by: ["status"],

    where: {
      groupBuyStoreId,
    },

    _count: {
      _all: true,
    },
  });

  const statusCounts = new Map(
    statusGroups.map((item) => [
      item.status,
      item._count._all,
    ])
  );

  const orderedCount = statusCounts.get("ORDERED") ?? 0;
  const arrivedCount = statusCounts.get("ARRIVED") ?? 0;
  const paidCount = statusCounts.get("PICKED_UP_PAID") ?? 0;
  const canceledCount = statusCounts.get("CANCELED") ?? 0;
  const expiredCount =
    statusCounts.get("EXPIRED_UNCOLLECTED") ?? 0;

  const totalOrderCount =
    orderedCount +
    arrivedCount +
    paidCount +
    canceledCount +
    expiredCount;

  /*
   * 第二層才真正查 Order。
   * 一次最多抓 51 筆：
   *
   * 50 筆顯示
   * 第 51 筆只用來判斷有沒有下一頁
   */
  const orders = await prisma.order.findMany({
    where: {
      groupBuyStoreId,
    },

    orderBy: [
    {
        createdAt: "desc",
    },
    {
        id: "desc",
    },
    ],

    skip: (page - 1) * pageSize,
    take: pageSize + 1,

    select: {
      id: true,
      orderNo: true,
      quantity: true,
      totalAmount: true,
      note: true,
      status: true,
      createdAt: true,

      customer: {
        select: {
          displayName: true,
          phone: true,
        },
      },
    },
  });

  const hasNextPage = orders.length > pageSize;

  const visibleOrders = hasNextPage
    ? orders.slice(0, pageSize)
    : orders;

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <Link
          href="/orders"
          className="text-sm font-medium text-[#007F83] hover:underline"
        >
          ← 返回訂單管理
        </Link>

        <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {groupBuyStore.store.name}
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-900">
              {groupBuyStore.groupBuy.title}
            </h1>

            <p className="mt-2 text-slate-600">
              商品：{groupBuyStore.groupBuy.productName}
              {groupBuyStore.groupBuy.unit
                ? ` (${groupBuyStore.groupBuy.unit})`
                : ""}
            </p>

            <p className="mt-1 text-sm text-slate-500">
              開團期間：
              {formatDate(groupBuyStore.groupBuy.startAt)}
              {" ～ "}
              {formatDate(groupBuyStore.groupBuy.endAt)}
            </p>
          </div>

          <OrderArrivalActions
            groupBuyStoreId={groupBuyStore.id}
            orderedCount={orderedCount}
          />
        </div>

        <div className="mt-6 grid gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-5">
          <div className="bg-white p-4">
            <p className="text-sm text-slate-500">
              總訂單
            </p>
            <p className="mt-1 text-2xl font-bold">
              {totalOrderCount}
            </p>
          </div>

          <div className="bg-white p-4">
            <p className="text-sm text-slate-500">
              已訂購
            </p>
            <p className="mt-1 text-2xl font-bold">
              {orderedCount}
            </p>
          </div>

          <div className="bg-white p-4">
            <p className="text-sm text-slate-500">
              已到貨
            </p>
            <p className="mt-1 text-2xl font-bold">
              {arrivedCount}
            </p>
          </div>

          <div className="bg-white p-4">
            <p className="text-sm text-slate-500">
              已取貨付款
            </p>
            <p className="mt-1 text-2xl font-bold text-[#007F83]">
              {paidCount}
            </p>
          </div>

          <div className="bg-white p-4">
            <p className="text-sm text-slate-500">
              取消／逾期
            </p>
            <p className="mt-1 text-2xl font-bold">
              {canceledCount + expiredCount}
            </p>
          </div>
        </div>

        {visibleOrders.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500">
            目前沒有訂單。
          </div>
        ) : (
          <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-4 py-3">
                    訂單編號
                  </th>

                  <th className="px-4 py-3">
                    客戶
                  </th>

                  <th className="px-4 py-3">
                    數量／金額
                  </th>

                  <th className="px-4 py-3">
                    備註
                  </th>

                  <th className="px-4 py-3">
                    狀態
                  </th>

                  <th className="px-4 py-3">
                    下單日期
                  </th>

                  <th className="px-4 py-3">
                    操作
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {visibleOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="text-slate-700"
                  >
                    <td className="px-4 py-3 text-slate-500">
                      {order.orderNo}
                    </td>

                    <td className="px-4 py-3">
                      <p>
                        {order.customer.displayName ??
                          "LINE 客戶"}
                      </p>

                      <p className="mt-1 text-slate-500">
                        {order.customer.phone ??
                          "未填寫電話"}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <p>{order.quantity} 件</p>

                      <p className="mt-1 text-slate-500">
                        NT$ {order.totalAmount.toString()}
                      </p>
                    </td>

                    <td className="max-w-48 px-4 py-3 text-slate-500">
                      {order.note || "—"}
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium">
                        {getStatusLabel(order.status)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-slate-500">
                      {formatDate(order.createdAt)}
                    </td>

                    <td className="px-4 py-3">
                      <OrderPickupActions
                        orderId={order.id}
                        status={order.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibleOrders.length > 0 ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              第 {page} 頁，每頁最多 {pageSize} 筆訂單
            </span>

            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/orders/${groupBuyStoreId}?page=${page - 1}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  上一頁
                </Link>
              ) : null}

              {hasNextPage ? (
                <Link
                  href={`/orders/${groupBuyStoreId}?page=${page + 1}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  下一頁
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
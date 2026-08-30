import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { OrderArrivalActions } from "./order-arrival-actions";
import { OrderPickupActions } from "./order-pickup-actions";

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

export default async function OrdersPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && !user.storeId) {
    redirect("/home");
  }

  const orders = await prisma.order.findMany({
    where: isHqAdmin
      ? {}
      : {
          groupBuyStore: {
            storeId: user.storeId!,
          },
        },
    include: {
      customer: true,
      groupBuyStore: {
        include: {
          store: true,
          groupBuy: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const ordersByGroupBuyStore = new Map<string, typeof orders>();

  for (const order of orders) {
    const groupOrders = ordersByGroupBuyStore.get(order.groupBuyStoreId) ?? [];
    groupOrders.push(order);
    ordersByGroupBuyStore.set(order.groupBuyStoreId, groupOrders);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          {isHqAdmin ? "總公司管理" : "分店管理"}
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">訂單管理</h1>

        <p className="mt-3 text-slate-600">
          {isHqAdmin
            ? "可查看所有門市的團購訂單，並協助處理各門市到貨。"
            : "這裡只顯示本店訂單；到貨時可整團批次標記。"}
        </p>

        {ordersByGroupBuyStore.size === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500">
            目前沒有訂單。
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {Array.from(ordersByGroupBuyStore.entries()).map(
              ([groupBuyStoreId, groupOrders]) => {
                const groupBuyStore = groupOrders[0].groupBuyStore;
                const orderedCount = groupOrders.filter(
                  (order) => order.status === "ORDERED"
                ).length;

                return (
                  <section
                    key={groupBuyStoreId}
                    className="overflow-hidden rounded-xl border border-slate-200"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-[#007F83]">
                          {groupBuyStore.store.name}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-slate-900">
                          {groupBuyStore.groupBuy.title}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                          商品：{groupBuyStore.groupBuy.productName}
                        </p>
                      </div>

                      <OrderArrivalActions
                        groupBuyStoreId={groupBuyStoreId}
                        orderedCount={orderedCount}
                      />
                    </div>

                    <div className="overflow-x-auto">
                      <table className="min-w-full text-left text-sm">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="px-4 py-3">客戶</th>
                            <th className="px-4 py-3">數量／金額</th>
                            <th className="px-4 py-3">備註</th>
                            <th className="px-4 py-3">狀態</th>
                            <th className="px-4 py-3">下單日期</th>
                            <th className="px-4 py-3">操作</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-slate-200">
                          {groupOrders.map((order) => (
                            <tr key={order.id} className="text-slate-700">
                              <td className="px-4 py-3">
                                <p>{order.customer.displayName ?? "LINE 客戶"}</p>
                                <p className="mt-1 text-slate-500">
                                  {order.customer.phone ?? "未填寫電話"}
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
                  </section>
                );
              }
            )}
          </div>
        )}
      </section>
    </main>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";

import { useLineCustomer } from "@/app/liff/use-line-customer";

type OrderStatus = "ORDERED" | "ARRIVED" | "PICKED_UP_PAID" | "CANCELED" | "EXPIRED_UNCOLLECTED";

type CustomerOrder = {
  id: string;
  orderNo: string;
  productName: string;
  unit: string | null;
  unitPrice: string;
  quantity: number;
  totalAmount: string;
  note: string | null;
  status: OrderStatus;
  createdAt: string;
  canceledAt: string | null;
  canCancel: boolean;
  store: {
    name: string;
    address: string;
  };
  groupBuy: {
    id: string;
    title: string;
    endAt: string;
  };
  pickupStart: string;
  pickupEnd: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 2,
  }).format(Number(value));
}

function getStatusLabel(status: OrderStatus) {
  const labels: Record<OrderStatus, string> = {
    ORDERED: "已下單",
    ARRIVED: "已到貨",
    PICKED_UP_PAID: "已取貨並付款",
    CANCELED: "已取消",
    EXPIRED_UNCOLLECTED: "逾期未取",
  };

  return labels[status];
}

function getStatusClassName(status: OrderStatus) {
  if (status === "CANCELED" || status === "EXPIRED_UNCOLLECTED") {
    return "bg-rose-50 text-rose-700";
  }

  if (status === "PICKED_UP_PAID") {
    return "bg-slate-100 text-slate-700";
  }

  if (status === "ARRIVED") {
    return "bg-amber-50 text-amber-800";
  }

  return "bg-emerald-50 text-emerald-700";
}

export default function CustomerOrdersPage() {
  const { customer, errorMessage: lineErrorMessage, status } = useLineCustomer();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [ordersErrorMessage, setOrdersErrorMessage] = useState("");
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [cancellingOrderId, setCancellingOrderId] = useState("");

  useEffect(() => {
    if (!customer) {
      return;
    }

    let cancelled = false;

    async function loadOrders() {
      setIsLoadingOrders(true);

      try {
        const response = await fetch("/api/customer/orders");
        const data = (await response.json()) as {
          orders?: CustomerOrder[];
          message?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.orders) {
          setOrdersErrorMessage(data.message ?? "無法載入訂單資料。");
          return;
        }

        setOrders(data.orders);
      } catch {
        if (!cancelled) {
          setOrdersErrorMessage("無法連線到伺服器，請稍後再試。");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingOrders(false);
        }
      }
    }

    void loadOrders();

    return () => {
      cancelled = true;
    };
  }, [customer]);

  const groupedOrders = useMemo(() => {
    const stores = new Map<
      string,
      { name: string; address: string; groupBuys: Map<string, { title: string; orders: CustomerOrder[] }> }
    >();

    for (const order of orders) {
      const storeKey = `${order.store.name}:${order.store.address}`;
      const store = stores.get(storeKey) ?? {
        name: order.store.name,
        address: order.store.address,
        groupBuys: new Map(),
      };
      const groupBuy = store.groupBuys.get(order.groupBuy.id) ?? {
        title: order.groupBuy.title,
        orders: [],
      };

      groupBuy.orders.push(order);
      store.groupBuys.set(order.groupBuy.id, groupBuy);
      stores.set(storeKey, store);
    }

    return [...stores.values()];
  }, [orders]);

  async function handleCancel(order: CustomerOrder) {
    if (!window.confirm(`確定要取消訂單 ${order.orderNo} 嗎？`)) {
      return;
    }

    setOrdersErrorMessage("");
    setCancellingOrderId(order.id);

    try {
      const response = await fetch(`/api/orders/${order.id}/cancel`, {
        method: "POST",
      });
      const data = (await response.json()) as {
        canceledAt?: string;
        message?: string;
      };

      if (!response.ok || !data.canceledAt) {
        setOrdersErrorMessage(data.message ?? "取消訂單失敗，請稍後再試。");
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((currentOrder) =>
          currentOrder.id === order.id
            ? {
                ...currentOrder,
                status: "CANCELED",
                canceledAt: data.canceledAt ?? null,
                canCancel: false,
              }
            : currentOrder,
        ),
      );
    } catch {
      setOrdersErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setCancellingOrderId("");
    }
  }

  const errorMessage = lineErrorMessage || ordersErrorMessage;

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <section className="mx-auto max-w-lg space-y-5">
        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-[#007F83]">團購管理系統</p>
          <h1 className="mt-2 text-3xl font-bold">我的訂單</h1>
          <p className="mt-2 text-sm text-slate-600">
            {customer
              ? `${customer.displayName ? `${customer.displayName}，` : ""}這裡會顯示你所有分店的訂單。`
              : status}
          </p>
        </header>

        {errorMessage ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {customer?.needsPhone ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            請先從 LIFF 首頁完成聯絡電話設定後，再查看訂單。
          </p>
        ) : null}

        {customer && !customer.needsPhone && isLoadingOrders ? (
          <p className="rounded-xl bg-white px-5 py-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
            正在載入訂單資料…
          </p>
        ) : null}

        {customer && !customer.needsPhone && !isLoadingOrders && !errorMessage && orders.length === 0 ? (
          <p className="rounded-xl bg-white px-5 py-8 text-center text-slate-600 shadow-sm ring-1 ring-slate-200">
            目前還沒有訂單。
          </p>
        ) : null}

        {groupedOrders.map((store) => (
          <section key={`${store.name}:${store.address}`} className="space-y-4">
            <header className="px-1">
              <h2 className="text-xl font-bold">{store.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{store.address}</p>
            </header>

            {[...store.groupBuys.entries()].map(([groupBuyId, groupBuy]) => (
              <article key={groupBuyId} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <h3 className="border-b border-slate-100 px-5 py-4 text-lg font-bold">{groupBuy.title}</h3>
                <div className="divide-y divide-slate-100">
                  {groupBuy.orders.map((order) => (
                    <div key={order.id} className="space-y-3 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{order.productName}</p>
                          <p className="mt-1 text-sm text-slate-500">
                            {order.quantity} {order.unit ?? "件"} × {formatCurrency(order.unitPrice)}
                          </p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${getStatusClassName(order.status)}`}>
                          {getStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        <p>訂單編號：{order.orderNo}</p>
                        <p>取貨：{formatDateTime(order.pickupStart)} 至 {formatDateTime(order.pickupEnd)}</p>
                        {order.note ? <p>備註：{order.note}</p> : null}
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-bold text-[#007F83]">共 {formatCurrency(order.totalAmount)}</p>
                        {order.canCancel ? (
                          <button
                            type="button"
                            onClick={() => handleCancel(order)}
                            disabled={cancellingOrderId === order.id}
                            className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {cancellingOrderId === order.id ? "取消中…" : "取消訂單"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </section>
        ))}
      </section>
    </main>
  );
}

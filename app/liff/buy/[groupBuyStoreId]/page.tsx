"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { useLineCustomer } from "@/app/liff/use-line-customer";

type GroupBuyStore = {
  id: string;
  pickupStart: string;
  pickupEnd: string;
  store: {
    name: string;
    address: string;
    phone: string;
  };
  groupBuy: {
    title: string;
    content: string | null;
    imageUrls: string[];
    productName: string;
    unit: string | null;
    originalPrice: string | null;
    groupPrice: string;
    minimumQuantity: number;
    quantityMultiple: number;
    perCustomerLimit: number | null;
    totalQuantityLimit: number | null;
    startAt: string;
    endAt: string;
  };
};

type CreatedOrder = {
  orderNo: string;
  productName: string;
  quantity: number;
  totalAmount: string;
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function getFirstAllowedQuantity(groupBuy: GroupBuyStore["groupBuy"]) {
  return Math.ceil(groupBuy.minimumQuantity / groupBuy.quantityMultiple) * groupBuy.quantityMultiple;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function LiffBuyPage() {
  const params = useParams<{ groupBuyStoreId: string }>();
  const { customer, errorMessage: lineErrorMessage, status } = useLineCustomer();
  const [groupBuyStore, setGroupBuyStore] = useState<GroupBuyStore | null>(null);
  const [groupBuyErrorMessage, setGroupBuyErrorMessage] = useState("");
  const [quantity, setQuantity] = useState("");
  const [note, setNote] = useState("");
  const [orderErrorMessage, setOrderErrorMessage] = useState("");
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);

  useEffect(() => {
    if (!customer || !params.groupBuyStoreId) {
      return;
    }

    let cancelled = false;

    async function loadGroupBuy() {
      try {
        const response = await fetch(
          `/api/customer/group-buy-stores/${params.groupBuyStoreId}`,
        );
        const data = (await response.json()) as {
          groupBuyStore?: GroupBuyStore;
          message?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.groupBuyStore) {
          setGroupBuyErrorMessage(data.message ?? "無法載入團購資料。");
          return;
        }

        setGroupBuyStore(data.groupBuyStore);
        setQuantity(String(getFirstAllowedQuantity(data.groupBuyStore.groupBuy)));
      } catch {
        if (!cancelled) {
          setGroupBuyErrorMessage("無法連線到伺服器，請稍後再試。");
        }
      }
    }

    void loadGroupBuy();

    return () => {
      cancelled = true;
    };
  }, [customer, params.groupBuyStoreId]);

  const errorMessage = lineErrorMessage || groupBuyErrorMessage;

  async function handleSubmitOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!groupBuyStore) {
      return;
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setOrderErrorMessage("請輸入正確的訂購數量。");
      return;
    }

    setOrderErrorMessage("");
    setIsSubmittingOrder(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupBuyStoreId: groupBuyStore.id,
          quantity: parsedQuantity,
          note,
        }),
      });
      const data = (await response.json()) as {
        order?: CreatedOrder;
        message?: string;
      };

      if (!response.ok || !data.order) {
        setOrderErrorMessage(data.message ?? "建立訂單失敗，請稍後再試。");
        return;
      }

      setCreatedOrder(data.order);
    } catch {
      setOrderErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmittingOrder(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-5 text-slate-900">
      <section className="mx-auto max-w-lg space-y-5">
        <header className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <p className="text-sm font-semibold text-[#007F83]">{groupBuyStore?.store.name ?? "團購管理系統"}</p>
          <h1 className="mt-2 text-3xl font-bold">{groupBuyStore?.groupBuy.title ?? "團購載入中"}</h1>
          {customer ? (
            <p className="mt-2 text-sm text-slate-600">
              {customer.displayName ? `${customer.displayName}，` : ""}已完成 LINE 身分驗證
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">{status}</p>
          )}
        </header>

        {errorMessage ? (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {customer && !customer.needsPhone && !groupBuyStore && !errorMessage ? (
          <p className="rounded-xl bg-white px-5 py-4 text-slate-600 shadow-sm ring-1 ring-slate-200">
            正在載入指定分店的團購資料…
          </p>
        ) : null}

        {customer?.needsPhone ? (
          <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            請先從 LIFF 首頁完成聯絡電話設定後，再重新開啟團購連結。
          </p>
        ) : null}

        {groupBuyStore ? (
          <>
            <article className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              {groupBuyStore.groupBuy.imageUrls[0] ? (
                // 商品圖片功能尚未串接上傳；有網址時才顯示。
                // eslint-disable-next-line @next/next/no-img-element -- 圖片儲存服務與允許網域尚未定案。
                <img
                  src={groupBuyStore.groupBuy.imageUrls[0]}
                  alt={groupBuyStore.groupBuy.productName}
                  className="aspect-video w-full object-cover"
                />
              ) : null}
              <div className="space-y-4 p-6">
                <div>
                  <p className="text-sm text-slate-500">商品</p>
                  <h2 className="mt-1 text-2xl font-bold">{groupBuyStore.groupBuy.productName}</h2>
                  {groupBuyStore.groupBuy.unit ? (
                    <p className="mt-1 text-sm text-slate-500">單位：{groupBuyStore.groupBuy.unit}</p>
                  ) : null}
                </div>
                {groupBuyStore.groupBuy.content ? (
                  <p className="whitespace-pre-wrap leading-7 text-slate-700">{groupBuyStore.groupBuy.content}</p>
                ) : null}
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-bold text-[#007F83]">
                    NT$ {groupBuyStore.groupBuy.groupPrice}
                  </span>
                  {groupBuyStore.groupBuy.originalPrice ? (
                    <span className="text-sm text-slate-400 line-through">
                      NT$ {groupBuyStore.groupBuy.originalPrice}
                    </span>
                  ) : null}
                </div>
              </div>
            </article>

            <section className="space-y-3 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-lg font-bold">取貨資訊</h2>
              <div className="text-sm leading-6 text-slate-700">
                <p className="font-medium">{groupBuyStore.store.name}</p>
                <p>{groupBuyStore.store.address}</p>
                <p>{groupBuyStore.store.phone}</p>
              </div>
              <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                <p className="font-medium">取貨時間</p>
                <p className="mt-1">{formatDateTime(groupBuyStore.pickupStart)}</p>
                <p>至 {formatDateTime(groupBuyStore.pickupEnd)}</p>
              </div>
            </section>

            {createdOrder ? (
              <section className="rounded-2xl bg-emerald-50 p-6 text-emerald-900 ring-1 ring-emerald-200">
                <h2 className="text-xl font-bold">訂單已成立</h2>
                <p className="mt-3 text-sm">訂單編號：{createdOrder.orderNo}</p>
                <p className="mt-1 text-sm">
                  {createdOrder.productName} × {createdOrder.quantity}，共 {formatCurrency(Number(createdOrder.totalAmount))}
                </p>
                <p className="mt-4 text-sm">請於取貨時間到 {groupBuyStore.store.name} 取貨並現場付款。</p>
                <a
                  href="/liff/orders"
                  className="mt-5 inline-flex rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#00686b]"
                >
                  查看我的訂單
                </a>
              </section>
            ) : (
              <form className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200" onSubmit={handleSubmitOrder}>
                <div>
                  <h2 className="text-lg font-bold">訂購數量</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    最低 {groupBuyStore.groupBuy.minimumQuantity}；每次需為 {groupBuyStore.groupBuy.quantityMultiple} 的倍數。
                    {groupBuyStore.groupBuy.perCustomerLimit
                      ? ` 每人限購 ${groupBuyStore.groupBuy.perCustomerLimit}。`
                      : ""}
                  </p>
                </div>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">數量</span>
                  <input
                    type="number"
                    min={getFirstAllowedQuantity(groupBuyStore.groupBuy)}
                    step={groupBuyStore.groupBuy.quantityMultiple}
                    value={quantity}
                    onChange={(event) => setQuantity(event.target.value)}
                    required
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#007F83] focus:ring-2 focus:ring-[#007F83]/20"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium">備註（選填）</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={500}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#007F83] focus:ring-2 focus:ring-[#007F83]/20"
                    placeholder="例如：請協助備註取貨事項"
                  />
                </label>
                {orderErrorMessage ? (
                  <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                    {orderErrorMessage}
                  </p>
                ) : null}
                <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
                  預估金額：
                  <span className="ml-2 text-lg font-bold text-[#007F83]">
                    {formatCurrency(Number(groupBuyStore.groupBuy.groupPrice) * (Number(quantity) || 0))}
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={isSubmittingOrder}
                  className="w-full rounded-lg bg-[#007F83] px-4 py-3 font-medium text-white transition hover:bg-[#00686b] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingOrder ? "建立訂單中…" : "送出訂單"}
                </button>
              </form>
            )}
          </>
        ) : null}
      </section>
    </main>
  );
}

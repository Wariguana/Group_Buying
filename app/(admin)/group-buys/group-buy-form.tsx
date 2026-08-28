"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type StoreOption = {
  id: string;
  name: string;
  address: string;
};

type GroupBuyFormProps = {
  stores: StoreOption[];
  mode: "HQ" | "STORE";
};

function optionalValue(value: string) {
  return value.trim() ? value.trim() : undefined;
}

export function GroupBuyForm({
  stores,
  mode,
}: GroupBuyFormProps) {
  const isHqGroup = mode === "HQ";
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [unit, setUnit] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [groupPrice, setGroupPrice] = useState("");
  const [perCustomerLimit, setPerCustomerLimit] = useState("");
  const [minimumQuantity, setMinimumQuantity] = useState("1");
  const [quantityMultiple, setQuantityMultiple] = useState("1");
  const [totalQuantityLimit, setTotalQuantityLimit] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [defaultPickupStart, setDefaultPickupStart] = useState("");
  const [defaultPickupEnd, setDefaultPickupEnd] = useState("");
  const [selectedStoreIds, setSelectedStoreIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleStore(storeId: string) {
    setSelectedStoreIds((currentStoreIds) =>
      currentStoreIds.includes(storeId)
        ? currentStoreIds.filter((id) => id !== storeId)
        : [...currentStoreIds, storeId]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isHqGroup && selectedStoreIds.length === 0) {
      setErrorMessage("請至少選擇一間參與門市。");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/group-buys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          content: optionalValue(content),
          imageUrl: optionalValue(imageUrl),
          productName,
          unit: optionalValue(unit),
          originalPrice: optionalValue(originalPrice),
          groupPrice,
          perCustomerLimit: optionalValue(perCustomerLimit),
          minimumQuantity,
          quantityMultiple,
          totalQuantityLimit: optionalValue(totalQuantityLimit),
          startAt: new Date(startAt).toISOString(),
          endAt: new Date(endAt).toISOString(),
          defaultPickupStart: new Date(defaultPickupStart).toISOString(),
          defaultPickupEnd: new Date(defaultPickupEnd).toISOString(),
          ...(isHqGroup ? { storeIds: selectedStoreIds } : {}),
        }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "建立團購草稿失敗。");
        return;
      }

      router.push("/group-buys");
      router.refresh();
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 space-y-8 rounded-2xl bg-white p-6 shadow-sm"
    >
      <section>
        <h2 className="text-xl font-bold">團購與商品資訊</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 md:col-span-2">
            <span className="font-medium">團購標題</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="例如：台糖草莓團"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="font-medium">團購內容</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-28 rounded-lg border border-slate-300 px-3 py-2"
              placeholder="商品說明、注意事項等"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="font-medium">商品圖片網址（可稍後設定）</span>
            <input
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="https://..."
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">商品名稱</span>
            <input
              value={productName}
              onChange={(event) => setProductName(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">單位（可選）</span>
            <input
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="盒、包、斤"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">原價（可選）</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={originalPrice}
              onChange={(event) => setOriginalPrice(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">團購價</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={groupPrice}
              onChange={(event) => setGroupPrice(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">數量限制</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-2">
            <span className="font-medium">每人限購</span>
            <input
              type="number"
              min="1"
              value={perCustomerLimit}
              onChange={(event) => setPerCustomerLimit(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="不限可留空"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">最低訂購量</span>
            <input
              type="number"
              min="1"
              value={minimumQuantity}
              onChange={(event) => setMinimumQuantity(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">數量倍數</span>
            <input
              type="number"
              min="1"
              value={quantityMultiple}
              onChange={(event) => setQuantityMultiple(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">總數量上限</span>
            <input
              type="number"
              min="1"
              value={totalQuantityLimit}
              onChange={(event) => setTotalQuantityLimit(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="不限可留空"
            />
          </label>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold">時間設定</h2>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2">
            <span className="font-medium">團購開始時間</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">團購結束時間</span>
            <input
              type="datetime-local"
              value={endAt}
              onChange={(event) => setEndAt(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">{isHqGroup ? "預設取貨開始時間" : "本店取貨開始時間"}</span>
            <input
              type="datetime-local"
              value={defaultPickupStart}
              onChange={(event) => setDefaultPickupStart(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">{isHqGroup ? "預設取貨結束時間" : "本店取貨結束時間"}</span>
            <input
              type="datetime-local"
              value={defaultPickupEnd}
              onChange={(event) => setDefaultPickupEnd(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>
      </section>
    {isHqGroup ? (
      <section>
        <h2 className="text-xl font-bold">參與門市</h2>
        <p className="mt-2 text-sm text-slate-500">
          建立後每間門市先使用相同的預設取貨時間，之後可個別調整。
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {stores.map((store) => (
            <label
              key={store.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 transition hover:border-[#007F83]"
            >
              <input
                type="checkbox"
                checked={selectedStoreIds.includes(store.id)}
                onChange={() => toggleStore(store.id)}
                className="mt-1 h-4 w-4 accent-[#007F83]"
              />
              <span>
                <span className="block font-medium">{store.name}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  {store.address}
                </span>
              </span>
            </label>
          ))}
        </div>
      </section>
      ) : null}

      {errorMessage ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting || (isHqGroup && stores.length === 0)}
        className="w-full rounded-lg bg-[#007F83] py-3 font-medium text-white transition hover:bg-[#55AFB9] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "建立中…" : "建立草稿"}
      </button>
    </form>
  );
}
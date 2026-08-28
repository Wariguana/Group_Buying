"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type StoreOption = {
  id: string;
  name: string;
  address: string;
  enabled: boolean;
};

type PickupTime = {
  pickupStart: string;
  pickupEnd: string;
};

type EditableGroupBuy = {
  id: string;
  title: string;
  content: string;
  imageUrl: string;
  productName: string;
  unit: string;
  originalPrice: string;
  groupPrice: string;
  perCustomerLimit: string;
  minimumQuantity: string;
  quantityMultiple: string;
  totalQuantityLimit: string;
  startAt: string;
  endAt: string;
  defaultPickupStart: string;
  defaultPickupEnd: string;
  status: string;
  groupBuyStores: Array<{
    storeId: string;
    pickupStart: string;
    pickupEnd: string;
  }>;
};

type GroupBuyEditFormProps = {
  stores: StoreOption[];
  groupBuy: EditableGroupBuy;
  mode: "HQ" | "STORE";
};

function toLocalDateTimeInput(isoValue: string) {
  const date = new Date(isoValue);
  const timezoneOffset = date.getTimezoneOffset();

  return new Date(date.getTime() - timezoneOffset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function optionalValue(value: string) {
  return value.trim() ? value.trim() : undefined;
}

export function GroupBuyEditForm({
  stores,
  groupBuy,
  mode,
}: GroupBuyEditFormProps) {
  const router = useRouter();
  const isHqAdmin = mode === "HQ";

  const [title, setTitle] = useState(groupBuy.title);
  const [content, setContent] = useState(groupBuy.content);
  const [imageUrl, setImageUrl] = useState(groupBuy.imageUrl);
  const [productName, setProductName] = useState(groupBuy.productName);
  const [unit, setUnit] = useState(groupBuy.unit);
  const [originalPrice, setOriginalPrice] = useState(groupBuy.originalPrice);
  const [groupPrice, setGroupPrice] = useState(groupBuy.groupPrice);
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    groupBuy.perCustomerLimit
  );
  const [minimumQuantity, setMinimumQuantity] = useState(
    groupBuy.minimumQuantity
  );
  const [quantityMultiple, setQuantityMultiple] = useState(
    groupBuy.quantityMultiple
  );
  const [totalQuantityLimit, setTotalQuantityLimit] = useState(
    groupBuy.totalQuantityLimit
  );
  const [startAt, setStartAt] = useState(
    toLocalDateTimeInput(groupBuy.startAt)
  );
  const [endAt, setEndAt] = useState(toLocalDateTimeInput(groupBuy.endAt));
  const [defaultPickupStart, setDefaultPickupStart] = useState(
    toLocalDateTimeInput(groupBuy.defaultPickupStart)
  );
  const [defaultPickupEnd, setDefaultPickupEnd] = useState(
    toLocalDateTimeInput(groupBuy.defaultPickupEnd)
  );

  const [selectedStoreIds, setSelectedStoreIds] = useState(
    groupBuy.groupBuyStores.map((groupBuyStore) => groupBuyStore.storeId)
  );

  const [pickupTimes, setPickupTimes] = useState<Record<string, PickupTime>>(
    Object.fromEntries(
      groupBuy.groupBuyStores.map((groupBuyStore) => [
        groupBuyStore.storeId,
        {
          pickupStart: toLocalDateTimeInput(groupBuyStore.pickupStart),
          pickupEnd: toLocalDateTimeInput(groupBuyStore.pickupEnd),
        },
      ])
    )
  );

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleStore(storeId: string) {
    const isSelected = selectedStoreIds.includes(storeId);

    if (isSelected) {
      setSelectedStoreIds((currentStoreIds) =>
        currentStoreIds.filter((id) => id !== storeId)
      );

      setPickupTimes((currentPickupTimes) => {
        const nextPickupTimes = { ...currentPickupTimes };
        delete nextPickupTimes[storeId];
        return nextPickupTimes;
      });

      return;
    }

    setSelectedStoreIds((currentStoreIds) => [...currentStoreIds, storeId]);

    setPickupTimes((currentPickupTimes) => ({
      ...currentPickupTimes,
      [storeId]: {
        pickupStart: defaultPickupStart,
        pickupEnd: defaultPickupEnd,
      },
    }));
  }

  function updatePickupTime(
    storeId: string,
    field: keyof PickupTime,
    value: string
  ) {
    setPickupTimes((currentPickupTimes) => ({
      ...currentPickupTimes,
      [storeId]: {
        ...currentPickupTimes[storeId],
        [field]: value,
      },
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (selectedStoreIds.length === 0) {
      setErrorMessage("請至少選擇一間參與門市。");
      return;
    }

    const hasIncompletePickupTime = selectedStoreIds.some((storeId) => {
      const pickupTime = pickupTimes[storeId];

      return !pickupTime?.pickupStart || !pickupTime?.pickupEnd;
    });

    if (hasIncompletePickupTime) {
      setErrorMessage("請完整填寫每間參與門市的取貨時間。");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/group-buys/${groupBuy.id}`, {
        method: "PATCH",
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
          stores: selectedStoreIds.map((storeId) => ({
            storeId,
            pickupStart: new Date(
              isHqAdmin
                ? pickupTimes[storeId].pickupStart
                : defaultPickupStart
            ).toISOString(),
            pickupEnd: new Date(
              isHqAdmin ? pickupTimes[storeId].pickupEnd : defaultPickupEnd
            ).toISOString(),
          })),
        }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "更新團購失敗。");
        return;
      }

      router.push(`/group-buys/${groupBuy.id}`);
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
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="font-medium">團購內容</span>
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              className="min-h-28 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2 md:col-span-2">
            <span className="font-medium">商品圖片網址（可留空）</span>
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
            <span className="font-medium">
              {isHqAdmin ? "預設取貨開始時間" : "本店取貨開始時間"}
            </span>
            <input
              type="datetime-local"
              value={defaultPickupStart}
              onChange={(event) => setDefaultPickupStart(event.target.value)}
              required
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-2">
            <span className="font-medium">
              {isHqAdmin ? "預設取貨結束時間" : "本店取貨結束時間"}
            </span>
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

      {isHqAdmin ? (
        <section>
          <h2 className="text-xl font-bold">參與門市與個別取貨時間</h2>
          <p className="mt-2 text-sm text-slate-500">
            新加入的門市會先使用預設取貨時間；每間門市可在下方各自調整。
          </p>

          <div className="mt-4 space-y-3">
            {stores.map((store) => {
              const isSelected = selectedStoreIds.includes(store.id);
              const pickupTime = pickupTimes[store.id];

              return (
                <div
                  key={store.id}
                  className={`rounded-xl border p-4 ${
                    isSelected
                      ? "border-[#007F83] bg-[#007F83]/5"
                      : "border-slate-200"
                  }`}
                >
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      disabled={!store.enabled && !isSelected}
                      onChange={() => toggleStore(store.id)}
                      className="mt-1 h-4 w-4 accent-[#007F83]"
                    />

                    <span>
                      <span className="font-bold">{store.name}</span>
                      {!store.enabled ? (
                        <span className="ml-2 text-sm text-rose-600">
                          已停用
                        </span>
                      ) : null}
                      <span className="mt-1 block text-sm text-slate-500">
                        {store.address}
                      </span>
                    </span>
                  </label>

                  {isSelected && pickupTime ? (
                    <div className="mt-4 grid gap-4 border-t border-slate-200 pt-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">
                          {store.name}取貨開始時間
                        </span>
                        <input
                          type="datetime-local"
                          value={pickupTime.pickupStart}
                          onChange={(event) =>
                            updatePickupTime(
                              store.id,
                              "pickupStart",
                              event.target.value
                            )
                          }
                          required
                          className="rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">
                          {store.name}取貨結束時間
                        </span>
                        <input
                          type="datetime-local"
                          value={pickupTime.pickupEnd}
                          onChange={(event) =>
                            updatePickupTime(
                              store.id,
                              "pickupEnd",
                              event.target.value
                            )
                          }
                          required
                          className="rounded-lg border border-slate-300 px-3 py-2"
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
              );
            })}
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
        disabled={isSubmitting || selectedStoreIds.length === 0}
        className="w-full rounded-lg bg-[#007F83] py-3 font-medium text-white transition hover:bg-[#55AFB9] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "儲存中…" : "儲存變更"}
      </button>
    </form>
  );
}

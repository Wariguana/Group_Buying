"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { toTaiwanDateInputValue } from "@/app/lib/date";

type StorePickupTimeFormProps = {
  groupBuyId: string;
  pickupStart: string;
  pickupEnd: string;
};

export function StorePickupTimeForm({
  groupBuyId,
  pickupStart: initialPickupStart,
  pickupEnd: initialPickupEnd,
}: StorePickupTimeFormProps) {
  const router = useRouter();
  const [pickupStart, setPickupStart] = useState(
    toTaiwanDateInputValue(initialPickupStart)
  );
  const [pickupEnd, setPickupEnd] = useState(
    toTaiwanDateInputValue(initialPickupEnd)
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pickupStart || !pickupEnd) {
      setErrorMessage("請完整填寫取貨開始與結束日期。");
      return;
    }

    if (pickupEnd < pickupStart) {
      setErrorMessage("取貨結束日期不可早於開始日期。");
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `/api/group-buys/${groupBuyId}/pickup-time`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            pickupStart,
            pickupEnd,
          }),
        }
      );

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "更新取貨日期失敗。" );
        return;
      }

      router.push(`/group-buys/${groupBuyId}`);
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
      className="mt-8 space-y-6 rounded-2xl bg-white p-6 shadow-sm"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="font-medium">取貨開始日期</span>
          <input
            type="date"
            value={pickupStart}
            onChange={(event) => setPickupStart(event.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-2">
          <span className="font-medium">取貨結束日期</span>
          <input
            type="date"
            value={pickupEnd}
            onChange={(event) => setPickupEnd(event.target.value)}
            required
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isSubmitting}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          取消
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "儲存中…" : "儲存取貨日期"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderArrivalActionsProps = {
  groupBuyStoreId: string;
  orderedCount: number;
};

export function OrderArrivalActions({
  groupBuyStoreId,
  orderedCount,
}: OrderArrivalActionsProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleArrival() {
    if (!window.confirm(`確定要將這一團本店的 ${orderedCount} 筆「已訂購」訂單全部標記為「已到貨」嗎？`)) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/group-buy-stores/${groupBuyStoreId}/arrive`, { method: "POST" });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "標記到貨失敗。請稍後再試。");
        return;
      }

      setSuccessMessage(data.message ?? "已標記為已到貨。");
      router.refresh();
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        disabled={orderedCount === 0 || isSubmitting}
        onClick={handleArrival}
        className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "處理中…" : "本團標記已到貨"}
      </button>

      <p className="text-xs text-slate-500">
        {orderedCount > 0 ? `將更新 ${orderedCount} 筆已訂購訂單` : "目前沒有待到貨訂單"}
      </p>

      {successMessage ? <p className="text-sm text-emerald-700">{successMessage}</p> : null}
      {errorMessage ? <p className="text-sm text-rose-600">{errorMessage}</p> : null}
    </div>
  );
}

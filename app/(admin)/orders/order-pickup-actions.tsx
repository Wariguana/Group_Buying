"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderPickupActionsProps = {
  orderId: string;
  status: string;
};

export function OrderPickupActions({
  orderId,
  status,
}: OrderPickupActionsProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handlePickup() {
    if (!window.confirm("確定這筆訂單已取貨並完成付款嗎？")) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/orders/${orderId}/pickup`, {
        method: "POST",
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "更新訂單狀態失敗。請稍後再試。");
        return;
      }

      router.refresh();
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (status !== "ARRIVED") {
    return null;
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={isSubmitting}
        onClick={handlePickup}
        className="rounded-lg border border-[#007F83] px-3 py-2 text-xs font-medium text-[#007F83] transition hover:bg-[#007F83] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "處理中…" : "已取貨並付款"}
      </button>

      {errorMessage ? (
        <p className="text-xs text-rose-600">{errorMessage}</p>
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type StatusAction = "PUBLISH" | "PAUSE" | "END";

type GroupBuyStatusActionsProps = {
  groupBuyId: string;
  status: string;
};

const actionConfig: Record<
  StatusAction,
  {
    label: string;
    confirmMessage: string;
    className: string;
  }
> = {
  PUBLISH: {
    label: "發布",
    confirmMessage: "確定要發布此團購嗎？目前第一版只會更新狀態，不會發送 LINE。",
    className: "bg-[#007F83] text-white hover:bg-[#55AFB9]",
  },
  PAUSE: {
    label: "暫停",
    confirmMessage: "確定要暫停此團購嗎？客戶端將暫時無法下單。",
    className: "bg-amber-500 text-white hover:bg-amber-600",
  },
  END: {
    label: "結束",
    confirmMessage: "確定要結束此團購嗎？結束後目前不能重新開啟。",
    className: "bg-rose-600 text-white hover:bg-rose-700",
  },
};

function getAvailableActions(status: string): StatusAction[] {
  if (status === "DRAFT") {
    return ["PUBLISH", "END"];
  }

  if (status === "PUBLISHED") {
    return ["PAUSE", "END"];
  }

  if (status === "PAUSED") {
    return ["PUBLISH", "END"];
  }

  return [];
}

export function GroupBuyStatusActions({
  groupBuyId,
  status,
}: GroupBuyStatusActionsProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const actions = getAvailableActions(status);

  async function handleAction(action: StatusAction) {
    const config = actionConfig[action];

    if (!window.confirm(config.confirmMessage)) {
      return;
    }

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/group-buys/${groupBuyId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "更新團購狀態失敗。");
        return;
      }

      router.refresh();
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (actions.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {actions.map((action) => {
        const config = actionConfig[action];

        return (
          <button
            key={action}
            type="button"
            disabled={isSubmitting}
            onClick={() => handleAction(action)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${config.className}`}
          >
            {isSubmitting ? "處理中…" : config.label}
          </button>
        );
      })}

      {errorMessage ? (
        <p className="w-full text-right text-sm text-rose-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
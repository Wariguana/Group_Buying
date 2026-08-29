"use client";

import liff from "@line/liff";
import { useEffect, useState } from "react";

export type LineCustomer = {
  displayName: string | null;
  needsPhone: boolean;
};

export function useLineCustomer() {
  const [status, setStatus] = useState("正在啟動 LINE…");
  const [errorMessage, setErrorMessage] = useState("");
  const [customer, setCustomer] = useState<LineCustomer | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function authenticateWithLine() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

      if (!liffId) {
        setErrorMessage("系統尚未設定 LIFF ID。請聯絡管理員。");
        return;
      }

      try {
        await liff.init({ liffId });

        if (cancelled) {
          return;
        }

        if (!liff.isLoggedIn() && !liff.isInClient()) {
          setStatus("正在導向 LINE 登入…");
          liff.login({ redirectUri: window.location.href });
          return;
        }

        setStatus("正在取得 LINE 身分資訊…");
        const idToken = liff.getIDToken();

        if (!idToken) {
          setErrorMessage("無法取得 LINE 身分資訊，請從 LINE 重新開啟此頁。");
          return;
        }

        setStatus("正在由系統驗證 LINE 身分…");
        const abortController = new AbortController();
        const timeout = window.setTimeout(() => abortController.abort(), 15_000);
        let response: Response;

        try {
          response = await fetch("/api/line-auth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken }),
            signal: abortController.signal,
          });
        } finally {
          window.clearTimeout(timeout);
        }

        const data = (await response.json()) as {
          customer?: LineCustomer;
          message?: string;
        };

        if (cancelled) {
          return;
        }

        if (!response.ok || !data.customer) {
          setErrorMessage(data.message ?? "LINE 身分驗證失敗，請稍後再試。");
          return;
        }

        setCustomer(data.customer);
        setStatus("LINE 身分確認完成");
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof DOMException && error.name === "AbortError"
            ? "LINE 身分驗證逾時，請確認網路後重新開啟頁面。"
            : "無法初始化 LINE 登入，請從 LINE 重新開啟此頁。",
        );
      }
    }

    void authenticateWithLine();

    return () => {
      cancelled = true;
    };
  }, []);

  function markPhoneCompleted() {
    setCustomer((current) =>
      current ? { ...current, needsPhone: false } : current,
    );
    setStatus("資料已完成，可以開始下單。");
  }

  return {
    customer,
    errorMessage,
    markPhoneCompleted,
    status,
  };
}

"use client";

import liff from "@line/liff";
import { FormEvent, useEffect, useState } from "react";

type CustomerState = {
  displayName: string | null;
  needsPhone: boolean;
};

export default function LiffPage() {
  const [status, setStatus] = useState("正在確認 LINE 身分…");
  const [errorMessage, setErrorMessage] = useState("");
  const [customer, setCustomer] = useState<CustomerState | null>(null);
  const [phone, setPhone] = useState("");
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);

  useEffect(() => {
    async function authenticateWithLine() {
      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

      if (!liffId) {
        setErrorMessage("系統尚未設定 LIFF ID。請聯絡管理員。");
        return;
      }

      try {
        await liff.init({ liffId });

        if (!liff.isLoggedIn() && !liff.isInClient()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();

        if (!idToken) {
          setErrorMessage("無法取得 LINE 身分資訊，請從 LINE 重新開啟此頁。");
          return;
        }

        const response = await fetch("/api/line-auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const data = (await response.json()) as {
          customer?: CustomerState;
          message?: string;
        };

        if (!response.ok || !data.customer) {
          setErrorMessage(data.message ?? "LINE 身分驗證失敗，請稍後再試。");
          return;
        }

        setCustomer(data.customer);
        setStatus("LINE 身分確認完成");
      } catch {
        setErrorMessage("無法初始化 LINE 登入，請從 LINE 重新開啟此頁。");
      }
    }

    void authenticateWithLine();
  }, []);

  async function handleSubmitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmittingPhone(true);

    try {
      const response = await fetch("/api/customer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "手機資料儲存失敗，請稍後再試。");
        return;
      }

      setCustomer((current) =>
        current ? { ...current, needsPhone: false } : current,
      );
      setStatus("資料已完成，可以開始下單。");
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmittingPhone(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-[#007F83]">團購管理系統</p>
        <h1 className="mt-2 text-3xl font-bold">LINE 客戶驗證</h1>

        {errorMessage ? (
          <p className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {errorMessage}
          </p>
        ) : null}

        {!customer && !errorMessage ? (
          <p className="mt-6 text-slate-600">{status}</p>
        ) : null}

        {customer && customer.needsPhone ? (
          <form className="mt-6 space-y-5" onSubmit={handleSubmitPhone}>
            <p className="text-slate-600">
              {customer.displayName ? `${customer.displayName}，` : ""}第一次使用時，請先留下聯絡電話。
            </p>
            <label className="block space-y-2">
              <span className="text-sm font-medium">聯絡電話</span>
              <input
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                autoComplete="tel"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-[#007F83] focus:ring-2 focus:ring-[#007F83]/20"
                placeholder="例如：0912-345-678"
              />
            </label>
            <button
              type="submit"
              disabled={isSubmittingPhone}
              className="w-full rounded-lg bg-[#007F83] px-4 py-3 font-medium text-white transition hover:bg-[#00686b] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmittingPhone ? "儲存中…" : "完成資料"}
            </button>
          </form>
        ) : null}

        {customer && !customer.needsPhone ? (
          <div className="mt-6 rounded-lg bg-emerald-50 px-4 py-4 text-emerald-800">
            <p className="font-medium">{status}</p>
            <p className="mt-1 text-sm">下單頁面完成後，系統會從這裡帶你前往對應門市的團購。</p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

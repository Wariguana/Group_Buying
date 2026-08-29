"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useLineCustomer } from "@/app/liff/use-line-customer";

export default function LiffPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
          <p className="text-slate-600">正在載入 LINE 客戶資料…</p>
        </main>
      }
    >
      <LiffPageContent />
    </Suspense>
  );
}

function LiffPageContent() {
  const { customer, errorMessage, markPhoneCompleted, status } =
    useLineCustomer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [phoneErrorMessage, setPhoneErrorMessage] = useState("");
  const [isSubmittingPhone, setIsSubmittingPhone] = useState(false);
  const requestedReturnPath = searchParams.get("returnTo");
  const returnPath =
    requestedReturnPath?.startsWith("/buy/") &&
    !requestedReturnPath.startsWith("//")
      ? requestedReturnPath
      : null;

  useEffect(() => {
    if (customer && !customer.needsPhone && returnPath) {
      router.replace(returnPath);
    }
  }, [customer, returnPath, router]);

  async function handleSubmitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPhoneErrorMessage("");
    setIsSubmittingPhone(true);

    try {
      const response = await fetch("/api/customer-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setPhoneErrorMessage(data.message ?? "手機資料儲存失敗，請稍後再試。");
        return;
      }

      markPhoneCompleted();
      if (returnPath) {
        router.replace(returnPath);
      }
    } catch {
      setPhoneErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmittingPhone(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
        <p className="text-sm font-semibold text-[#007F83]">團購管理系統</p>
        <h1 className="mt-2 text-3xl font-bold">LINE 客戶驗證</h1>

        {errorMessage || phoneErrorMessage ? (
          <p
            className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            role="alert"
          >
            {errorMessage || phoneErrorMessage}
          </p>
        ) : null}

        {!customer && !errorMessage ? (
          <p className="mt-6 text-slate-600">{status}</p>
        ) : null}

        {customer && customer.needsPhone ? (
          <form className="mt-6 space-y-5" onSubmit={handleSubmitPhone}>
            <p className="text-slate-600">
              {customer.displayName ? `${customer.displayName}，` : ""}
              第一次使用時，請先留下聯絡電話。
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
            <p className="mt-1 text-sm">
              下單頁面完成後，系統會從這裡帶你前往對應門市的團購。
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsError(false);

    if (newPassword !== confirmPassword) {
      setIsError(true);
      setMessage("新密碼與確認密碼不一致。");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/account/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result: unknown = await response.json().catch(() => null);
      const responseMessage =
        typeof result === "object" &&
        result !== null &&
        "message" in result &&
        typeof result.message === "string"
          ? result.message
          : "無法更新密碼，請稍後再試。";

      if (!response.ok) {
        setIsError(true);
        setMessage(responseMessage);
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMessage(responseMessage);
    } catch {
      setIsError(true);
      setMessage("網路連線失敗，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <p className="text-sm font-medium text-[#007F83]">帳號設定</p>
      <h1 className="mt-2 text-3xl font-bold text-slate-900">修改密碼</h1>
      <p className="mt-3 text-slate-600">
        請輸入目前密碼驗證身分，再設定新的登入密碼。
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium text-slate-700">
          目前密碼
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-[#007F83] focus:ring-2 focus:ring-[#007F83]/20"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          新密碼
          <input
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            required
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-[#007F83] focus:ring-2 focus:ring-[#007F83]/20"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-slate-700">
          確認新密碼
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            className="rounded-lg border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-[#007F83] focus:ring-2 focus:ring-[#007F83]/20"
          />
        </label>

        {message ? (
          <p
            className={`rounded-lg px-4 py-3 text-sm ${
              isError
                ? "bg-red-50 text-red-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
            role="status"
          >
            {message}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-3 pt-2">
          <Link
            href="/home"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            取消
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-[#007F83] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#55AFB9] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "儲存中…" : "儲存新密碼"}
          </button>
        </div>
      </form>
    </section>
  );
}

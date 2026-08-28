"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function StoreForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [lineGroupId, setLineGroupId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/stores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          address,
          phone,
          lineGroupId,
        }),
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "新增門市失敗。");
        return;
      }

      setName("");
      setAddress("");
      setPhone("");
      setLineGroupId("");
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
      className="mt-6 grid gap-4 rounded-2xl bg-white p-6 shadow sm:grid-cols-2"
    >
      <h2 className="sm:col-span-2 text-xl font-bold">新增門市</h2>

      <label className="grid gap-2">
        <span className="font-medium">門市名稱</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </label>

      <label className="grid gap-2">
        <span className="font-medium">電話</span>
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </label>

      <label className="grid gap-2 sm:col-span-2">
        <span className="font-medium">地址</span>
        <input
          value={address}
          onChange={(event) => setAddress(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
          required
        />
      </label>

      <label className="grid gap-2 sm:col-span-2">
        <span className="font-medium">LINE 群組 ID（可稍後設定）</span>
        <input
          value={lineGroupId}
          onChange={(event) => setLineGroupId(event.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {errorMessage ? (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="sm:col-span-2 rounded-lg bg-[#007F83] py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "新增中…" : "新增門市"}
      </button>
    </form>
  );
}
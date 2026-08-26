"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Store = {
  id: string;
  name: string;
  address: string;
  phone: string;
  lineGroupId: string | null;
  enabled: boolean;
};

type StoreEditFormProps = {
  store: Store;
};

export function StoreEditForm({ store }: StoreEditFormProps) {
  const router = useRouter();
  const [name, setName] = useState(store.name);
  const [address, setAddress] = useState(store.address);
  const [phone, setPhone] = useState(store.phone);
  const [lineGroupId, setLineGroupId] = useState(store.lineGroupId ?? "");
  const [enabled, setEnabled] = useState(store.enabled);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/stores/${store.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, address, phone, lineGroupId, enabled }),
      });
      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setErrorMessage(data.message ?? "更新門市失敗。");
        return;
      }

      router.replace("/stores");
      router.refresh();
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 grid gap-4 rounded-2xl bg-white p-6 shadow sm:grid-cols-2">
      <label className="grid gap-2">
        <span className="font-medium">門市名稱</span>
        <input value={name} onChange={(event) => setName(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" required />
      </label>

      <label className="grid gap-2">
        <span className="font-medium">電話</span>
        <input value={phone} onChange={(event) => setPhone(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" required />
      </label>

      <label className="grid gap-2 sm:col-span-2">
        <span className="font-medium">地址</span>
        <input value={address} onChange={(event) => setAddress(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" required />
      </label>

      <label className="grid gap-2 sm:col-span-2">
        <span className="font-medium">LINE 群組 ID</span>
        <input value={lineGroupId} onChange={(event) => setLineGroupId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
      </label>

      <label className="flex items-center gap-3 sm:col-span-2">
        <input type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} className="size-4 accent-[#007F83]" />
        <span className="font-medium">啟用這間門市</span>
      </label>

      {errorMessage ? <p className="sm:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{errorMessage}</p> : null}

      <button type="submit" disabled={isSubmitting} className="sm:col-span-2 rounded-lg bg-[#007F83] py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-60">
        {isSubmitting ? "儲存中…" : "儲存變更"}
      </button>
    </form>
  );
}

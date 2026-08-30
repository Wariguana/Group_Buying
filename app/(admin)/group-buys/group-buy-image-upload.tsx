"use client";

import { ChangeEvent, useState } from "react";

type GroupBuyImageUploadProps = {
  imageUrl: string;
  onChange: (imageUrl: string) => void;
};

export function GroupBuyImageUpload({
  imageUrl,
  onChange,
}: GroupBuyImageUploadProps) {
  const [errorMessage, setErrorMessage] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const image = event.target.files?.[0];
    event.target.value = "";

    if (!image) {
      return;
    }

    setErrorMessage("");
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.set("image", image);

      const response = await fetch("/api/uploads/group-buy-image", {
        method: "POST",
        body: formData,
      });
      const data: unknown = await response.json().catch(() => null);
      const message =
        typeof data === "object" &&
        data !== null &&
        "message" in data &&
        typeof data.message === "string"
          ? data.message
          : "圖片上傳失敗，請稍後再試。";

      if (!response.ok) {
        setErrorMessage(message);
        return;
      }

      if (
        typeof data !== "object" ||
        data === null ||
        !("imageUrl" in data) ||
        typeof data.imageUrl !== "string"
      ) {
        setErrorMessage("圖片上傳失敗，請稍後再試。");
        return;
      }

      onChange(data.imageUrl);
    } catch {
      setErrorMessage("無法連線到伺服器，請稍後再試。");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-4">
      {imageUrl ? (
        <div className="flex flex-wrap items-start gap-4">
          {/* 上傳後的 Supabase 公開圖片與既有外部網址都需要預覽。 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="商品圖片預覽"
            className="h-28 w-40 rounded-lg border border-slate-200 object-cover"
          />
          <div className="space-y-2">
            <p className="text-sm text-slate-600">已選擇商品圖片。</p>
            <label className="inline-flex cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
              {isUploading ? "上傳中…" : "替換圖片"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={isUploading}
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={isUploading}
              className="ml-2 text-sm font-medium text-rose-700 underline disabled:opacity-60"
            >
              移除圖片
            </button>
          </div>
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg bg-slate-50 px-4 py-6 text-center">
          <span className="font-medium text-slate-800">
            {isUploading ? "圖片上傳中…" : "選擇商品圖片"}
          </span>
          <span className="text-sm text-slate-500">支援 JPG、PNG、WebP，最大 5MB</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={isUploading}
            onChange={handleFileChange}
            className="sr-only"
          />
        </label>
      )}

      {errorMessage ? (
        <p className="mt-3 text-sm text-rose-700">{errorMessage}</p>
      ) : null}
    </div>
  );
}

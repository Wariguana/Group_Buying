"use client";

import { useState } from "react";

type ExportButtonProps = {
  href: string;
};

function getDownloadFileName(
  contentDisposition: string | null,
) {
  if (!contentDisposition) {
    return "report.xlsx";
  }

  const utf8Match = contentDisposition.match(
    /filename\*=UTF-8''([^;]+)/i,
  );

  if (utf8Match?.[1]) {
    try {
      return decodeURIComponent(
        utf8Match[1].replace(/["']/g, ""),
      );
    } catch {
      // 如果解析失敗，繼續嘗試一般 filename
    }
  }

  const fileNameMatch = contentDisposition.match(
    /filename="?([^";]+)"?/i,
  );

  return fileNameMatch?.[1] ?? "report.xlsx";
}

export function ExportButton({
  href,
}: ExportButtonProps) {
  const [isExporting, setIsExporting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  async function handleExport() {
    if (isExporting) {
      return;
    }

    setIsExporting(true);
    setErrorMessage("");

    try {
      const response = await fetch(href, {
        method: "GET",
        credentials: "same-origin",
      });

      if (!response.ok) {
        let message = "匯出 Excel 失敗，請稍後再試。";

        try {
          const data = (await response.json()) as {
            message?: string;
          };

          if (data.message) {
            message = data.message;
          }
        } catch {
          // API 沒有回 JSON 時使用預設錯誤訊息
        }

        throw new Error(message);
      }

      const blob = await response.blob();

      const fileName = getDownloadFileName(
        response.headers.get(
          "Content-Disposition",
        ),
      );

      const objectUrl =
        URL.createObjectURL(blob);

      const link =
        document.createElement("a");

      link.href = objectUrl;
      link.download = fileName;

      document.body.appendChild(link);

      link.click();
      link.remove();

      window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
      }, 1000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "匯出 Excel 失敗，請稍後再試。",
      );
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="min-w-30 rounded-lg border border-[#007F83] px-4 py-2 text-sm font-medium text-[#007F83] transition hover:bg-[#e6f4f4] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isExporting
          ? "正在產生 Excel…"
          : "匯出 Excel"}
      </button>

      {errorMessage ? (
        <p className="text-xs text-rose-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
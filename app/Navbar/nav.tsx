"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type AdminNavProps = {
  username: string;
  role: "HQ_ADMIN" | "STORE_ADMIN";
};

export function AdminNav({ username, role }: AdminNavProps) {
  const router = useRouter();
  const isHqAdmin = role === "HQ_ADMIN";

  async function handleLogout() {
    await fetch("/api/logout", {
      method: "POST",
    });

    router.push("/");
    router.refresh();
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-8">
          <Link href="/home" className="text-lg font-bold text-[#007F83]">
            團購管理系統
          </Link>

          <nav className="flex items-center gap-2 text-sm font-medium">
            {isHqAdmin ? (
              <Link
                href="/stores"
                className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
              >
                門市管理
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="僅限總公司管理員使用"
                className="cursor-not-allowed rounded-lg px-3 py-2 text-slate-400 opacity-60"
              >
                門市管理
              </button>
            )}

            <Link
              href="/group-buys"
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
            >
              團購管理
            </Link>
            <Link
              href="/reports"
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
            >
              報表
            </Link>
            <Link
              href="/orders"
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
            >
              訂單管理
            </Link>
            <Link
              href="/customers"
              className="rounded-lg px-3 py-2 text-slate-700 transition hover:bg-slate-100"
            >
              團友管理
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-right text-sm sm:block">
            <p className="font-medium text-slate-800">{username}</p>
            <p className="text-xs text-slate-500">
              {isHqAdmin ? "總公司管理員" : "分店管理員"}
            </p>
          </div>

          <Link
            href="/account/password"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            修改密碼
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            登出
          </button>
        </div>
      </div>
    </header>
  );
}

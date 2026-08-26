import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const roleLabel = user.role === "HQ_ADMIN" ? "總公司管理員" : "分店管理員";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <main className="w-full max-w-2xl rounded-2xl bg-white p-8 shadow-lg">
        <p className="text-sm font-medium text-[#007F83]">團購管理系統</p>
        <h1 className="mt-2 text-3xl font-bold">歡迎回來，{user.username}</h1>
        <p className="mt-3 text-slate-600">你目前以「{roleLabel}」身分登入。</p>
        <p className="mt-8 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          管理後台功能將從門市管理開始建立。
        </p>
      </main>
    </div>
  );
}

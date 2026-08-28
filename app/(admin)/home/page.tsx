import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const roleLabel =
    user.role === "HQ_ADMIN" ? "總公司管理員" : "分店管理員";

  return (
    <>
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          團購管理系統
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          歡迎回來，{user.username}
        </h1>

        <p className="mt-3 text-slate-600">
          你目前以「{roleLabel}」身分登入。
        </p>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">進行中團購</p>
          <p className="mt-2 text-3xl font-bold">—</p>
          <p className="mt-2 text-sm text-slate-500">
            團購管理完成後顯示資料。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">待處理訂單</p>
          <p className="mt-2 text-3xl font-bold">—</p>
          <p className="mt-2 text-sm text-slate-500">
            訂單功能完成後顯示資料。
          </p>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">本期營業額</p>
          <p className="mt-2 text-3xl font-bold">—</p>
          <p className="mt-2 text-sm text-slate-500">
            報表功能完成後顯示資料。
          </p>
        </div>
      </section>
    </>
  );
}

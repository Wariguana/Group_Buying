import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { formatTaiwanDate } from "@/app/lib/date";
import { prisma } from "@/app/lib/prisma";

type CustomersPageProps = {
  searchParams: Promise<{ page?: string; query?: string }>;
};

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  if (user.role !== "HQ_ADMIN" && !user.storeId) redirect("/home");

  const params = await searchParams;
  const isHqAdmin = user.role === "HQ_ADMIN";
  const query = params.query?.trim().slice(0, 100) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 100;
  const storeScope = isHqAdmin
    ? {}
    : { orders: { some: { groupBuyStore: { storeId: user.storeId! } } } };
  const searchScope = query
    ? {
        OR: [
          { displayName: { contains: query, mode: "insensitive" as const } },
          { phone: { contains: query } },
        ],
      }
    : {};
  const customers = await prisma.customer.findMany({
    where: { AND: [storeScope, searchScope] },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize + 1,
    select: { id: true, displayName: true, phone: true, createdAt: true },
  });
  const hasNextPage = customers.length > pageSize;
  const visibleCustomers = hasNextPage ? customers.slice(0, pageSize) : customers;
  const pageSearchParams = new URLSearchParams();
  if (query) pageSearchParams.set("query", query);
  const hrefForPage = (targetPage: number) => {
    const nextParams = new URLSearchParams(pageSearchParams);
    nextParams.set("page", String(targetPage));
    return `/customers?${nextParams}`;
  };

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          {isHqAdmin ? "總公司管理" : "分店管理"}
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900">團友管理</h1>
        <p className="mt-3 text-slate-600">
          {isHqAdmin ? "查看所有已加入系統的團友資料。" : "顯示曾在本店下單的團友資料。"}
        </p>

        <form className="mt-6 flex flex-wrap gap-3 rounded-xl bg-slate-50 p-4">
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            團友名稱或電話
            <input type="search" name="query" defaultValue={query} placeholder="搜尋名稱或電話" className="rounded-lg border border-slate-300 bg-white px-3 py-2" />
          </label>
          <div className="flex items-end gap-3">
            <button type="submit" className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]">搜尋</button>
            <Link href="/customers" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white">清除</Link>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-100 text-slate-700"><tr><th className="px-4 py-3">團友名稱</th><th className="px-4 py-3">電話</th><th className="px-4 py-3">加入日期</th></tr></thead>
            <tbody className="divide-y divide-slate-200">
              {visibleCustomers.map((customer) => (
                <tr key={customer.id} className="text-slate-700">
                  <td className="px-4 py-3 font-medium">{customer.displayName ?? "LINE 團友"}</td>
                  <td className="px-4 py-3">{customer.phone ?? "未填寫"}</td>
                  <td className="px-4 py-3">{formatTaiwanDate(customer.createdAt)}</td>
                </tr>
              ))}
              {visibleCustomers.length === 0 ? <tr><td colSpan={3} className="px-4 py-10 text-center text-slate-500">沒有符合條件的團友資料。</td></tr> : null}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>第 {page} 頁，每頁最多 {pageSize} 位團友。</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={hrefForPage(page - 1)} className="rounded border px-3 py-2">上一頁</Link> : null}
            {hasNextPage ? <Link href={hrefForPage(page + 1)} className="rounded border px-3 py-2">下一頁</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/lib/auth";
import { StoreForm } from "@/app/(admin)/stores/store-form";
import { prisma } from "@/app/lib/prisma";

export default async function StoresPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "HQ_ADMIN") {
    redirect("/home");
  }

  const stores = await prisma.store.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      lineGroupId: true,
      enabled: true,
    },
  });

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <h1 className="text-3xl font-bold">門市管理</h1>
      <p className="mt-2 text-slate-600">總公司可查看、新增、編輯與停用所有分店。</p>

      <StoreForm />

      <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow">
        <table className="w-full text-left">
            <thead className="bg-slate-100 text-sm text-slate-600">
              <tr>
                <th className="px-5 py-4">門市名稱</th>
                <th className="px-5 py-4">地址</th>
                <th className="px-5 py-4">電話</th>
                <th className="px-5 py-4">LINE 群組</th>
                <th className="px-5 py-4">狀態</th>
                <th className="px-5 py-4">操作</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.id} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-medium">{store.name}</td>
                  <td className="px-5 py-4">{store.address}</td>
                  <td className="px-5 py-4">{store.phone}</td>
                  <td className="px-5 py-4">
                    {store.lineGroupId ? "已設定" : "未設定"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${
                        store.enabled
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {store.enabled ? "啟用" : "停用"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/stores/${store.id}`}
                      className="font-medium text-[#007F83] hover:underline"
                    >
                      編輯
                    </Link>
                  </td>
                </tr>
              ))}

              {stores.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-500">
                    目前沒有門市資料。
                  </td>
                </tr>
              ) : null}
            </tbody>
        </table>
      </div>
    </section>
  );
}

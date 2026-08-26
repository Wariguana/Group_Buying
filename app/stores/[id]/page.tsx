import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { StoreEditForm } from "@/app/stores/store-edit-form";

type StoreEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StoreEditPage({ params }: StoreEditPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "HQ_ADMIN") {
    redirect("/home");
  }

  const { id } = await params;
  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      lineGroupId: true,
      enabled: true,
    },
  });

  if (!store) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900">
      <section className="mx-auto max-w-2xl">
        <Link href="/stores" className="text-sm font-medium text-[#007F83] hover:underline">
          ← 回到門市管理
        </Link>
        <h1 className="mt-4 text-3xl font-bold">編輯門市</h1>
        <p className="mt-2 text-slate-600">修改門市資訊或調整啟用狀態。</p>
        <StoreEditForm store={store} />
      </section>
    </main>
  );
}

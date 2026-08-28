import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { StorePickupTimeForm } from "@/app/(admin)/group-buys/store-pickup-time-form";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type StorePickupTimePageProps = {
  params: Promise<{ id: string }>;
};

export default async function StorePickupTimePage({
  params,
}: StorePickupTimePageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "STORE_ADMIN" || !user.storeId) {
    redirect("/group-buys");
  }

  const { id } = await params;

  const groupBuyStore = await prisma.groupBuyStore.findUnique({
    where: {
      groupBuyId_storeId: {
        groupBuyId: id,
        storeId: user.storeId,
      },
    },
    select: {
      pickupStart: true,
      pickupEnd: true,
      store: {
        select: {
          name: true,
        },
      },
      groupBuy: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!groupBuyStore) {
    notFound();
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link
        href={`/group-buys/${groupBuyStore.groupBuy.id}`}
        className="text-sm font-medium text-[#007F83] hover:underline"
      >
        ← 回到團購詳情
      </Link>

      <h1 className="mt-4 text-3xl font-bold">調整本店取貨時間</h1>
      <p className="mt-2 text-slate-600">
        {groupBuyStore.store.name}｜{groupBuyStore.groupBuy.title}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        此操作只會更新本店的取貨時間；目前不會發送 LINE 通知。
      </p>

      <StorePickupTimeForm
        groupBuyId={groupBuyStore.groupBuy.id}
        pickupStart={groupBuyStore.pickupStart.toISOString()}
        pickupEnd={groupBuyStore.pickupEnd.toISOString()}
      />
    </section>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { GroupBuyEditForm } from "@/app/(admin)/group-buys/group-buy-edit-form";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type EditGroupBuyPageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditGroupBuyPage({
  params,
}: EditGroupBuyPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && !user.storeId) {
    redirect("/group-buys");
  }

  const { id } = await params;

  const groupBuy = await prisma.groupBuy.findFirst({
    where: isHqAdmin
      ? { id }
      : {
          id,
          source: "STORE",
          ownerStoreId: user.storeId!,
        },
    select: {
      id: true,
      title: true,
      content: true,
      imageUrls: true,
      productName: true,
      unit: true,
      originalPrice: true,
      groupPrice: true,
      perCustomerLimit: true,
      minimumQuantity: true,
      quantityMultiple: true,
      totalQuantityLimit: true,
      startAt: true,
      endAt: true,
      defaultPickupStart: true,
      defaultPickupEnd: true,
      status: true,
      groupBuyStores: {
        where: isHqAdmin
          ? undefined
          : {
              storeId: user.storeId!,
            },
        select: {
          storeId: true,
          pickupStart: true,
          pickupEnd: true,
        },
      },
    },
  });

  if (!groupBuy) {
    notFound();
  }

  const stores = isHqAdmin
    ? await prisma.store.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          address: true,
          enabled: true,
        },
      })
    : [];

  return (
    <section className="mx-auto max-w-4xl">
      <Link
        href={`/group-buys/${groupBuy.id}`}
        className="text-sm font-medium text-[#007F83] hover:underline"
      >
        ← 回到團購詳情
      </Link>

      <h1 className="mt-4 text-3xl font-bold">
        {isHqAdmin ? "編輯團購" : "編輯本店團"}
      </h1>
      <p className="mt-2 text-slate-600">
        修改後會立即更新團購內容；已成立訂單仍保留原本的商品與價格快照。
      </p>

      <GroupBuyEditForm
        stores={stores}
        mode={isHqAdmin ? "HQ" : "STORE"}
        groupBuy={{
          id: groupBuy.id,
          title: groupBuy.title,
          content: groupBuy.content ?? "",
          imageUrl: groupBuy.imageUrls[0] ?? "",
          productName: groupBuy.productName,
          unit: groupBuy.unit ?? "",
          originalPrice: groupBuy.originalPrice?.toString() ?? "",
          groupPrice: groupBuy.groupPrice.toString(),
          perCustomerLimit: groupBuy.perCustomerLimit?.toString() ?? "",
          minimumQuantity: groupBuy.minimumQuantity.toString(),
          quantityMultiple: groupBuy.quantityMultiple.toString(),
          totalQuantityLimit: groupBuy.totalQuantityLimit?.toString() ?? "",
          startAt: groupBuy.startAt.toISOString(),
          endAt: groupBuy.endAt.toISOString(),
          defaultPickupStart: groupBuy.defaultPickupStart.toISOString(),
          defaultPickupEnd: groupBuy.defaultPickupEnd.toISOString(),
          status: groupBuy.status,
          groupBuyStores: groupBuy.groupBuyStores.map((groupBuyStore) => ({
            storeId: groupBuyStore.storeId,
            pickupStart: groupBuyStore.pickupStart.toISOString(),
            pickupEnd: groupBuyStore.pickupEnd.toISOString(),
          })),
        }}
      />
    </section>
  );
}

import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { GroupBuyStatusActions } from "@/app/(admin)/group-buys/group-buy-status-actions";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type GroupBuyDetailPageProps = {
  params: Promise<{ id: string }>;
};

function getStatusLabel(status: string) {
  switch (status) {
    case "DRAFT":
      return "草稿";
    case "PUBLISHED":
      return "已發布";
    case "PAUSED":
      return "暫停";
    case "ENDED":
      return "已結束";
    default:
      return status;
  }
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function GroupBuyDetailPage({
  params,
}: GroupBuyDetailPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

    const { id } = await params;
    const isHqAdmin = user.role === "HQ_ADMIN";

    if (!isHqAdmin && !user.storeId) {
    redirect("/group-buys");
    }

    const groupBuy = await prisma.groupBuy.findFirst({
    where: isHqAdmin
        ? { id }
        : {
            id,
            groupBuyStores: {
            some: {
                storeId: user.storeId!,
            },
            },
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
      source: true,
      ownerStoreId: true,
      groupBuyStores: {
        where: isHqAdmin
            ? undefined
            :{
                storeId: user.storeId!,
            },
        select: {
          id: true,
          pickupStart: true,
          pickupEnd: true,
          store: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
        orderBy: {
          store: {
            name: "asc",
          },
        },
      },
    },
  });

  if (!groupBuy) {
    notFound();
  }
  const visibleGroupBuyStores = isHqAdmin
    ? groupBuy.groupBuyStores
    : groupBuy.groupBuyStores.filter(
        (groupBuyStore) => groupBuyStore.store.id === user.storeId
        );

    if (!isHqAdmin && visibleGroupBuyStores.length === 0) {
    notFound();
    }
    const isOwnStoreGroup =
      !isHqAdmin &&
      groupBuy.source === "STORE" &&
      groupBuy.ownerStoreId === user.storeId;

  return (
    <section className="mx-auto max-w-4xl">
      <Link
        href="/group-buys"
        className="text-sm font-medium text-[#007F83] hover:underline"
      >
        ← 回到團購管理
      </Link>

      <div className="mt-4 rounded-2xl bg-white p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司團購詳情" : "門市團購詳情"}
            </p>
            <h1 className="mt-2 text-3xl font-bold">{groupBuy.title}</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {isHqAdmin ? (
              <>
                <Link
                  href={`/group-buys/${groupBuy.id}/edit`}
                  className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
                >
                  編輯團購
                </Link>

                <GroupBuyStatusActions
                  groupBuyId={groupBuy.id}
                  status={groupBuy.status}
                />
              </>
            ) : isOwnStoreGroup ? (
              <>
                <Link
                href={`/group-buys/${groupBuy.id}/edit`}
                className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
                >
                  編輯本店團
                </Link>

                <GroupBuyStatusActions
                  groupBuyId={groupBuy.id}
                  status={groupBuy.status}
                />
              </>
            ) : (
            <Link
                href={`/group-buys/${groupBuy.id}/pickup-time`}
                className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
            >
                調整本店取貨時間
            </Link>
            )}

            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {getStatusLabel(groupBuy.status)}
            </span>
          </div>
        </div>

        {groupBuy.content ? (
          <p className="mt-4 whitespace-pre-wrap text-slate-600">
            {groupBuy.content}
          </p>
        ) : null}

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">商品名稱</p>
            <p className="mt-1 text-lg font-bold">{groupBuy.productName}</p>
            <p className="mt-1 text-sm text-slate-500">
              單位：{groupBuy.unit ?? "未設定"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">價格</p>
            <p className="mt-1 text-lg font-bold">
              團購價 NT$ {groupBuy.groupPrice.toString()}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              原價：
              {groupBuy.originalPrice
                ? ` NT$ ${groupBuy.originalPrice.toString()}`
                : " 未設定"}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">團購期間</p>
            <p className="mt-1 text-sm font-medium">
              {formatDateTime(groupBuy.startAt)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              至 {formatDateTime(groupBuy.endAt)}
            </p>
          </div>

          <div className="rounded-xl bg-slate-50 p-5">
            <p className="text-sm text-slate-500">預設取貨時間</p>
            <p className="mt-1 text-sm font-medium">
              {formatDateTime(groupBuy.defaultPickupStart)}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              至 {formatDateTime(groupBuy.defaultPickupEnd)}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">數量限制</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500">每人限購</p>
              <p className="mt-1 font-medium">
                {groupBuy.perCustomerLimit
                  ? `${groupBuy.perCustomerLimit} 件`
                  : "不限"}
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500">最低訂購量</p>
              <p className="mt-1 font-medium">
                {groupBuy.minimumQuantity} 件
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500">數量倍數</p>
              <p className="mt-1 font-medium">
                {groupBuy.quantityMultiple} 件
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4">
              <p className="text-sm text-slate-500">總數量上限</p>
              <p className="mt-1 font-medium">
                {groupBuy.totalQuantityLimit
                  ? `${groupBuy.totalQuantityLimit} 件`
                  : "不限"}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold">參與門市與取貨時間</h2>

          <div className="mt-4 space-y-3">
            {visibleGroupBuyStores.map((groupBuyStore) => (
              <div
                key={groupBuyStore.id}
                className="rounded-xl border border-slate-200 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{groupBuyStore.store.name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {groupBuyStore.store.address}
                    </p>
                  </div>

                  <div className="text-sm text-slate-600">
                    <p>{formatDateTime(groupBuyStore.pickupStart)}</p>
                    <p className="mt-1">
                      至 {formatDateTime(groupBuyStore.pickupEnd)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

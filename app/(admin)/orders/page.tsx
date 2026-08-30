import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { OrderArrivalActions } from "./order-arrival-actions";

type OrdersPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
};

export default async function OrdersPage({
  searchParams,
}: OrdersPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && !user.storeId) {
    redirect("/home");
  }

  const params = await searchParams;

  const page = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1
  );

  const pageSize = 20;

  const groupBuyStores = await prisma.groupBuyStore.findMany({
    where: {
      ...(isHqAdmin
        ? {}
        : {
            storeId: user.storeId!,
          }),

      orders: {
        some: {},
      },
    },

  orderBy: [
    {
      groupBuy: {
        createdAt: "desc",
      },
    },
    {
      id: "desc",
    },
  ],

    skip: (page - 1) * pageSize,
    take: pageSize + 1,

    select: {
      id: true,

      store: {
        select: {
          name: true,
        },
      },

      groupBuy: {
        select: {
          id: true,
          title: true,
          productName: true,
          unit: true,
          startAt: true,
          endAt: true,
        },
      },

      _count: {
        select: {
          orders: true,
        },
      },
    },
  });

  const hasNextPage = groupBuyStores.length > pageSize;

  const visibleGroupBuyStores = hasNextPage
    ? groupBuyStores.slice(0, pageSize)
    : groupBuyStores;

  const groupBuyStoreIds = visibleGroupBuyStores.map((item) => item.id);

  const statusGroups =
    groupBuyStoreIds.length === 0
      ? []
      : await prisma.order.groupBy({
          by: ["groupBuyStoreId", "status"],

          where: {
            groupBuyStoreId: {
              in: groupBuyStoreIds,
            },
          },

          _count: {
            _all: true,
          },
        });

  const statusByGroupBuyStore = new Map<
    string,
    Record<string, number>
  >();

  for (const row of statusGroups) {
    const current =
      statusByGroupBuyStore.get(row.groupBuyStoreId) ?? {};

    current[row.status] = row._count._all;

    statusByGroupBuyStore.set(row.groupBuyStoreId, current);
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          {isHqAdmin ? "總公司管理" : "分店管理"}
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">
          訂單管理
        </h1>

        <p className="mt-3 text-slate-600">
          {isHqAdmin
            ? "顯示各門市有訂單的團購。"
            : "顯示本店有訂單的團購。"}
        </p>

        {visibleGroupBuyStores.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-slate-500">
            目前沒有訂單。
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {visibleGroupBuyStores.map((item) => {
              const counts =
                statusByGroupBuyStore.get(item.id) ?? {};

              const orderedCount = counts.ORDERED ?? 0;
              const arrivedCount = counts.ARRIVED ?? 0;
              const paidCount = counts.PICKED_UP_PAID ?? 0;
              const canceledCount = counts.CANCELED ?? 0;
              const expiredCount =
                counts.EXPIRED_UNCOLLECTED ?? 0;

              return (
              <section
                key={item.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300"
              >
                <div className="flex flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
                  {/* 左側：團購資訊 */}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#007F83]">
                      {item.store.name}
                    </p>

                    <h2 className="mt-1 truncate text-xl font-bold text-slate-900">
                      {item.groupBuy.title}
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      商品：{item.groupBuy.productName}
                      {item.groupBuy.unit ? ` (${item.groupBuy.unit})` : ""}
                    </p>
                  </div>

                  {/* 右側：操作 */}
                  <div className="flex shrink-0 items-start gap-2">
                    <OrderArrivalActions
                      groupBuyStoreId={item.id}
                      orderedCount={orderedCount}
                    />

                    <Link
                      href={`/orders/${item.id}`}
                      className="inline-flex h-9 items-center justify-center rounded-lg border border-[#007F83] px-4 text-sm font-medium text-[#007F83] transition hover:bg-[#007F83] hover:text-white"
                    >
                      查看訂單
                    </Link>
                  </div>
                </div>

                {/* 統計資訊 */}
                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        總訂單
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {item._count.orders}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        已訂購
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {orderedCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        已到貨
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {arrivedCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        已取貨付款
                      </p>
                      <p className="mt-1 text-lg font-bold text-[#007F83]">
                        {paidCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-slate-500">
                        取消／逾期
                      </p>
                      <p className="mt-1 text-lg font-bold text-slate-900">
                        {canceledCount + expiredCount}
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            );
            })}
          </div>
        )}

        {page > 1 || visibleGroupBuyStores.length > 0 ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              第 {page} 頁，每頁最多 {pageSize} 團
            </span>

            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/orders?page=${page - 1}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  上一頁
                </Link>
              ) : null}

              {hasNextPage ? (
                <Link
                  href={`/orders?page=${page + 1}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  下一頁
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
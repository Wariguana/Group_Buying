import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

const PAGE_SIZE = 50;

type GroupBuysPageProps = {
  searchParams: Promise<{
    page?: string;
  }>;
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

function getStatusClassName(status: string) {
  switch (status) {
    case "PUBLISHED":
      return "bg-emerald-50 text-emerald-700";
    case "PAUSED":
      return "bg-amber-50 text-amber-700";
    case "ENDED":
      return "bg-rose-50 text-rose-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(value);
}

export default async function GroupBuysPage({
  searchParams,
}: GroupBuysPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  const params = await searchParams;

  const page = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1
  );

  if (isHqAdmin) {
    const groupBuys = await prisma.groupBuy.findMany({
      orderBy: [
        {
          createdAt: "desc",
        },
        {
          id: "desc",
        },
      ],

      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE + 1,

      select: {
        id: true,
        title: true,
        productName: true,
        groupPrice: true,
        startAt: true,
        endAt: true,
        status: true,

        _count: {
          select: {
            groupBuyStores: true,
          },
        },
      },
    });

    const hasNextPage = groupBuys.length > PAGE_SIZE;

    const visibleGroupBuys = hasNextPage
      ? groupBuys.slice(0, PAGE_SIZE)
      : groupBuys;

    return (
      <section className="rounded-2xl bg-white p-8 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          總公司管理
        </p>

        <h1 className="mt-2 text-3xl font-bold">
          團購管理
        </h1>

        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <p className="text-slate-600">
            可查看所有團購與參與門市。
          </p>

          <Link
            href="/group-buys/new"
            className="rounded-lg bg-[#007F83] px-5 py-3 font-medium text-white transition hover:bg-[#55AFB9]"
          >
            ＋ 建立總公司團
          </Link>
        </div>

        <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-100">
          <table className="min-w-225 w-full text-left">
            <thead className="bg-slate-100 text-sm text-slate-600">
              <tr>
                <th className="px-5 py-4">
                  團購名稱
                </th>

                <th className="px-5 py-4">
                  商品
                </th>

                <th className="px-5 py-4">
                  團購價
                </th>

                <th className="px-5 py-4">
                  團購期間
                </th>

                <th className="px-5 py-4">
                  參與門市
                </th>

                <th className="px-5 py-4">
                  狀態
                </th>

                <th className="px-5 py-4">
                  操作
                </th>
              </tr>
            </thead>

            <tbody>
              {visibleGroupBuys.map((groupBuy) => (
                <tr
                  key={groupBuy.id}
                  className="border-t border-slate-100"
                >
                  <td className="px-5 py-4 font-medium">
                    {groupBuy.title}
                  </td>

                  <td className="px-5 py-4">
                    {groupBuy.productName}
                  </td>

                  <td className="px-5 py-4">
                    NT$ {groupBuy.groupPrice.toString()}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {formatDate(groupBuy.startAt)}
                    <br />
                    至 {formatDate(groupBuy.endAt)}
                  </td>

                  <td className="px-5 py-4">
                    {groupBuy._count.groupBuyStores} 間
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusClassName(
                        groupBuy.status
                      )}`}
                    >
                      {getStatusLabel(groupBuy.status)}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <Link
                      href={`/group-buys/${groupBuy.id}`}
                      className="font-medium text-[#007F83] hover:underline"
                    >
                      查看／編輯
                    </Link>
                  </td>
                </tr>
              ))}

              {visibleGroupBuys.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-10 text-center text-slate-500"
                  >
                    目前尚未建立團購。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        {visibleGroupBuys.length > 0 ? (
          <div className="mt-6 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">
              第 {page} 頁，每頁最多 {PAGE_SIZE} 團
            </span>

            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/group-buys?page=${page - 1}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  上一頁
                </Link>
              ) : null}

              {hasNextPage ? (
                <Link
                  href={`/group-buys?page=${page + 1}`}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  下一頁
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  if (!user.storeId) {
    redirect("/home");
  }

  const assignedGroupBuys = await prisma.groupBuyStore.findMany({
    where: {
      storeId: user.storeId,
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

    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,

    select: {
      id: true,
      pickupStart: true,
      pickupEnd: true,

      groupBuy: {
        select: {
          id: true,
          title: true,
          productName: true,
          groupPrice: true,
          startAt: true,
          endAt: true,
          status: true,
        },
      },
    },
  });

  const hasNextPage = assignedGroupBuys.length > PAGE_SIZE;

  const visibleAssignedGroupBuys = hasNextPage
    ? assignedGroupBuys.slice(0, PAGE_SIZE)
    : assignedGroupBuys;

  return (
    <section className="rounded-2xl bg-white p-8 shadow-sm">
      <p className="text-sm font-medium text-[#007F83]">
        分店管理
      </p>

      <h1 className="mt-2 text-3xl font-bold">
        團購管理
      </h1>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
        <p className="text-slate-600">
          顯示總公司指派給本店，以及本店自行建立的團購。
        </p>

        <Link
          href="/group-buys/new"
          className="rounded-lg bg-[#007F83] px-5 py-3 font-medium text-white transition hover:bg-[#55AFB9]"
        >
          ＋ 建立本店團
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-2xl border border-slate-100">
        <table className="min-w-250 w-full text-left">
          <thead className="bg-slate-100 text-sm text-slate-600">
            <tr>
              <th className="px-5 py-4">
                團購名稱
              </th>

              <th className="px-5 py-4">
                商品
              </th>

              <th className="px-5 py-4">
                團購價
              </th>

              <th className="px-5 py-4">
                團購期間
              </th>

              <th className="px-5 py-4">
                本店取貨日期
              </th>

              <th className="px-5 py-4">
                狀態
              </th>

              <th className="px-5 py-4">
                操作
              </th>
            </tr>
          </thead>

          <tbody>
            {visibleAssignedGroupBuys.map(
              (groupBuyStore) => (
                <tr
                  key={groupBuyStore.id}
                  className="border-t border-slate-100"
                >
                  <td className="px-5 py-4 font-medium">
                    {groupBuyStore.groupBuy.title}
                  </td>

                  <td className="px-5 py-4">
                    {groupBuyStore.groupBuy.productName}
                  </td>

                  <td className="px-5 py-4">
                    NT${" "}
                    {groupBuyStore.groupBuy.groupPrice.toString()}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {formatDate(
                      groupBuyStore.groupBuy.startAt
                    )}
                    <br />
                    至{" "}
                    {formatDate(
                      groupBuyStore.groupBuy.endAt
                    )}
                  </td>

                  <td className="px-5 py-4 text-sm text-slate-600">
                    {formatDate(
                      groupBuyStore.pickupStart
                    )}
                    <br />
                    至{" "}
                    {formatDate(
                      groupBuyStore.pickupEnd
                    )}
                  </td>

                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusClassName(
                        groupBuyStore.groupBuy.status
                      )}`}
                    >
                      {getStatusLabel(
                        groupBuyStore.groupBuy.status
                      )}
                    </span>
                  </td>

                  <td className="px-5 py-4">
                    <Link
                      href={`/group-buys/${groupBuyStore.groupBuy.id}`}
                      className="font-medium text-[#007F83] hover:underline"
                    >
                      查看詳情
                    </Link>
                  </td>
                </tr>
              )
            )}

            {visibleAssignedGroupBuys.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-10 text-center text-slate-500"
                >
                  目前沒有指派給本店的團購。
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {visibleAssignedGroupBuys.length > 0 ? (
        <div className="mt-6 flex items-center justify-between gap-3">
          <span className="text-sm text-slate-500">
            第 {page} 頁，每頁最多 {PAGE_SIZE} 團
          </span>

          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/group-buys?page=${page - 1}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                上一頁
              </Link>
            ) : null}

            {hasNextPage ? (
              <Link
                href={`/group-buys?page=${page + 1}`}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                下一頁
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
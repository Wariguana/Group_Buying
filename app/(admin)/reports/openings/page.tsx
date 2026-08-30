import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getTaiwanReportDate } from "@/app/lib/reporting";
import { ReportHeader, ReportShell } from "../report-ui";
import { ExportButton } from "../export-button";

export default async function OpeningsReportPage({
  searchParams,
}: {
  searchParams: Promise<{
    store?: string;
    groupBuy?: string;
    start?: string;
    end?: string;
    page?: string;
  }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "HQ_ADMIN" && !user.storeId) {
    redirect("/home");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  const params = await searchParams;

  const page = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );

  const pageSize = 200;

  const startAt = getTaiwanReportDate(params.start);
  const endAt = getTaiwanReportDate(params.end, true);

  const groupBuyDateFilter =
    startAt || endAt
      ? {
          startAt: {
            ...(startAt ? { gte: startAt } : {}),
            ...(endAt ? { lte: endAt } : {}),
          },
        }
      : {};

  /*
   * HQ 才需要取得全部門市，
   * STORE_ADMIN 不需要。
   */
  const stores = isHqAdmin
    ? await prisma.store.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      })
    : [];

  /*
   * 防止網址塞不存在或無效的 store id。
   */
  const storeId =
    isHqAdmin &&
    stores.some((store) => store.id === params.store)
      ? params.store
      : undefined;

  /*
   * 分店只能查自己。
   * HQ 可以全部，或指定某間門市。
   */
  const scope = !isHqAdmin
    ? {
        storeId: user.storeId!,
      }
    : storeId
      ? {
          storeId,
        }
      : {};

  /*
   * 團購篩選下拉選單。
   *
   * 這裡目前先維持原本邏輯。
   * 後面如果團購數量非常大，
   * 再處理 dropdown 本身無上限的問題。
   */
  const groupBuys = await prisma.groupBuy.findMany({
    where: {
      ...groupBuyDateFilter,
      groupBuyStores: {
        some: scope,
      },
    },

    orderBy: {
      createdAt: "desc",
    },

    select: {
      id: true,
      title: true,
    },
  });

  const groupBuyId = groupBuys.some(
    (groupBuy) => groupBuy.id === params.groupBuy,
  )
    ? params.groupBuy
    : undefined;

  /*
   * ==========================================
   * STEP 1
   *
   * 只取得這一頁的 GroupBuyStore metadata。
   *
   * 注意：
   * 這裡已經完全不 select orders。
   * ==========================================
   */
  const openings = await prisma.groupBuyStore.findMany({
    where: {
      ...scope,

      ...(groupBuyId
        ? {
            groupBuyId,
          }
        : {}),

      groupBuy: groupBuyDateFilter,
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
      pickupStart: true,
      pickupEnd: true,

      store: {
        select: {
          name: true,
        },
      },

      groupBuy: {
        select: {
          title: true,
          productName: true,
          unit: true,
          status: true,
          groupPrice: true,
        },
      },
    },
  });

  const hasNextPage =
    openings.length > pageSize;

  const visibleOpenings = hasNextPage
    ? openings.slice(0, pageSize)
    : openings;

  /*
   * 只針對真正顯示在這一頁的
   * GroupBuyStore ID 做訂單統計。
   *
   * 最多 200 個 ID。
   */
  const visibleOpeningIds =
    visibleOpenings.map((item) => item.id);

  /*
   * ==========================================
   * STEP 2
   *
   * PostgreSQL 直接依：
   *
   * groupBuyStoreId + status
   *
   * 做 GROUP BY。
   *
   * 不把完整 Order rows 拉回 Next.js。
   * ==========================================
   */
  const orderGroups =
    visibleOpeningIds.length === 0
      ? []
      : await prisma.order.groupBy({
          by: [
            "groupBuyStoreId",
            "status",
          ],

          where: {
            groupBuyStoreId: {
              in: visibleOpeningIds,
            },
          },

          _count: {
            _all: true,
          },

          _sum: {
            totalAmount: true,
          },
        });

  /*
   * Map 結構：
   *
   * groupBuyStoreId
   *   ↓
   * {
   *   ORDERED: 10,
   *   ARRIVED: 3,
   *   PICKED_UP_PAID: 20,
   *   ...
   *   paidRevenue: 15000
   * }
   */
  const statsByOpening = new Map<
    string,
    {
      counts: Record<string, number>;
      paidRevenue: number;
    }
  >();

  for (const row of orderGroups) {
    const current =
      statsByOpening.get(
        row.groupBuyStoreId,
      ) ?? {
        counts: {},
        paidRevenue: 0,
      };

    current.counts[row.status] =
      row._count._all;

    /*
     * 收款金額只計算：
     *
     * PICKED_UP_PAID
     */
    if (row.status === "PICKED_UP_PAID") {
      current.paidRevenue =
        Number(
          row._sum.totalAmount ?? 0,
        );
    }

    statsByOpening.set(
      row.groupBuyStoreId,
      current,
    );
  }

  const pageParams = new URLSearchParams({
    ...(params.start
      ? {
          start: params.start,
        }
      : {}),

    ...(params.end
      ? {
          end: params.end,
        }
      : {}),

    ...(storeId
      ? {
          store: storeId,
        }
      : {}),

    ...(groupBuyId
      ? {
          groupBuy: groupBuyId,
        }
      : {}),
  });

  const formatDate = (value: Date) =>
    new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "short",
      timeZone: "Asia/Taipei",
    }).format(value);

  const money = (value: number) =>
    new Intl.NumberFormat("zh-TW", {
      style: "currency",
      currency: "TWD",
      maximumFractionDigits: 0,
    }).format(value);

  const statusLabel: Record<
    string,
    string
  > = {
    DRAFT: "草稿",
    PUBLISHED: "已發布",
    PAUSED: "已暫停",
    ENDED: "已結束",
  };

  return (
    <ReportShell>
      <ReportHeader
        role={
          isHqAdmin
            ? "總公司報表"
            : "分店報表"
        }
        title="開團商品彙總"
        description="依門市與團購檢視商品、取貨期間、訂單狀態與已收款金額。"
      />

      <form className="mt-6 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50 p-4">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          開團開始日期

          <input
            type="date"
            name="start"
            defaultValue={params.start}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          開團結束日期

          <input
            type="date"
            name="end"
            defaultValue={params.end}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          />
        </label>

        {isHqAdmin && (
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            門市

            <select
              name="store"
              defaultValue={storeId}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">
                全部門市
              </option>

              {stores.map((store) => (
                <option
                  key={store.id}
                  value={store.id}
                >
                  {store.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="grid gap-1 text-sm font-medium text-slate-700">
          團購名稱

          <select
            name="groupBuy"
            defaultValue={groupBuyId}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
          >
            <option value="">
              全部團購
            </option>

            {groupBuys.map((groupBuy) => (
              <option
                key={groupBuy.id}
                value={groupBuy.id}
              >
                {groupBuy.title}
              </option>
            ))}
          </select>
        </label>

        <button className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white">
          套用篩選
        </button>

        <ExportButton
          href={`/api/reports/openings/export?${new URLSearchParams(
            {
              ...(params.start
                ? {
                    start: params.start,
                  }
                : {}),

              ...(params.end
                ? {
                    end: params.end,
                  }
                : {}),

              ...(storeId
                ? {
                    store: storeId,
                  }
                : {}),

              ...(groupBuyId
                ? {
                    groupBuy: groupBuyId,
                  }
                : {}),
            },
          )}`}
        />
      </form>

      <div className="mt-6 overflow-x-auto rounded-xl border border-slate-900">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-100 text-slate-900">
            <tr>
              {[
                "門市",
                "團購／商品",
                "團購狀態",
                "取貨期間",
                "訂購",
                "到貨",
                "已收款",
                "取消／逾期",
                "收款金額",
              ].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-900">
            {visibleOpenings.map(
              (item) => {
                const stats =
                  statsByOpening.get(
                    item.id,
                  );

                const count = (
                  status: string,
                ) =>
                  stats?.counts[
                    status
                  ] ?? 0;

                const paidRevenue =
                  stats?.paidRevenue ??
                  0;

                return (
                  <tr key={item.id}>
                    <td className="px-4 py-3">
                      {item.store.name}
                    </td>

                    <td className="px-4 py-3">
                      <p>
                        {
                          item.groupBuy
                            .title
                        }
                      </p>

                      <p className="text-slate-500">
                        {
                          item.groupBuy
                            .productName
                        }

                        {item.groupBuy
                          .unit
                          ? ` (${item.groupBuy.unit})`
                          : ""}
                      </p>
                    </td>

                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                        {
                          statusLabel[
                            item
                              .groupBuy
                              .status
                          ]
                        }
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      {formatDate(
                        item.pickupStart,
                      )}
                      <br />
                      至{" "}
                      {formatDate(
                        item.pickupEnd,
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {count(
                        "ORDERED",
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {count(
                        "ARRIVED",
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {count(
                        "PICKED_UP_PAID",
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {count(
                        "CANCELED",
                      )}
                      ／
                      {count(
                        "EXPIRED_UNCOLLECTED",
                      )}
                    </td>

                    <td className="px-4 py-3 text-right font-medium text-[#007F83]">
                      {money(
                        paidRevenue,
                      )}
                    </td>
                  </tr>
                );
              },
            )}

            {visibleOpenings.length ===
              0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  目前沒有開團資料。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          第 {page} 頁，每頁最多{" "}
          {pageSize} 筆。
        </span>

        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/reports/openings?${new URLSearchParams(
                {
                  ...Object.fromEntries(
                    pageParams,
                  ),
                  page: String(
                    page - 1,
                  ),
                },
              )}`}
              className="rounded border px-3 py-2"
            >
              上一頁
            </Link>
          ) : null}

          {hasNextPage ? (
            <Link
              href={`/reports/openings?${new URLSearchParams(
                {
                  ...Object.fromEntries(
                    pageParams,
                  ),
                  page: String(
                    page + 1,
                  ),
                },
              )}`}
              className="rounded border px-3 py-2"
            >
              下一頁
            </Link>
          ) : null}
        </div>
      </div>
    </ReportShell>
  );
}
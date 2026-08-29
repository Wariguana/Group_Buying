import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ReportsPageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
  }>;
};

function getTaiwanDate(value: string | undefined, isEndOfDay = false) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const time = isEndOfDay ? "T23:59:59.999" : "T00:00:00";
  const date = new Date(`${value}${time}+08:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function formatAmount(amount: string) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  if (user.role !== "HQ_ADMIN" && !user.storeId) {
    redirect("/home");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";
  const params = await searchParams;
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

  const selectedStoreId =
    isHqAdmin && stores.some((store) => store.id === params.store)
      ? params.store!
      : "";
  const startAt = getTaiwanDate(params.start);
  const endAt = getTaiwanDate(params.end, true);

  const storeScope = !isHqAdmin
    ? {
        groupBuyStore: {
          storeId: user.storeId!,
        },
      }
    : selectedStoreId
      ? {
          groupBuyStore: {
            storeId: selectedStoreId,
          },
        }
      : {};

  const createdAtFilter =
    startAt || endAt
      ? {
          createdAt: {
            ...(startAt ? { gte: startAt } : {}),
            ...(endAt ? { lte: endAt } : {}),
          },
        }
      : {};

  const paidAtFilter =
    startAt || endAt
      ? {
          paidAt: {
            ...(startAt ? { gte: startAt } : {}),
            ...(endAt ? { lte: endAt } : {}),
          },
        }
      : {};

  const [orders, paidOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        ...storeScope,
        ...createdAtFilter,
      },
      select: {
        groupBuyStoreId: true,
        status: true,
        quantity: true,
        groupBuyStore: {
          select: {
            store: {
              select: {
                name: true,
              },
            },
            groupBuy: {
              select: {
                title: true,
                productName: true,
              },
            },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: {
        ...storeScope,
        ...paidAtFilter,
        status: "PICKED_UP_PAID",
      },
      select: {
        groupBuyStoreId: true,
        totalAmount: true,
        groupBuyStore: {
          select: {
            store: {
              select: {
                name: true,
              },
            },
            groupBuy: {
              select: {
                title: true,
                productName: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const statusCount = (status: string) =>
    orders.filter((order) => order.status === status).length;

  const totalQuantity = orders
    .filter((order) => order.status !== "CANCELED")
    .reduce((total, order) => total + order.quantity, 0);

  const paidRevenue = paidOrders.reduce(
    (total, order) => total + Number(order.totalAmount),
    0,
  );

  const detailByGroupBuyStore = new Map<
    string,
    {
      groupBuyStoreId: string;
      storeName: string;
      groupBuyTitle: string;
      productName: string;
      orderCount: number;
      quantity: number;
      paidRevenue: number;
    }
  >();

  for (const order of orders) {
    const existing = detailByGroupBuyStore.get(order.groupBuyStoreId);

    if (existing) {
      existing.orderCount += 1;
      existing.quantity += order.status === "CANCELED" ? 0 : order.quantity;
      continue;
    }

    detailByGroupBuyStore.set(order.groupBuyStoreId, {
      groupBuyStoreId: order.groupBuyStoreId,
      storeName: order.groupBuyStore.store.name,
      groupBuyTitle: order.groupBuyStore.groupBuy.title,
      productName: order.groupBuyStore.groupBuy.productName,
      orderCount: 1,
      quantity: order.status === "CANCELED" ? 0 : order.quantity,
      paidRevenue: 0,
    });
  }

  for (const order of paidOrders) {
    const existing = detailByGroupBuyStore.get(order.groupBuyStoreId);

    if (existing) {
      existing.paidRevenue += Number(order.totalAmount);
      continue;
    }

    detailByGroupBuyStore.set(order.groupBuyStoreId, {
      groupBuyStoreId: order.groupBuyStoreId,
      storeName: order.groupBuyStore.store.name,
      groupBuyTitle: order.groupBuyStore.groupBuy.title,
      productName: order.groupBuyStore.groupBuy.productName,
      orderCount: 0,
      quantity: 0,
      paidRevenue: Number(order.totalAmount),
    });
  }

  const detailRows = Array.from(detailByGroupBuyStore.values()).sort(
    (left, right) =>
      left.storeName.localeCompare(right.storeName, "zh-TW") ||
      left.groupBuyTitle.localeCompare(right.groupBuyTitle, "zh-TW"),
  );

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-[#007F83]">
          {isHqAdmin ? "總公司報表" : "分店報表"}
        </p>

        <h1 className="mt-2 text-3xl font-bold text-slate-900">訂單報表</h1>

        <p className="mt-3 text-slate-600">
          訂購量依下單時間統計；營業額僅計算已取貨並付款的訂單。
        </p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/reports/products"
            className="rounded-xl border border-slate-200 p-4 transition hover:border-[#007F83] hover:bg-slate-50"
          >
            <p className="font-bold text-slate-900">商品分析</p>
            <p className="mt-1 text-sm text-slate-500">業績與銷售排行</p>
          </Link>
          <Link
            href="/reports/group-buys"
            className="rounded-xl border border-slate-200 p-4 transition hover:border-[#007F83] hover:bg-slate-50"
          >
            <p className="font-bold text-slate-900">團購分析</p>
            <p className="mt-1 text-sm text-slate-500">依團購名稱彙總</p>
          </Link>
          <Link
            href="/reports/customers"
            className="rounded-xl border border-slate-200 p-4 transition hover:border-[#007F83] hover:bg-slate-50"
          >
            <p className="font-bold text-slate-900">客戶分析</p>
            <p className="mt-1 text-sm text-slate-500">依客戶彙總消費</p>
          </Link>
          <Link
            href="/reports/store-ranking"
            className="rounded-xl border border-slate-200 p-4 transition hover:border-[#007F83] hover:bg-slate-50"
          >
            <p className="font-bold text-slate-900">各店銷售排行</p>
            <p className="mt-1 text-sm text-slate-500">依門市比較業績</p>
          </Link>
        </div>

        <form
          key={`${params.start ?? ""}-${params.end ?? ""}-${selectedStoreId}`}
          className="mt-6 flex flex-wrap items-end gap-4 rounded-xl bg-slate-50 p-4"
        >
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            開始日期
            <input
              type="date"
              name="start"
              defaultValue={params.start ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm font-medium text-slate-700">
            結束日期
            <input
              type="date"
              name="end"
              defaultValue={params.end ?? ""}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
          >
            套用篩選
          </button>
          {isHqAdmin ? (
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              門市
              <select
                name="store"
                defaultValue={selectedStoreId}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              >
                <option value="">全部門市</option>

                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <Link
            href="/reports"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            清除篩選
          </Link>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">訂單數</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {orders.length}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">訂購總數量</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalQuantity}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已到貨訂單</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {statusCount("ARRIVED")}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已付款營業額</p>
            <p className="mt-2 text-3xl font-bold text-[#007F83]">
              {formatAmount(paidRevenue.toString())}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 p-5">
          <h2 className="font-bold text-slate-900">訂單狀態</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["已訂購", "ORDERED"],
              ["已到貨", "ARRIVED"],
              ["已取貨付款", "PICKED_UP_PAID"],
              ["已取消", "CANCELED"],
              ["逾期未取", "EXPIRED_UNCOLLECTED"],
            ].map(([label, status]) => (
              <div key={status} className="rounded-lg bg-slate-50 px-4 py-3">
                <p className="text-sm text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900">
                  {statusCount(status)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <section className="mt-6 overflow-hidden rounded-xl border border-slate-200">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="font-bold text-slate-900">門市與團購明細</h2>
            <p className="mt-1 text-sm text-slate-500">
              訂單數與訂購數量依下單時間；已付款營業額依付款取貨時間。
            </p>
          </div>

          {detailRows.length === 0 ? (
            <p className="px-5 py-10 text-center text-slate-500">
              此篩選條件下沒有訂單資料。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3">門市</th>
                    <th className="px-4 py-3">團購／商品</th>
                    <th className="px-4 py-3 text-right">訂單數</th>
                    <th className="px-4 py-3 text-right">訂購數量</th>
                    <th className="px-4 py-3 text-right">已付款營業額</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200">
                  {detailRows.map((row) => (
                    <tr key={row.groupBuyStoreId} className="text-slate-700">
                      <td className="px-4 py-3 font-medium">{row.storeName}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{row.groupBuyTitle}</p>
                        <p className="mt-1 text-slate-500">{row.productName}</p>
                      </td>
                      <td className="px-4 py-3 text-right">{row.orderCount}</td>
                      <td className="px-4 py-3 text-right">{row.quantity}</td>
                      <td className="px-4 py-3 text-right font-medium text-[#007F83]">
                        {formatAmount(row.paidRevenue.toString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

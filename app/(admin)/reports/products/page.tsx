import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

type ProductsReportPageProps = {
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

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default async function ProductsReportPage({
  searchParams,
}: ProductsReportPageProps) {
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
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      })
    : [];
  const selectedStoreId =
    isHqAdmin && stores.some((store) => store.id === params.store)
      ? params.store!
      : "";
  const startAt = getTaiwanDate(params.start);
  const endAt = getTaiwanDate(params.end, true);

  const storeScope = !isHqAdmin
    ? { groupBuyStore: { storeId: user.storeId! } }
    : selectedStoreId
      ? { groupBuyStore: { storeId: selectedStoreId } }
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

  const productGroups = await prisma.order.groupBy({
    by: ["productName", "unit"],
    where: {
      ...storeScope,
      ...paidAtFilter,
      status: "PICKED_UP_PAID",
    },
    _count: {
      _all: true,
    },
    _sum: {
      quantity: true,
      totalAmount: true,
    },
  });

  const products = productGroups.map((product) => ({
    ...product,
    orderCount: product._count._all,
    quantity: product._sum.quantity ?? 0,
    revenue: Number(product._sum.totalAmount ?? 0),
  }));
  const byRevenue = [...products].sort(
    (left, right) =>
      right.revenue - left.revenue || right.quantity - left.quantity,
  );
  const byQuantity = [...products].sort(
    (left, right) =>
      right.quantity - left.quantity || right.revenue - left.revenue,
  );
  const totalRevenue = products.reduce(
    (total, product) => total + product.revenue,
    0,
  );
  const totalQuantity = products.reduce(
    (total, product) => total + product.quantity,
    0,
  );

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司報表" : "分店報表"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              商品分析報表
            </h1>
            <p className="mt-3 text-slate-600">
              僅統計已取貨並付款的訂單；營業額與銷售排行都依付款取貨時間篩選。
            </p>
          </div>

          <Link
            href="/reports"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            返回營運總覽
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
          <button
            type="submit"
            className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
          >
            套用篩選
          </button>
          <Link
            href="/reports/products"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            清除篩選
          </Link>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已付款銷售數量</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalQuantity}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已付款營業額</p>
            <p className="mt-2 text-3xl font-bold text-[#007F83]">
              {formatAmount(totalRevenue)}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-bold text-slate-900">商品業績</h2>
              <p className="mt-1 text-sm text-slate-500">
                依已付款營業額排序。
              </p>
            </div>
            <ProductTable
              products={byRevenue}
              valueLabel="已付款營業額"
              valueFor="revenue"
            />
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-bold text-slate-900">商品銷售排行</h2>
              <p className="mt-1 text-sm text-slate-500">
                依已付款銷售數量排序。
              </p>
            </div>
            <ProductTable
              products={byQuantity}
              valueLabel="已付款數量"
              valueFor="quantity"
            />
          </section>
        </div>
      </section>
    </main>
  );
}

type ProductRow = {
  productName: string;
  unit: string | null;
  orderCount: number;
  quantity: number;
  revenue: number;
};

function ProductTable({
  products,
  valueLabel,
  valueFor,
}: {
  products: ProductRow[];
  valueLabel: string;
  valueFor: "revenue" | "quantity";
}) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-slate-500">沒有已付款訂單。</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-slate-100 text-slate-700">
          <tr>
            <th className="px-4 py-3">排名</th>
            <th className="px-4 py-3">商品</th>
            <th className="px-4 py-3 text-right">訂單數</th>
            <th className="px-4 py-3 text-right">銷售數量</th>
            <th className="px-4 py-3 text-right">{valueLabel}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {products.map((product, index) => (
            <tr
              key={`${product.productName}-${product.unit ?? ""}`}
              className="text-slate-700"
            >
              <td className="px-4 py-3 font-medium">{index + 1}</td>
              <td className="px-4 py-3">
                <p className="font-medium">{product.productName}</p>
                {product.unit ? (
                  <p className="mt-1 text-slate-500">{product.unit}</p>
                ) : null}
              </td>
              <td className="px-4 py-3 text-right">{product.orderCount}</td>
              <td className="px-4 py-3 text-right">{product.quantity}</td>
              <td className="px-4 py-3 text-right font-medium text-[#007F83]">
                {valueFor === "revenue"
                  ? formatAmount(product.revenue)
                  : product.quantity}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

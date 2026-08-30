import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { ExportButton } from "../export-button";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

type ProductsReportPageProps = {
  searchParams: Promise<{
    start?: string;
    end?: string;
    store?: string;
    product?: string;
    page?: string;
  }>;
};

function formatAmount(amount: number) {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export async function ProductsReportPage({
  searchParams,
  rankingOnly = false,
}: ProductsReportPageProps & { rankingOnly?: boolean }) {
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
  const groupBuyDateFilter = getGroupBuyStartDateFilter(params.start, params.end);
  const selectedProduct = params.product?.trim().slice(0, 200) ?? "";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 200;

  const storeScope = !isHqAdmin
    ? { groupBuyStore: { storeId: user.storeId! } }
    : selectedStoreId
      ? { groupBuyStore: { storeId: selectedStoreId } }
      : {};

  const productGroups = await prisma.order.groupBy({
    by: ["productName", "unit"],
    where: {
      AND: [storeScope, groupBuyDateFilter],
      status: "PICKED_UP_PAID",
      ...(selectedProduct ? { productName: selectedProduct } : {}),
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
  const productOptions = await prisma.order.findMany({
    where: { status: "PICKED_UP_PAID", AND: [storeScope, groupBuyDateFilter] },
    distinct: ["productName"],
    orderBy: { productName: "asc" },
    select: { productName: true },
  });
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
  const sortedProducts = rankingOnly ? byQuantity : byRevenue;
  const visibleProducts = sortedProducts.slice((page - 1) * pageSize, page * pageSize);
  const hasNextPage = sortedProducts.length > page * pageSize;
  const exportSearchParams = new URLSearchParams();

  if (params.start) exportSearchParams.set("start", params.start);
  if (params.end) exportSearchParams.set("end", params.end);
  if (selectedStoreId) exportSearchParams.set("store", selectedStoreId);
  if (selectedProduct) exportSearchParams.set("product", selectedProduct);
  if (rankingOnly) exportSearchParams.set("mode", "quantity");

  const exportHref = `/api/reports/products/export${exportSearchParams.size ? `?${exportSearchParams}` : ""}`;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-[#007F83]">
              {isHqAdmin ? "總公司報表" : "分店報表"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              {rankingOnly ? "商品銷售排行報表" : "商品業績報表"}
            </h1>
            <p className="mt-3 text-slate-600">
              僅統計已收款訂單；所有資料依開團日期篩選。
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
          key={`${params.start ?? ""}-${params.end ?? ""}-${selectedStoreId}-${selectedProduct}`}
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
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            商品
            <select
              name="product"
              defaultValue={selectedProduct}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            >
              <option value="">全部商品（排行）</option>
              {productOptions.map((product) => (
                <option key={product.productName} value={product.productName}>
                  {product.productName}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-lg bg-[#007F83] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#55AFB9]"
          >
            套用篩選
          </button>
          <Link
            href={rankingOnly ? "/reports/product-ranking" : "/reports/products"}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-white"
          >
            清除篩選
          </Link>
          <ExportButton href={exportHref} />
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已收款銷售數量</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">
              {totalQuantity}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 p-5">
            <p className="text-sm text-slate-500">已收款營業額</p>
            <p className="mt-2 text-3xl font-bold text-[#007F83]">
              {formatAmount(totalRevenue)}
            </p>
          </div>
        </div>

        <div className={`mt-6 grid gap-6 ${rankingOnly ? "" : "xl:grid-cols-2"}`}>
        {rankingOnly ? (
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-bold text-slate-900">商品銷售排行</h2>
              <p className="mt-1 text-sm text-slate-500">
                依已收款銷售數量排序。
              </p>
            </div>
            <ProductTable
              products={visibleProducts}
              valueLabel="已收款數量"
              valueFor="quantity"
              startRank={(page - 1) * pageSize}
            />
          </section>
        ) : (
          <section className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-bold text-slate-900">
                商品業績{selectedProduct ? `：${selectedProduct}` : ""}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                依已收款營業額排序。
              </p>
            </div>
            <ProductTable
              products={visibleProducts}
              valueLabel="已收款營業額"
              valueFor="revenue"
              startRank={(page - 1) * pageSize}
            />
          </section>
        )}
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 text-sm text-slate-600">
          <span>第 {page} 頁，每頁最多 {pageSize} 項商品。</span>
          <div className="flex gap-2">
            {page > 1 ? <Link href={`${rankingOnly ? "/reports/product-ranking" : "/reports/products"}?${new URLSearchParams({ ...Object.fromEntries(exportSearchParams), page: String(page - 1) })}`} className="rounded border px-3 py-2">上一頁</Link> : null}
            {hasNextPage ? <Link href={`${rankingOnly ? "/reports/product-ranking" : "/reports/products"}?${new URLSearchParams({ ...Object.fromEntries(exportSearchParams), page: String(page + 1) })}`} className="rounded border px-3 py-2">下一頁</Link> : null}
          </div>
        </div>
      </section>
    </main>
  );
}

export default ProductsReportPage;

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
  startRank = 0,
}: {
  products: ProductRow[];
  valueLabel: string;
  valueFor: "revenue" | "quantity";
  startRank?: number;
}) {
  if (products.length === 0) {
    return (
      <p className="px-5 py-10 text-center text-slate-500">沒有已收款訂單。</p>
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
              <td className="px-4 py-3 font-medium">{startRank + index + 1}</td>
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

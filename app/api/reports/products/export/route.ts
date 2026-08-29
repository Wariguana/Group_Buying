import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

export const runtime = "nodejs";

function formatDate(value: string | null) {
  return value || "全部期間";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入管理端。" }, { status: 401 });
  }

  if (user.role !== "HQ_ADMIN" && !user.storeId) {
    return NextResponse.json(
      { message: "目前帳號未綁定門市。" },
      { status: 403 },
    );
  }

  const isHqAdmin = user.role === "HQ_ADMIN";
  const { searchParams } = new URL(request.url);
  const mode =
  searchParams.get("mode") === "quantity" ? "quantity" : "revenue";
  const isQuantityRanking = mode === "quantity";
  const requestedStoreId = searchParams.get("store");
  const start = searchParams.get("start");
  const end = searchParams.get("end");
  const product = searchParams.get("product")?.trim().slice(0, 200) ?? "";
  const groupBuyDateFilter = getGroupBuyStartDateFilter(start ?? undefined, end ?? undefined);

  const selectedStore = isHqAdmin
    ? requestedStoreId
      ? await prisma.store.findUnique({
          where: { id: requestedStoreId },
          select: { id: true, name: true },
        })
      : null
    : await prisma.store.findUnique({
        where: { id: user.storeId! },
        select: { id: true, name: true },
      });
  const storeScope = !isHqAdmin
    ? { groupBuyStore: { storeId: user.storeId! } }
    : selectedStore
      ? { groupBuyStore: { storeId: selectedStore.id } }
      : {};

  const productGroups = await prisma.order.groupBy({
    by: ["productName", "unit"],
    where: {
      AND: [storeScope, groupBuyDateFilter],
      status: "PICKED_UP_PAID",
      ...(product ? { productName: product } : {}),
    },
    _count: { _all: true },
    _sum: { quantity: true, totalAmount: true },
  });
  const orderDetails = await prisma.order.findMany({
    where: {
      AND: [storeScope, groupBuyDateFilter],
      status: "PICKED_UP_PAID",
      ...(product ? { productName: product } : {}),
    },
    orderBy: { paidAt: "desc" },
    select: {
      orderNo: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      totalAmount: true,
      paidAt: true,
      customer: { select: { displayName: true, phone: true } },
      groupBuyStore: { select: { groupBuy: { select: { title: true } } } },
    },
  });
  const rows = productGroups
    .map((product) => ({
      productName: product.productName,
      unit: product.unit,
      orderCount: product._count._all,
      quantity: product._sum.quantity ?? 0,
      revenue: Number(product._sum.totalAmount ?? 0),
    }))
    .sort((left, right) =>
      isQuantityRanking
        ? right.quantity - left.quantity || right.revenue - left.revenue
        : right.revenue - left.revenue || right.quantity - left.quantity,
    );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "團購管理系統";
  workbook.created = new Date();

  const reportTitle = isQuantityRanking
    ? "商品銷售排行報表"
    : "商品業績報表";

  const worksheet = workbook.addWorksheet(
    isQuantityRanking ? "商品銷售排行" : "商品業績",
    {
      views: [{ state: "frozen", ySplit: 4 }],
    },
  );

  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value = reportTitle;
  worksheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF007F83" },
  };
  worksheet.getCell("A1").alignment = { horizontal: "center" };

  worksheet.mergeCells("A2:E2");
  worksheet.getCell("A2").value =
    `開團日期：${formatDate(start)} ～ ${formatDate(end)}｜門市：${selectedStore?.name ?? "全部門市"}｜商品：${product || "全部商品"}`;
  worksheet.getCell("A2").font = { color: { argb: "FF475569" } };

  worksheet.columns = [
    { key: "productName", width: 36 },
    { key: "unit", width: 14 },
    { key: "orderCount", width: 14 },
    { key: "quantity", width: 14 },
    { key: "revenue", width: 18 },
  ];
  const headerRow = worksheet.getRow(4);
  headerRow.values = [
    "商品",
    "單位",
    "已收款訂單數",
    "已收款數量",
    "已收款營業額",
  ];
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };
  headerRow.alignment = { horizontal: "center" };

  for (const row of rows) {
    const worksheetRow = worksheet.addRow(row);
    worksheetRow.getCell("orderCount").alignment = { horizontal: "right" };
    worksheetRow.getCell("quantity").alignment = { horizontal: "right" };
    worksheetRow.getCell("revenue").alignment = { horizontal: "right" };
    worksheetRow.getCell("revenue").numFmt = "NT$ #,##0";
  }

  const totalRow = worksheet.addRow({
    productName: "合計",
    orderCount: rows.reduce((total, row) => total + row.orderCount, 0),
    quantity: rows.reduce((total, row) => total + row.quantity, 0),
    revenue: rows.reduce((total, row) => total + row.revenue, 0),
  });
  totalRow.font = { bold: true };
  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };
  totalRow.getCell("revenue").numFmt = "NT$ #,##0";

  const detailsWorksheet = workbook.addWorksheet("訂單明細", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  detailsWorksheet.columns = [
    { key: "paidAt", width: 21 },
    { key: "orderNo", width: 19 },
    { key: "customer", width: 18 },
    { key: "phone", width: 16 },
    { key: "groupBuy", width: 24 },
    { key: "product", width: 36 },
    { key: "unitPrice", width: 14 },
    { key: "quantity", width: 12 },
    { key: "amount", width: 16 },
  ];
  const detailsHeader = detailsWorksheet.getRow(1);
  detailsHeader.values = [
    "收款時間",
    "訂單編號",
    "客戶",
    "電話",
    "團購名稱",
    "商品",
    "單價",
    "數量",
    "金額",
  ];
  detailsHeader.font = { bold: true, color: { argb: "FFFFFFFF" } };
  detailsHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };
  for (const order of orderDetails) {
    const row = detailsWorksheet.addRow({
      paidAt: order.paidAt ?? "",
      orderNo: order.orderNo,
      customer: order.customer.displayName ?? "LINE 客戶",
      phone: order.customer.phone ?? "未填寫",
      groupBuy: order.groupBuyStore.groupBuy.title,
      product: `${order.productName}${order.unit ? ` (${order.unit})` : ""}`,
      unitPrice: Number(order.unitPrice),
      quantity: order.quantity,
      amount: Number(order.totalAmount),
    });
    row.getCell("paidAt").numFmt = "yyyy-mm-dd hh:mm";
    row.getCell("unitPrice").numFmt = "NT$ #,##0";
    row.getCell("amount").numFmt = "NT$ #,##0";
  }

  const data = await workbook.xlsx.writeBuffer();
  const filename = `products-report-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(data, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

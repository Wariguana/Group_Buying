import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { formatTaiwanDate } from "@/app/lib/date";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

export const runtime = "nodejs";

function formatDate(value: string | null) {
  return value || "全部期間";
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      { message: "請先登入管理端。" },
      { status: 401 },
    );
  }

  if (user.role !== "HQ_ADMIN" && !user.storeId) {
    return NextResponse.json(
      { message: "目前帳號未綁定門市。" },
      { status: 403 },
    );
  }

  const isHqAdmin = user.role === "HQ_ADMIN";
  const { searchParams } = new URL(request.url);

  const requestedStoreId = searchParams.get("store");
  const requestedGroupBuyId = searchParams.get("groupBuy");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const groupBuyDateFilter = getGroupBuyStartDateFilter(
    start ?? undefined,
    end ?? undefined,
  );

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

  const groupBuyStoreScope = !isHqAdmin
    ? { storeId: user.storeId! }
    : selectedStore
      ? { storeId: selectedStore.id }
      : {};

  const selectedGroupBuy = requestedGroupBuyId
    ? await prisma.groupBuy.findFirst({
        where: {
          id: requestedGroupBuyId,
          groupBuyStores: {
            some: groupBuyStoreScope,
          },
        },
        select: {
          id: true,
          title: true,
        },
      })
    : null;

  const paidOrders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      AND: [groupBuyDateFilter],
      groupBuyStore: {
        ...groupBuyStoreScope,
        ...(selectedGroupBuy
          ? { groupBuyId: selectedGroupBuy.id }
          : {}),
      },
    },
    select: {
      orderNo: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      totalAmount: true,
      paidAt: true,
      customer: {
        select: {
          displayName: true,
          phone: true,
        },
      },
      groupBuyStore: {
        select: {
          groupBuy: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      },
    },
  });

  const reportByGroupBuy = new Map<
    string,
    {
      title: string;
      productName: string;
      orderCount: number;
      quantity: number;
      revenue: number;
    }
  >();

  for (const order of paidOrders) {
    const groupBuy = order.groupBuyStore.groupBuy;
    const row = reportByGroupBuy.get(groupBuy.id);

    if (row) {
      row.orderCount += 1;
      row.quantity += order.quantity;
      row.revenue += Number(order.totalAmount);
    } else {
      reportByGroupBuy.set(groupBuy.id, {
        title: groupBuy.title,
        productName: order.productName,
        orderCount: 1,
        quantity: order.quantity,
        revenue: Number(order.totalAmount),
      });
    }
  }

  const rows = [...reportByGroupBuy.values()].sort(
    (left, right) =>
      right.revenue - left.revenue ||
      right.quantity - left.quantity,
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "團購管理系統";

  const worksheet = workbook.addWorksheet(
    "訂單銷售－依開團名",
    {
      views: [{ state: "frozen", ySplit: 4 }],
    },
  );

  worksheet.mergeCells("A1:E1");
  worksheet.getCell("A1").value =
    "訂單銷售報表－依開團名";

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

  worksheet.getCell("A1").alignment = {
    horizontal: "center",
  };

  worksheet.mergeCells("A2:E2");

  worksheet.getCell("A2").value =
    `開團日期：${formatDate(start)} ～ ${formatDate(end)}` +
    `｜門市：${selectedStore?.name ?? "全部門市"}` +
    `｜團購：${selectedGroupBuy?.title ?? "全部團購"}`;

  worksheet.getCell("A2").font = {
    color: { argb: "FF475569" },
  };

  worksheet.columns = [
    { key: "title", width: 28 },
    { key: "productName", width: 36 },
    { key: "orderCount", width: 16 },
    { key: "quantity", width: 16 },
    { key: "revenue", width: 18 },
  ];

  const headerRow = worksheet.getRow(4);

  headerRow.values = [
    "團購名稱",
    "商品",
    "已收款訂單數",
    "已收款數量",
    "已收款營業額",
  ];

  headerRow.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };

  headerRow.alignment = {
    horizontal: "center",
  };

  for (const row of rows) {
    const worksheetRow = worksheet.addRow(row);

    for (const key of [
      "orderCount",
      "quantity",
      "revenue",
    ] as const) {
      worksheetRow.getCell(key).alignment = {
        horizontal: "right",
      };
    }

    worksheetRow.getCell("revenue").numFmt =
      "NT$ #,##0";
  }

  const totalRow = worksheet.addRow({
    title: "合計",
    orderCount: rows.reduce(
      (total, row) => total + row.orderCount,
      0,
    ),
    quantity: rows.reduce(
      (total, row) => total + row.quantity,
      0,
    ),
    revenue: rows.reduce(
      (total, row) => total + row.revenue,
      0,
    ),
  });

  totalRow.font = {
    bold: true,
  };

  totalRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  totalRow.getCell("revenue").numFmt =
    "NT$ #,##0";

  const detailsWorksheet = workbook.addWorksheet(
    "依開團名訂單明細",
    {
      views: [{ state: "frozen", ySplit: 1 }],
    },
  );

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
    "收款日期",
    "訂單編號",
    "客戶",
    "電話",
    "團購名稱",
    "商品",
    "單價",
    "數量",
    "金額",
  ];

  detailsHeader.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  detailsHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };

  for (const order of [...paidOrders].sort(
    (a, b) =>
      (b.paidAt?.getTime() ?? 0) -
      (a.paidAt?.getTime() ?? 0),
  )) {
    const row = detailsWorksheet.addRow({
      paidAt: order.paidAt ? formatTaiwanDate(order.paidAt) : "",
      orderNo: order.orderNo,
      customer:
        order.customer.displayName ?? "LINE 客戶",
      phone: order.customer.phone ?? "未填寫",
      groupBuy:
        order.groupBuyStore.groupBuy.title,
      product: `${order.productName}${
        order.unit ? ` (${order.unit})` : ""
      }`,
      unitPrice: Number(order.unitPrice),
      quantity: order.quantity,
      amount: Number(order.totalAmount),
    });

    row.getCell("unitPrice").numFmt =
      "NT$ #,##0";

    row.getCell("amount").numFmt =
      "NT$ #,##0";
  }

  const data = await workbook.xlsx.writeBuffer();

  const filename =
    `group-buys-report-${new Date()
      .toISOString()
      .slice(0, 10)}.xlsx`;

  return new NextResponse(data, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

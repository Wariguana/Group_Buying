import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";
import { getTaiwanReportDate } from "@/app/lib/reporting";

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

  const query = new URL(request.url).searchParams;

  const start = query.get("start");
  const end = query.get("end");
  const requestedStoreId = query.get("store");
  const requestedGroupBuyId = query.get("groupBuy");

  const startAt = getTaiwanReportDate(start ?? undefined);
  const endAt = getTaiwanReportDate(end ?? undefined, true);

  const isHqAdmin = user.role === "HQ_ADMIN";

  const where = {
    ...(!isHqAdmin
      ? { storeId: user.storeId! }
      : requestedStoreId
        ? { storeId: requestedStoreId }
        : {}),
    ...(requestedGroupBuyId
      ? { groupBuyId: requestedGroupBuyId }
      : {}),
    ...(startAt || endAt
      ? {
          groupBuy: {
            startAt: {
              ...(startAt ? { gte: startAt } : {}),
              ...(endAt ? { lte: endAt } : {}),
            },
          },
        }
      : {}),
  };

  const [openings, selectedStore, selectedGroupBuy] = await Promise.all([
    prisma.groupBuyStore.findMany({
      where,
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
            unit: true,
            status: true,
          },
        },
        pickupStart: true,
        pickupEnd: true,
        orders: {
          select: {
            status: true,
            totalAmount: true,
          },
        },
      },
    }),

    isHqAdmin && requestedStoreId
      ? prisma.store.findUnique({
          where: { id: requestedStoreId },
          select: { name: true },
        })
      : !isHqAdmin
        ? prisma.store.findUnique({
            where: { id: user.storeId! },
            select: { name: true },
          })
        : Promise.resolve(null),

    requestedGroupBuyId
      ? prisma.groupBuy.findUnique({
          where: { id: requestedGroupBuyId },
          select: { title: true },
        })
      : Promise.resolve(null),
  ]);

  const wb = new ExcelJS.Workbook();
  const sh = wb.addWorksheet("開團商品彙總");

  const statusLabels: Record<string, string> = {
    DRAFT: "草稿",
    PUBLISHED: "已發布",
    PAUSED: "已暫停",
    ENDED: "已結束",
  };

  sh.mergeCells("A1:J1");
  sh.getCell("A1").value = "開團商品彙總報表";
  sh.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  sh.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF007F83" },
  };
  sh.getCell("A1").alignment = {
    horizontal: "center",
  };

  sh.mergeCells("A2:J2");
  sh.getCell("A2").value =
    `開團日期：${start ?? "全部期間"} ～ ${end ?? "全部期間"}` +
    `｜門市：${selectedStore?.name ?? "全部門市"}` +
    `｜團購：${selectedGroupBuy?.title ?? "全部團購"}`;

  sh.getCell("A2").font = {
    color: { argb: "FF475569" },
  };

  const header = sh.getRow(4);

  header.values = [
    "門市",
    "團購名稱",
    "商品",
    "狀態",
    "取貨開始",
    "取貨結束",
    "已訂購",
    "已到貨",
    "已收款",
    "已收款金額",
  ];

  header.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  header.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };

  header.alignment = {
    horizontal: "center",
  };

  sh.views = [
    {
      state: "frozen",
      ySplit: 4,
    },
  ];

  for (const row of openings) {
    const count = (status: string) =>
      row.orders.filter((order) => order.status === status).length;

    const amount = row.orders
      .filter((order) => order.status === "PICKED_UP_PAID")
      .reduce(
        (total, order) => total + Number(order.totalAmount),
        0,
      );

    const r = sh.addRow([
      row.store.name,
      row.groupBuy.title,
      `${row.groupBuy.productName}${
        row.groupBuy.unit ? ` (${row.groupBuy.unit})` : ""
      }`,
      statusLabels[row.groupBuy.status] ?? row.groupBuy.status,
      row.pickupStart,
      row.pickupEnd,
      count("ORDERED"),
      count("ARRIVED"),
      count("PICKED_UP_PAID"),
      amount,
    ]);

    r.getCell(5).numFmt = "yyyy-mm-dd hh:mm";
    r.getCell(6).numFmt = "yyyy-mm-dd hh:mm";
    r.getCell(10).numFmt = "NT$ #,##0";
  }

  sh.columns = [
    { width: 18 },
    { width: 28 },
    { width: 32 },
    { width: 14 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 12 },
    { width: 12 },
    { width: 18 },
  ];

  const data = await wb.xlsx.writeBuffer();

  return new NextResponse(data, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="openings-report-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
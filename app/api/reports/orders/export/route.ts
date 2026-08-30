import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth";
import { formatTaiwanDate } from "@/app/lib/date";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user)
    return NextResponse.json({ message: "請先登入管理端。" }, { status: 401 });
  if (user.role !== "HQ_ADMIN" && !user.storeId)
    return NextResponse.json(
      { message: "目前帳號未綁定門市。" },
      { status: 403 },
    );
  const q = new URL(request.url).searchParams,
    hq = user.role === "HQ_ADMIN",
    requestedStore = q.get("store"),
    requestedGroup = q.get("groupBuy"),
    customer = q.get("customer")?.trim().slice(0, 100) ?? "",
    status = q.get("status") ?? "";
  const store =
    hq && requestedStore
      ? await prisma.store.findUnique({
          where: { id: requestedStore },
          select: { id: true, name: true },
        })
      : null;
  const scope = !hq
    ? { storeId: user.storeId! }
    : store
      ? { storeId: store.id }
      : {};
  const group = requestedGroup
    ? await prisma.groupBuy.findFirst({
        where: { id: requestedGroup, groupBuyStores: { some: scope } },
        select: { id: true, title: true },
      })
    : null;
  const groupBuyDateFilter = getGroupBuyStartDateFilter(
    q.get("start") ?? undefined,
    q.get("end") ?? undefined,
  );
  const valid = [
    "ORDERED",
    "ARRIVED",
    "PICKED_UP_PAID",
    "CANCELED",
    "EXPIRED_UNCOLLECTED",
  ];
  const orders = await prisma.order.findMany({
    where: {
      ...(!hq
        ? { groupBuyStore: { storeId: user.storeId! } }
        : store
          ? { groupBuyStore: { storeId: store.id } }
          : {}),
      ...(group ? { groupBuyStore: { ...scope, groupBuyId: group.id } } : {}),
      ...(valid.includes(status) ? { status: status as "ORDERED" } : {}),
      AND: [
        groupBuyDateFilter,
        ...(!hq ? [{ groupBuyStore: { storeId: user.storeId! } }] : store ? [{ groupBuyStore: { storeId: store.id } }] : []),
        ...(group ? [{ groupBuyStore: { ...scope, groupBuyId: group.id } }] : []),
      ],
      ...(customer
        ? {
            customer: {
              OR: [
                { displayName: { contains: customer, mode: "insensitive" } },
                { phone: { contains: customer } },
              ],
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      orderNo: true,
      productName: true,
      unit: true,
      unitPrice: true,
      quantity: true,
      totalAmount: true,
      status: true,
      createdAt: true,
      paidAt: true,
      customer: { select: { displayName: true, phone: true } },
      groupBuyStore: {
        select: {
          store: { select: { name: true } },
          groupBuy: { select: { title: true } },
        },
      },
    },
  });
  const book = new ExcelJS.Workbook(),
    sheet = book.addWorksheet("訂單銷售明細", {
      views: [{ state: "frozen", ySplit: 4 }],
    });
  sheet.mergeCells("A1:J1");
  sheet.getCell("A1").value = "訂單銷售明細報表";
  sheet.getCell("A1").font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  sheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF007F83" },
  };
  sheet.getCell("A1").alignment = { horizontal: "center" };
  sheet.mergeCells("A2:J2");
  sheet.getCell("A2").value = `開團日期：${q.get("start") ?? "全部期間"} ～ ${q.get("end") ?? "全部期間"}｜門市：${store?.name ?? "全部門市"}｜團購：${group?.title ?? "全部團購"}｜狀態：${status || "全部狀態"}`;
  sheet.getCell("A2").font = { color: { argb: "FF475569" } };
  sheet.columns = [
    { width: 24 },
    { width: 18 },
    { width: 28 },
    { width: 26 },
    { width: 34 },
    { width: 20 },
    { width: 20 },
    { width: 12 },
    { width: 16 },
    { width: 14 },
  ];
  const head = sheet.getRow(4);
  head.values = [
    "訂單編號",
    "門市",
    "團購名稱",
    "客戶／電話",
    "商品",
    "下單日期",
    "收款日期",
    "數量",
    "金額",
    "狀態",
  ];
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };
  const labels: Record<string, string> = {
    ORDERED: "已訂購",
    ARRIVED: "已到貨",
    PICKED_UP_PAID: "已收款",
    CANCELED: "已取消",
    EXPIRED_UNCOLLECTED: "逾期未取",
  };
  for (const o of orders) {
    const r = sheet.addRow([
      o.orderNo,
      o.groupBuyStore.store.name,
      o.groupBuyStore.groupBuy.title,
      `${o.customer.displayName ?? "LINE 客戶"}／${o.customer.phone ?? "未填寫"}`,
      `${o.productName}${o.unit ? ` (${o.unit})` : ""}`,
      formatTaiwanDate(o.createdAt),
      o.paidAt ? formatTaiwanDate(o.paidAt) : "",
      o.quantity,
      Number(o.totalAmount),
      labels[o.status],
    ]);
    r.getCell(9).numFmt = "NT$ #,##0";
  }
  const data = await book.xlsx.writeBuffer();
  return new NextResponse(data, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="orders-report-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

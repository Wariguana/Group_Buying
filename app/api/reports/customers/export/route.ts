import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { formatTaiwanDate } from "@/app/lib/date";
import { prisma } from "@/app/lib/prisma";
import { getGroupBuyStartDateFilter } from "@/app/lib/reporting";

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
  const hq = user.role === "HQ_ADMIN";

  const start = query.get("start");
  const end = query.get("end");

  const groupBuyDateFilter = getGroupBuyStartDateFilter(
    start ?? undefined,
    end ?? undefined,
  );

  const requestedStore = query.get("store");

  const store = hq
    ? requestedStore
      ? await prisma.store.findUnique({
          where: { id: requestedStore },
          select: { id: true, name: true },
        })
      : null
    : await prisma.store.findUnique({
        where: { id: user.storeId! },
        select: { id: true, name: true },
      });

  const customerQuery =
    query.get("customer")?.trim().slice(0, 100) ?? "";

  const orders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      AND: [groupBuyDateFilter],

      ...(hq
        ? store
          ? {
              groupBuyStore: {
                storeId: store.id,
              },
            }
          : {}
        : {
            groupBuyStore: {
              storeId: user.storeId!,
            },
          }),

      ...(customerQuery
        ? {
            customer: {
              OR: [
                {
                  displayName: {
                    contains: customerQuery,
                    mode: "insensitive",
                  },
                },
                {
                  phone: {
                    contains: customerQuery,
                  },
                },
              ],
            },
          }
        : {}),
    },

    select: {
      orderNo: true,
      customerId: true,
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
              title: true,
            },
          },
        },
      },
    },
  });

  const summary = new Map<
    string,
    {
      name: string;
      phone: string;
      count: number;
      quantity: number;
      revenue: number;
      products: Map<string, number>;
    }
  >();

  for (const order of orders) {
    const row = summary.get(order.customerId);

    const productLabel = `${order.productName}${
      order.unit ? ` (${order.unit})` : ""
    }`;

    if (row) {
      row.count++;
      row.quantity += order.quantity;
      row.revenue += Number(order.totalAmount);

      row.products.set(
        productLabel,
        (row.products.get(productLabel) ?? 0) + order.quantity,
      );
    } else {
      summary.set(order.customerId, {
        name: order.customer.displayName ?? "LINE 客戶",
        phone: order.customer.phone ?? "未填寫",
        count: 1,
        quantity: order.quantity,
        revenue: Number(order.totalAmount),
        products: new Map([[productLabel, order.quantity]]),
      });
    }
  }

  const rows = [...summary.values()].sort(
    (a, b) =>
      b.revenue - a.revenue ||
      b.quantity - a.quantity,
  );

  const workbook = new ExcelJS.Workbook();

  const sheet = workbook.addWorksheet("訂單銷售－依客戶", {
    views: [{ state: "frozen", ySplit: 4 }],
  });

  sheet.mergeCells("A1:F1");

  sheet.getCell("A1").value = "訂單銷售報表－依客戶";

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

  sheet.getCell("A1").alignment = {
    horizontal: "center",
  };

  sheet.mergeCells("A2:F2");

  sheet.getCell("A2").value =
    `開團日期：${start ?? "全部期間"} ～ ${end ?? "全部期間"}` +
    `｜門市：${store?.name ?? "全部門市"}` +
    `｜客戶：${customerQuery || "全部客戶"}`;

  sheet.columns = [
    { key: "name", width: 20 },
    { key: "phone", width: 18 },
    { key: "count", width: 16 },
    { key: "quantity", width: 16 },
    { key: "revenue", width: 18 },
    { key: "products", width: 44 },
  ];

  const header = sheet.getRow(4);

  header.values = [
    "客戶",
    "電話",
    "已收款訂單數",
    "已收款數量",
    "已收款營業額",
    "購買商品（數量）",
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

  for (const row of rows) {
    const item = sheet.addRow({
      ...row,

      products: [...row.products.entries()]
        .map(
          ([name, quantity]) =>
            `${name} × ${quantity}`,
        )
        .join("、"),
    });

    item.getCell("revenue").numFmt = "NT$ #,##0";
  }

  const total = sheet.addRow({
    name: "合計",

    count: rows.reduce(
      (total, row) => total + row.count,
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

  total.font = {
    bold: true,
  };

  total.getCell("revenue").numFmt = "NT$ #,##0";

  const detail = workbook.addWorksheet("依客戶購買明細", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  detail.columns = [
    { key: "paidAt", width: 21 },
    { key: "orderNo", width: 19 },
    { key: "name", width: 18 },
    { key: "phone", width: 16 },
    { key: "groupBuy", width: 24 },
    { key: "product", width: 34 },
    { key: "unitPrice", width: 14 },
    { key: "quantity", width: 12 },
    { key: "amount", width: 16 },
  ];

  const detailHeader = detail.getRow(1);

  detailHeader.values = [
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

  detailHeader.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  detailHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF334155" },
  };

  for (const order of orders.sort(
    (a, b) =>
      (b.paidAt?.getTime() ?? 0) -
      (a.paidAt?.getTime() ?? 0),
  )) {
    const item = detail.addRow({
      paidAt: order.paidAt ? formatTaiwanDate(order.paidAt) : "",
      orderNo: order.orderNo,
      name: order.customer.displayName ?? "LINE 客戶",
      phone: order.customer.phone ?? "未填寫",
      groupBuy: order.groupBuyStore.groupBuy.title,

      product: `${order.productName}${
        order.unit ? ` (${order.unit})` : ""
      }`,

      unitPrice: Number(order.unitPrice),
      quantity: order.quantity,
      amount: Number(order.totalAmount),
    });

    item.getCell("unitPrice").numFmt =
      "NT$ #,##0";

    item.getCell("amount").numFmt =
      "NT$ #,##0";
  }

  const data = await workbook.xlsx.writeBuffer();

  return new NextResponse(data, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      "Content-Disposition":
        `attachment; filename="customers-report-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,

      "Cache-Control": "no-store",
    },
  });
}

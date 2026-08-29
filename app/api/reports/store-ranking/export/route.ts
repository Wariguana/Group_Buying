import ExcelJS from "exceljs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
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

  const q = new URL(request.url).searchParams;

  const groupBuyDateFilter = getGroupBuyStartDateFilter(
    q.get("start") ?? undefined,
    q.get("end") ?? undefined,
  );

  const orders = await prisma.order.findMany({
    where: {
      status: "PICKED_UP_PAID",
      AND: [groupBuyDateFilter],

      ...(user.role !== "HQ_ADMIN"
        ? {
            groupBuyStore: {
              storeId: user.storeId!,
            },
          }
        : {}),
    },

    select: {
      quantity: true,
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
              unit: true,
            },
          },
        },
      },
    },
  });

  const stores = new Map<
    string,
    {
      name: string;
      count: number;
      quantity: number;
      revenue: number;
    }
  >();

  const details = new Map<
    string,
    {
      store: string;
      groupBuy: string;
      product: string;
      quantity: number;
      revenue: number;
    }
  >();

  for (const o of orders) {
    const store = o.groupBuyStore.store.name;
    const groupBuy = o.groupBuyStore.groupBuy.title;

    const product =
      `${o.groupBuyStore.groupBuy.productName}` +
      `${
        o.groupBuyStore.groupBuy.unit
          ? ` (${o.groupBuyStore.groupBuy.unit})`
          : ""
      }`;

    const revenue = Number(o.totalAmount);

    const storeRow = stores.get(store);

    if (storeRow) {
      storeRow.count++;
      storeRow.quantity += o.quantity;
      storeRow.revenue += revenue;
    } else {
      stores.set(store, {
        name: store,
        count: 1,
        quantity: o.quantity,
        revenue,
      });
    }

    const key = `${store}:${groupBuy}:${product}`;
    const detailRow = details.get(key);

    if (detailRow) {
      detailRow.quantity += o.quantity;
      detailRow.revenue += revenue;
    } else {
      details.set(key, {
        store,
        groupBuy,
        product,
        quantity: o.quantity,
        revenue,
      });
    }
  }

  const wb = new ExcelJS.Workbook();

  const sheets = [
    {
      name: "門市排行",
      headers: [
        "門市",
        "已收款訂單數",
        "已收款數量",
        "已收款營業額",
      ],
      rows: [...stores.values()]
        .sort(
          (a, b) =>
            b.revenue - a.revenue ||
            b.quantity - a.quantity,
        )
        .map((r) => [
          r.name,
          r.count,
          r.quantity,
          r.revenue,
        ]),
      widths: [24, 18, 18, 20],
    },

    {
      name: "門市團購明細",
      headers: [
        "門市",
        "團購名稱",
        "商品",
        "已收款數量",
        "已收款營業額",
      ],
      rows: [...details.values()]
        .sort(
          (a, b) =>
            b.revenue - a.revenue ||
            b.quantity - a.quantity,
        )
        .map((r) => [
          r.store,
          r.groupBuy,
          r.product,
          r.quantity,
          r.revenue,
        ]),
      widths: [24, 32, 36, 18, 20],
    },
  ];

  for (const { name, headers, rows, widths } of sheets) {
    const sh = wb.addWorksheet(name, {
      views: [
        {
          state: "frozen",
          ySplit: 4,
        },
      ],
    });

    sh.mergeCells(1, 1, 1, headers.length);

    sh.getCell("A1").value = `${name}報表`;

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

    sh.mergeCells(2, 1, 2, headers.length);

    sh.getCell("A2").value =
      `開團日期：${q.get("start") ?? "全部期間"} ～ ` +
      `${q.get("end") ?? "全部期間"}`;

    sh.getCell("A2").font = {
      color: { argb: "FF475569" },
    };

    const header = sh.getRow(4);

    header.values = [...headers];

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

    for (const row of rows) {
      const r = sh.addRow(row);

      r.getCell(headers.length).numFmt =
        "NT$ #,##0";
    }

    sh.columns = widths.map((width) => ({
      width,
    }));
  }

  const data = await wb.xlsx.writeBuffer();

  return new NextResponse(data, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",

      "Content-Disposition":
        `attachment; filename="store-ranking-${new Date()
          .toISOString()
          .slice(0, 10)}.xlsx"`,

      "Cache-Control": "no-store",
    },
  });
}
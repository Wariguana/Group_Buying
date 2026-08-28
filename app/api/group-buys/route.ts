import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role === "HQ_ADMIN") {
    const groupBuys = await prisma.groupBuy.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        productName: true,
        groupPrice: true,
        startAt: true,
        endAt: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            groupBuyStores: true,
          },
        },
      },
    });

    return NextResponse.json({ groupBuys });
  }

  if (!user.storeId) {
    return NextResponse.json(
      { message: "分店管理員尚未綁定門市。" },
      { status: 403 }
    );
  }

  const groupBuyStores = await prisma.groupBuyStore.findMany({
    where: {
      storeId: user.storeId,
    },
    select: {
      id: true,
      pickupStart: true,
      pickupEnd: true,
      groupBuy: {
        select: {
          id: true,
          title: true,
          productName: true,
          groupPrice: true,
          startAt: true,
          endAt: true,
          status: true,
        },
      },
    },
  });

  return NextResponse.json({ groupBuyStores });
}

function getText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalText(value: unknown) {
  const text = getText(value);
  return text ? text : null;
}

function getPositiveInteger(value: unknown) {
  const parsedValue =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : Number.NaN;

  return Number.isInteger(parsedValue) && parsedValue >= 1
    ? parsedValue
    : null;
}

function getNonNegativeNumber(value: unknown) {
  const parsedValue =
    typeof value === "string" || typeof value === "number"
      ? Number(value)
      : Number.NaN;

  return Number.isFinite(parsedValue) && parsedValue >= 0
    ? parsedValue
    : null;
}

function getDate(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const parsedDate = new Date(value);

  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role !== "HQ_ADMIN") {
    return NextResponse.json(
      { message: "只有總公司管理員可以建立總公司團。" },
      { status: 403 }
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  const data = body as Record<string, unknown>;

  const title = getText(data.title);
  const productName = getText(data.productName);
  const content = getOptionalText(data.content);
  const imageUrl = getOptionalText(data.imageUrl);
  const unit = getOptionalText(data.unit);

  const groupPrice = getNonNegativeNumber(data.groupPrice);
  const originalPrice =
    data.originalPrice === undefined || data.originalPrice === null
      ? null
      : getNonNegativeNumber(data.originalPrice);

  const perCustomerLimit =
    data.perCustomerLimit === undefined || data.perCustomerLimit === null
      ? null
      : getPositiveInteger(data.perCustomerLimit);

  const totalQuantityLimit =
    data.totalQuantityLimit === undefined || data.totalQuantityLimit === null
      ? null
      : getPositiveInteger(data.totalQuantityLimit);

  const minimumQuantity = getPositiveInteger(data.minimumQuantity);
  const quantityMultiple = getPositiveInteger(data.quantityMultiple);

  const startAt = getDate(data.startAt);
  const endAt = getDate(data.endAt);
  const defaultPickupStart = getDate(data.defaultPickupStart);
  const defaultPickupEnd = getDate(data.defaultPickupEnd);

  const storeIds = Array.isArray(data.storeIds)
    ? [...new Set(data.storeIds.filter((id): id is string => typeof id === "string"))]
    : [];

  if (!title || !productName || groupPrice === null) {
    return NextResponse.json(
      { message: "請填寫團購標題、商品名稱與團購價。" },
      { status: 400 }
    );
  }

  if (
    (data.originalPrice !== undefined &&
      data.originalPrice !== null &&
      originalPrice === null) ||
    (data.perCustomerLimit !== undefined &&
      data.perCustomerLimit !== null &&
      perCustomerLimit === null) ||
    (data.totalQuantityLimit !== undefined &&
      data.totalQuantityLimit !== null &&
      totalQuantityLimit === null) ||
    minimumQuantity === null ||
    quantityMultiple === null
  ) {
    return NextResponse.json(
      { message: "價格與數量限制必須是合法數字。" },
      { status: 400 }
    );
  }

  if (
    !startAt ||
    !endAt ||
    !defaultPickupStart ||
    !defaultPickupEnd ||
    endAt <= startAt ||
    defaultPickupEnd <= defaultPickupStart
  ) {
    return NextResponse.json(
      { message: "請確認團購與取貨時間，結束時間必須晚於開始時間。" },
      { status: 400 }
    );
  }

  if (storeIds.length === 0) {
    return NextResponse.json(
      { message: "請至少選擇一間參與門市。" },
      { status: 400 }
    );
  }

  const enabledStores = await prisma.store.findMany({
    where: {
      id: {
        in: storeIds,
      },
      enabled: true,
    },
    select: {
      id: true,
    },
  });

  if (enabledStores.length !== storeIds.length) {
    return NextResponse.json(
      { message: "選擇的門市不存在或目前已停用。" },
      { status: 400 }
    );
  }

  const groupBuy = await prisma.groupBuy.create({
    data: {
      title,
      content,
      imageUrls: imageUrl ? [imageUrl] : [],
      productName,
      unit,
      originalPrice,
      groupPrice,
      perCustomerLimit,
      minimumQuantity,
      quantityMultiple,
      totalQuantityLimit,
      startAt,
      endAt,
      defaultPickupStart,
      defaultPickupEnd,
      createdById: user.id,
      groupBuyStores: {
        create: storeIds.map((storeId) => ({
          storeId,
          pickupStart: defaultPickupStart,
          pickupEnd: defaultPickupEnd,
        })),
      },
    },
    select: {
      id: true,
      title: true,
      status: true,
    },
  });

  return NextResponse.json({ groupBuy }, { status: 201 });
}
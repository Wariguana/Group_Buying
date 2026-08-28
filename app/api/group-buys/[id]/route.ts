import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

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

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role !== "HQ_ADMIN") {
    return NextResponse.json(
      { message: "只有總公司管理員可以修改總公司團。" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  const existingGroupBuy = await prisma.groupBuy.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      groupBuyStores: {
        select: {
          storeId: true,
          _count: {
            select: {
              orders: true,
            },
          },
        },
      },
    },
  });

  if (!existingGroupBuy) {
    return NextResponse.json({ message: "找不到此團購。" }, { status: 404 });
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

  if (!Array.isArray(data.stores) || data.stores.length === 0) {
    return NextResponse.json(
      { message: "請至少選擇一間參與門市。" },
      { status: 400 }
    );
  }

  const stores = data.stores
    .map((value) => {
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value)
      ) {
        return null;
      }

      const storeData = value as Record<string, unknown>;
      const storeId = getText(storeData.storeId);
      const pickupStart = getDate(storeData.pickupStart);
      const pickupEnd = getDate(storeData.pickupEnd);

      if (!storeId || !pickupStart || !pickupEnd || pickupEnd <= pickupStart) {
        return null;
      }

      return {
        storeId,
        pickupStart,
        pickupEnd,
      };
    })
    .filter(
      (
        store
      ): store is {
        storeId: string;
        pickupStart: Date;
        pickupEnd: Date;
      } => store !== null
    );

  const storeIds = stores.map((store) => store.storeId);
  const uniqueStoreIds = [...new Set(storeIds)];

  if (
    stores.length !== data.stores.length ||
    uniqueStoreIds.length !== stores.length
  ) {
    return NextResponse.json(
      { message: "請完整填寫每間參與門市的取貨時間。" },
      { status: 400 }
    );
  }

  const existingStoreIds = new Set(
    existingGroupBuy.groupBuyStores.map((groupBuyStore) => groupBuyStore.storeId)
  );

  const selectedStores = await prisma.store.findMany({
    where: {
      id: {
        in: uniqueStoreIds,
      },
    },
    select: {
      id: true,
      enabled: true,
    },
  });

  if (selectedStores.length !== uniqueStoreIds.length) {
    return NextResponse.json(
      { message: "選擇的門市不存在。" },
      { status: 400 }
    );
  }

  const hasNewDisabledStore = selectedStores.some(
    (store) => !store.enabled && !existingStoreIds.has(store.id)
  );

  if (hasNewDisabledStore) {
    return NextResponse.json(
      { message: "無法新增已停用的門市到團購。" },
      { status: 400 }
    );
  }

  const removedGroupBuyStores = existingGroupBuy.groupBuyStores.filter(
    (groupBuyStore) => !uniqueStoreIds.includes(groupBuyStore.storeId)
  );

  const removedStoreHasOrders = removedGroupBuyStores.some(
    (groupBuyStore) => groupBuyStore._count.orders > 0
  );

  if (removedStoreHasOrders) {
    return NextResponse.json(
      {
        message:
          "有訂單的參與門市不可直接移除，請保留該門市以維持既有訂單資料。",
      },
      { status: 409 }
    );
  }

  const groupBuy = await prisma.$transaction(async (transaction) => {
    const updatedGroupBuy = await transaction.groupBuy.update({
      where: {
        id,
      },
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
      },
      select: {
        id: true,
        title: true,
        status: true,
      },
    });

    for (const store of stores) {
      if (existingStoreIds.has(store.storeId)) {
        await transaction.groupBuyStore.update({
          where: {
            groupBuyId_storeId: {
              groupBuyId: id,
              storeId: store.storeId,
            },
          },
          data: {
            pickupStart: store.pickupStart,
            pickupEnd: store.pickupEnd,
          },
        });
      } else {
        await transaction.groupBuyStore.create({
          data: {
            groupBuyId: id,
            storeId: store.storeId,
            pickupStart: store.pickupStart,
            pickupEnd: store.pickupEnd,
          },
        });
      }
    }

    if (removedGroupBuyStores.length > 0) {
      await transaction.groupBuyStore.deleteMany({
        where: {
          groupBuyId: id,
          storeId: {
            in: removedGroupBuyStores.map(
              (groupBuyStore) => groupBuyStore.storeId
            ),
          },
        },
      });
    }

    return updatedGroupBuy;
  });

  return NextResponse.json({ groupBuy });
}
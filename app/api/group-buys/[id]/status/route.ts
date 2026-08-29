import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { sendGroupBuyCard } from "@/app/lib/line-messaging";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type StatusAction = "PUBLISH" | "PAUSE" | "END";

function getNextStatus(currentStatus: string, action: StatusAction) {
  if (action === "PUBLISH") {
    if (currentStatus === "DRAFT" || currentStatus === "PAUSED") {
      return "PUBLISHED" as const;
    }

    return null;
  }

  if (action === "PAUSE") {
    return currentStatus === "PUBLISHED" ? ("PAUSED" as const) : null;
  }

  if (action === "END") {
    return currentStatus === "DRAFT" ||
      currentStatus === "PUBLISHED" ||
      currentStatus === "PAUSED"
      ? ("ENDED" as const)
      : null;
  }

  return null;
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  const isHqAdmin = user.role === "HQ_ADMIN";
  const isStoreAdmin = user.role === "STORE_ADMIN";

  if (!isHqAdmin && (!isStoreAdmin || !user.storeId)) {
    return NextResponse.json(
      { message: "分店管理員尚未綁定門市。" },
      { status: 403 }
    );
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  const action =
    typeof body === "object" && body !== null
      ? (body as { action?: unknown }).action
      : undefined;

  if (action !== "PUBLISH" && action !== "PAUSE" && action !== "END") {
    return NextResponse.json(
      { message: "不支援的團購狀態操作。" },
      { status: 400 }
    );
  }

  const groupBuy = await prisma.groupBuy.findFirst({
    where: isHqAdmin
      ? { id }
      : {
          id,
          source: "STORE",
          ownerStoreId: user.storeId!,
        },
    select: {
      id: true,
      title: true,
      content: true,
      productName: true,
      unit: true,
      groupPrice: true,
      endAt: true,
      status: true,
      groupBuyStores: {
        select: {
          id: true,
          pickupStart: true,
          pickupEnd: true,
          store: {
            select: {
              name: true,
              enabled: true,
              lineGroupId: true,
            },
          },
        },
      },
    },
  });

  if (!groupBuy) {
    return NextResponse.json({ message: "找不到此團購。" }, { status: 404 });
  }

  if (action === "PUBLISH") {
    if (groupBuy.groupBuyStores.length === 0) {
      return NextResponse.json(
        { message: "至少選擇一間參與門市後才能發布。" },
        { status: 400 }
      );
    }

    if (
      !process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN ||
      !process.env.NEXT_PUBLIC_LIFF_ID
    ) {
      return NextResponse.json(
        { message: "尚未完成 LINE Messaging API 或 LIFF 環境設定，無法發布。" },
        { status: 500 }
      );
    }

    const unavailableStores = groupBuy.groupBuyStores
      .filter((groupBuyStore) => !groupBuyStore.store.enabled || !groupBuyStore.store.lineGroupId)
      .map((groupBuyStore) => groupBuyStore.store.name);

    if (unavailableStores.length > 0) {
      return NextResponse.json(
        {
          message: `以下參與門市尚未啟用或未設定 LINE 群組 ID：${unavailableStores.join("、")}`,
        },
        { status: 400 }
      );
    }
  }

  const nextStatus = getNextStatus(groupBuy.status, action);

  if (!nextStatus) {
    return NextResponse.json(
      { message: "目前狀態無法進行此操作。" },
      { status: 409 }
    );
  }

  const updatedGroupBuy = await prisma.groupBuy.update({
    where: {
      id,
    },
    data: {
      status: nextStatus,
    },
    select: {
      id: true,
      status: true,
    },
  });

  if (action !== "PUBLISH") {
    return NextResponse.json({
      groupBuy: updatedGroupBuy,
      message: "團購狀態已更新。",
    });
  }

  const deliveryResults = await Promise.allSettled(
    groupBuy.groupBuyStores.map((groupBuyStore) =>
      sendGroupBuyCard({
        groupBuyStoreId: groupBuyStore.id,
        lineGroupId: groupBuyStore.store.lineGroupId!,
        title: groupBuy.title,
        content: groupBuy.content,
        productName: groupBuy.productName,
        unit: groupBuy.unit,
        groupPrice: groupBuy.groupPrice,
        endAt: groupBuy.endAt,
        pickupStart: groupBuyStore.pickupStart,
        pickupEnd: groupBuyStore.pickupEnd,
      })
    )
  );
  const failedStoreNames = deliveryResults.flatMap((result, index) =>
    result.status === "rejected" ? [groupBuy.groupBuyStores[index].store.name] : []
  );

  return NextResponse.json({
    groupBuy: updatedGroupBuy,
    message:
      failedStoreNames.length > 0
        ? `團購已發布，但以下門市的 LINE 卡片未送出：${failedStoreNames.join("、")}`
        : "團購已發布，LINE 團購卡片已送往所有參與門市群組。",
  });
}

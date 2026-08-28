import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
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

  if (user.role !== "HQ_ADMIN") {
    return NextResponse.json(
      { message: "只有總公司管理員可以變更團購狀態。" },
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

  const groupBuy = await prisma.groupBuy.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      status: true,
      _count: {
        select: {
          groupBuyStores: true,
        },
      },
    },
  });

  if (!groupBuy) {
    return NextResponse.json({ message: "找不到此團購。" }, { status: 404 });
  }

  if (action === "PUBLISH" && groupBuy._count.groupBuyStores === 0) {
    return NextResponse.json(
      { message: "至少選擇一間參與門市後才能發布。" },
      { status: 400 }
    );
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

  return NextResponse.json({ groupBuy: updatedGroupBuy });
}
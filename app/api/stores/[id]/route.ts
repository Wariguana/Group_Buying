import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: RouteContext<"/api/stores/[id]">
) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role !== "HQ_ADMIN") {
    return NextResponse.json({ message: "沒有操作門市的權限。" }, { status: 403 });
  }

  const { id } = await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  const { name, address, phone, lineGroupId, enabled } = body as {
    name?: unknown;
    address?: unknown;
    phone?: unknown;
    lineGroupId?: unknown;
    enabled?: unknown;
  };

  const data: {
    name?: string;
    address?: string;
    phone?: string;
    lineGroupId?: string | null;
    enabled?: boolean;
  } = {};

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ message: "門市名稱不可為空白。" }, { status: 400 });
    }

    data.name = name.trim();
  }

  if (address !== undefined) {
    if (typeof address !== "string" || !address.trim()) {
      return NextResponse.json({ message: "地址不可為空白。" }, { status: 400 });
    }

    data.address = address.trim();
  }

  if (phone !== undefined) {
    if (typeof phone !== "string" || !phone.trim()) {
      return NextResponse.json({ message: "電話不可為空白。" }, { status: 400 });
    }

    data.phone = phone.trim();
  }

  if (lineGroupId !== undefined) {
    if (typeof lineGroupId !== "string") {
      return NextResponse.json({ message: "LINE 群組 ID 格式錯誤。" }, { status: 400 });
    }

    data.lineGroupId = lineGroupId.trim() || null;
  }

  if (enabled !== undefined) {
    if (typeof enabled !== "boolean") {
      return NextResponse.json({ message: "門市狀態格式錯誤。" }, { status: 400 });
    }

    data.enabled = enabled;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ message: "沒有可更新的資料。" }, { status: 400 });
  }

  let result;

  try {
    result = await prisma.store.updateMany({
      where: { id },
      data,
    });
  } catch {
    return NextResponse.json(
      { message: "更新門市失敗。LINE 群組 ID 不可與其他門市重複。" },
      { status: 409 }
    );
  }

  if (result.count === 0) {
    return NextResponse.json({ message: "找不到門市。" }, { status: 404 });
  }

  const store = await prisma.store.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      lineGroupId: true,
      enabled: true,
    },
  });

  return NextResponse.json({ store });
}

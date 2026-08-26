import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role !== "HQ_ADMIN") {
    return NextResponse.json({ message: "沒有查看門市的權限。" }, { status: 403 });
  }

  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      lineGroupId: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ stores });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  if (user.role !== "HQ_ADMIN") {
    return NextResponse.json({ message: "沒有操作門市的權限。" }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "資料格式錯誤。" }, { status: 400 });
  }

  const { name, address, phone, lineGroupId } =
    typeof body === "object" && body !== null
      ? (body as {
          name?: unknown;
          address?: unknown;
          phone?: unknown;
          lineGroupId?: unknown;
        })
      : {};

  if (
    typeof name !== "string" ||
    typeof address !== "string" ||
    typeof phone !== "string" ||
    !name.trim() ||
    !address.trim() ||
    !phone.trim()
  ) {
    return NextResponse.json(
      { message: "請填寫門市名稱、地址與電話。" },
      { status: 400 }
    );
  }

  try {
    const store = await prisma.store.create({
      data: {
        name: name.trim(),
        address: address.trim(),
        phone: phone.trim(),
        lineGroupId:
          typeof lineGroupId === "string" && lineGroupId.trim()
            ? lineGroupId.trim()
            : null,
      },
      select: {
        id: true,
        name: true,
        address: true,
        phone: true,
        lineGroupId: true,
        enabled: true,
      },
    });

    return NextResponse.json({ store }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "新增門市失敗。LINE 群組 ID 不可與其他門市重複。" },
      { status: 409 }
    );
  }
}

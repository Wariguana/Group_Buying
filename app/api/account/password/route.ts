import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export const runtime = "nodejs";

export async function PATCH(request: Request) {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return NextResponse.json({ message: "請先登入。" }, { status: 401 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "請填寫全部密碼欄位。" }, { status: 400 });
  }

  const { currentPassword, newPassword } =
    typeof body === "object" && body !== null
      ? (body as { currentPassword?: unknown; newPassword?: unknown })
      : {};

  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    !currentPassword ||
    !newPassword
  ) {
    return NextResponse.json({ message: "請填寫全部密碼欄位。" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: currentUser.id },
    select: { passwordHash: true, enabled: true },
  });

  if (!user || !user.enabled) {
    return NextResponse.json({ message: "帳號無法使用。" }, { status: 401 });
  }

  const passwordMatches = await bcrypt.compare(currentPassword, user.passwordHash);

  if (!passwordMatches) {
    return NextResponse.json({ message: "目前密碼不正確。" }, { status: 400 });
  }

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    return NextResponse.json(
      { message: "新密碼不可與目前密碼相同。" },
      { status: 400 },
    );
  }

  await prisma.user.update({
    where: { id: currentUser.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 12) },
  });

  return NextResponse.json({ message: "密碼已更新。" });
}

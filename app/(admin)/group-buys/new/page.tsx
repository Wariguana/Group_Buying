import Link from "next/link";
import { redirect } from "next/navigation";

import { GroupBuyForm } from "@/app/(admin)/group-buys/group-buy-form";
import { getCurrentUser } from "@/app/lib/auth";
import { prisma } from "@/app/lib/prisma";

export default async function NewGroupBuyPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  const isHqAdmin = user.role === "HQ_ADMIN";

  if (!isHqAdmin && !user.storeId) {
    redirect("/group-buys");
  }

  const stores = isHqAdmin
    ? await prisma.store.findMany({
        where: {
          enabled: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          address: true,
        },
      })
    : [];

  return (
    <section className="mx-auto max-w-4xl">
      <Link
        href="/group-buys"
        className="text-sm font-medium text-[#007F83] hover:underline"
      >
        ← 回到團購管理
      </Link>

      <h1 className="mt-4 text-3xl font-bold">
        {isHqAdmin ? "建立總公司團" : "建立本店團"}
      </h1>

      <p className="mt-2 text-slate-600">
        {isHqAdmin
          ? "建立後會先儲存為草稿，尚不會發送 LINE 或開放客戶下單。"
          : "此團只會屬於本店；建立後會先儲存為草稿，尚不會發送 LINE 或開放客戶下單。"}
      </p>

      <GroupBuyForm stores={stores} mode={isHqAdmin ? "HQ" : "STORE"} />
    </section>
  );
}
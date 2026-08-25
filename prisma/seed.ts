import { config } from "dotenv";

config({ path: ".env.local" });

import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, UserRole } from "../generated/prisma/client";

function required(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`缺少 ${name} 環境變數。`);
  }

  return value;
}

const connectionString = required("DATABASE_URL");
const prisma = new PrismaClient({ adapter: new PrismaPg(connectionString) });

async function main() {
  const hqUsername = required("SEED_HQ_USERNAME");
  const hqPassword = required("SEED_HQ_PASSWORD");
  const storeName = required("SEED_STORE_NAME");
  const storeAddress = required("SEED_STORE_ADDRESS");
  const storePhone = required("SEED_STORE_PHONE");
  const storeUsername = required("SEED_STORE_USERNAME");
  const storePassword = required("SEED_STORE_PASSWORD");

  const existingHq = await prisma.user.findUnique({
    where: { username: hqUsername },
  });

  if (!existingHq) {
    await prisma.user.create({
      data: {
        username: hqUsername,
        passwordHash: await bcrypt.hash(hqPassword, 12),
        role: UserRole.HQ_ADMIN,
      },
    });
    console.log("已建立總公司管理員。");
  } else {
    console.log("總公司管理員已存在，未覆寫。");
  }

  let store = await prisma.store.findFirst({
    where: { name: storeName },
  });

  if (!store) {
    store = await prisma.store.create({
      data: {
        name: storeName,
        address: storeAddress,
        phone: storePhone,
      },
    });
    console.log("已建立測試分店。");
  } else {
    console.log("同名分店已存在，未覆寫。");
  }

  const existingStoreAdmin = await prisma.user.findUnique({
    where: { username: storeUsername },
  });

  if (!existingStoreAdmin) {
    await prisma.user.create({
      data: {
        username: storeUsername,
        passwordHash: await bcrypt.hash(storePassword, 12),
        role: UserRole.STORE_ADMIN,
        storeId: store.id,
      },
    });
    console.log("已建立分店管理員。");
  } else {
    console.log("分店管理員已存在，未覆寫。");
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Seed 執行失敗。");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

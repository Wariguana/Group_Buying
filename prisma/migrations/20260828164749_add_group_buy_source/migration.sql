-- CreateEnum
CREATE TYPE "GroupBuySource" AS ENUM ('HQ', 'STORE');

-- AlterTable
ALTER TABLE "GroupBuy" ADD COLUMN     "ownerStoreId" TEXT,
ADD COLUMN     "source" "GroupBuySource" NOT NULL DEFAULT 'HQ';

-- CreateIndex
CREATE INDEX "GroupBuy_source_ownerStoreId_idx" ON "GroupBuy"("source", "ownerStoreId");

-- AddForeignKey
ALTER TABLE "GroupBuy" ADD CONSTRAINT "GroupBuy_ownerStoreId_fkey" FOREIGN KEY ("ownerStoreId") REFERENCES "Store"("id") ON DELETE SET NULL ON UPDATE CASCADE;

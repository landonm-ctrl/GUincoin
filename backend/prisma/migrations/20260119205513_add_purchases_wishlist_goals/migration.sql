-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('pending', 'fulfilled', 'cancelled');

-- AlterEnum
ALTER TYPE "TransactionType" ADD VALUE 'store_purchase';

-- CreateTable
CREATE TABLE "StorePurchaseOrder" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'pending',
    "fulfilledById" TEXT,
    "fulfilledAt" TIMESTAMP(3),
    "shippingAddress" TEXT,
    "trackingNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StorePurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "targetAmount" DECIMAL(10,2) NOT NULL,
    "currentAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "isAchieved" BOOLEAN NOT NULL DEFAULT false,
    "achievedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StorePurchaseOrder_transactionId_key" ON "StorePurchaseOrder"("transactionId");

-- CreateIndex
CREATE INDEX "StorePurchaseOrder_employeeId_idx" ON "StorePurchaseOrder"("employeeId");

-- CreateIndex
CREATE INDEX "StorePurchaseOrder_status_idx" ON "StorePurchaseOrder"("status");

-- CreateIndex
CREATE INDEX "StorePurchaseOrder_productId_idx" ON "StorePurchaseOrder"("productId");

-- CreateIndex
CREATE INDEX "WishlistItem_employeeId_idx" ON "WishlistItem"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_employeeId_productId_key" ON "WishlistItem"("employeeId", "productId");

-- CreateIndex
CREATE INDEX "Goal_employeeId_idx" ON "Goal"("employeeId");

-- CreateIndex
CREATE INDEX "Goal_isAchieved_idx" ON "Goal"("isAchieved");

-- AddForeignKey
ALTER TABLE "StorePurchaseOrder" ADD CONSTRAINT "StorePurchaseOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePurchaseOrder" ADD CONSTRAINT "StorePurchaseOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePurchaseOrder" ADD CONSTRAINT "StorePurchaseOrder_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StorePurchaseOrder" ADD CONSTRAINT "StorePurchaseOrder_fulfilledById_fkey" FOREIGN KEY ("fulfilledById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_productId_fkey" FOREIGN KEY ("productId") REFERENCES "StoreProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

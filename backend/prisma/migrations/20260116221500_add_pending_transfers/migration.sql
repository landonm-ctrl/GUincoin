-- CreateEnum
CREATE TYPE "PendingTransferStatus" AS ENUM ('pending', 'claimed');

-- CreateTable
CREATE TABLE "PendingTransfer" (
    "id" TEXT NOT NULL,
    "senderEmployeeId" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "message" TEXT,
    "status" "PendingTransferStatus" NOT NULL DEFAULT 'pending',
    "senderTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),

    CONSTRAINT "PendingTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingTransfer_senderTransactionId_key" ON "PendingTransfer"("senderTransactionId");

-- CreateIndex
CREATE INDEX "PendingTransfer_recipientEmail_status_idx" ON "PendingTransfer"("recipientEmail", "status");

-- AddForeignKey
ALTER TABLE "PendingTransfer" ADD CONSTRAINT "PendingTransfer_senderEmployeeId_fkey" FOREIGN KEY ("senderEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

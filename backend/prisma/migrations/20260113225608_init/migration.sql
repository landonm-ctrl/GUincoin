-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('manager_award', 'peer_transfer_sent', 'peer_transfer_received', 'wellness_reward', 'adjustment');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'posted', 'rejected');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('monthly', 'quarterly');

-- CreateEnum
CREATE TYPE "FrequencyRule" AS ENUM ('one_time', 'annual', 'quarterly');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isManager" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "balance" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerTransaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionType" "TransactionType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "description" TEXT,
    "sourceEmployeeId" TEXT,
    "targetEmployeeId" TEXT,
    "wellnessSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "postedAt" TIMESTAMP(3),

    CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManagerAllotment" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManagerAllotment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessTask" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coinValue" DECIMAL(10,2) NOT NULL,
    "frequencyRule" "FrequencyRule" NOT NULL,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "formTemplateUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessSubmission" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "wellnessTaskId" TEXT NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WellnessSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PeerTransferLimit" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodType" "PeriodType" NOT NULL,
    "maxAmount" DECIMAL(10,2) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PeerTransferLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_email_key" ON "Employee"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Account_employeeId_key" ON "Account"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerTransaction_wellnessSubmissionId_key" ON "LedgerTransaction"("wellnessSubmissionId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_accountId_idx" ON "LedgerTransaction"("accountId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_status_idx" ON "LedgerTransaction"("status");

-- CreateIndex
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "LedgerTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "LedgerTransaction_sourceEmployeeId_idx" ON "LedgerTransaction"("sourceEmployeeId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_targetEmployeeId_idx" ON "LedgerTransaction"("targetEmployeeId");

-- CreateIndex
CREATE INDEX "ManagerAllotment_managerId_periodStart_periodEnd_idx" ON "ManagerAllotment"("managerId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "WellnessTask_isActive_idx" ON "WellnessTask"("isActive");

-- CreateIndex
CREATE INDEX "WellnessSubmission_employeeId_idx" ON "WellnessSubmission"("employeeId");

-- CreateIndex
CREATE INDEX "WellnessSubmission_status_idx" ON "WellnessSubmission"("status");

-- CreateIndex
CREATE INDEX "WellnessSubmission_wellnessTaskId_idx" ON "WellnessSubmission"("wellnessTaskId");

-- CreateIndex
CREATE INDEX "PeerTransferLimit_employeeId_periodStart_periodEnd_idx" ON "PeerTransferLimit"("employeeId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_sourceEmployeeId_manager_fkey" FOREIGN KEY ("sourceEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_sourceEmployeeId_transfer_fkey" FOREIGN KEY ("sourceEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_targetEmployeeId_fkey" FOREIGN KEY ("targetEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_wellnessSubmissionId_fkey" FOREIGN KEY ("wellnessSubmissionId") REFERENCES "WellnessSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerAllotment" ADD CONSTRAINT "ManagerAllotment_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSubmission" ADD CONSTRAINT "WellnessSubmission_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSubmission" ADD CONSTRAINT "WellnessSubmission_wellnessTaskId_fkey" FOREIGN KEY ("wellnessTaskId") REFERENCES "WellnessTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessSubmission" ADD CONSTRAINT "WellnessSubmission_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PeerTransferLimit" ADD CONSTRAINT "PeerTransferLimit_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

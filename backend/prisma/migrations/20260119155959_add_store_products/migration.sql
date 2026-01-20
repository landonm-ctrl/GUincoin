-- CreateEnum
CREATE TYPE "StoreProductSource" AS ENUM ('custom', 'amazon', 'amazon_list');

-- CreateTable
CREATE TABLE "StoreProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "amazonUrl" TEXT,
    "amazonAsin" TEXT,
    "source" "StoreProductSource" NOT NULL,
    "priceUsd" DECIMAL(10,2),
    "priceGuincoin" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StoreProduct_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreProduct_amazonAsin_key" ON "StoreProduct"("amazonAsin");

-- CreateIndex
CREATE INDEX "StoreProduct_isActive_idx" ON "StoreProduct"("isActive");

-- CreateIndex
CREATE INDEX "StoreProduct_source_idx" ON "StoreProduct"("source");

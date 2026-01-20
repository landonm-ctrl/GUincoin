import { StoreProduct } from '@prisma/client';

export const GUINCOIN_PER_USD = 10;

export const usdToGuincoin = (usd: number): number =>
  Math.round(usd * GUINCOIN_PER_USD * 100) / 100;

export const normalizeStoreProduct = (product: StoreProduct) => ({
  ...product,
  priceUsd: product.priceUsd ? Number(product.priceUsd) : null,
  priceGuincoin: Number(product.priceGuincoin),
});

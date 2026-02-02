import { Decimal } from '@prisma/client/runtime/library';

/** Safely convert a Prisma Decimal, string, or number to a plain number. */
export function toNumber(value: Decimal | string | number | null | undefined): number {
  if (value == null) return 0;
  if (typeof value === 'number') return value;
  return Number(value);
}

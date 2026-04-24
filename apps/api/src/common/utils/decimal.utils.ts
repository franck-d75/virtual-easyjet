import type { Prisma } from "@va/database";

export function decimalToNumber(
  value: Prisma.Decimal | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}


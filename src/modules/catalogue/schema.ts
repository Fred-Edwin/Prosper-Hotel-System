import type { ProductKind } from "@/generated/prisma/enums";

export type { ProductKind };

export type Product = {
  id: string;
  name: string;
  kind: ProductKind;
};

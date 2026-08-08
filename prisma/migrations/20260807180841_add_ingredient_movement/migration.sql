-- CreateTable
CREATE TABLE "ingredient_movements" (
    "id" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "unitCostMinor" INTEGER NOT NULL,
    "staffMemberId" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingredient_movements_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "ingredients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingredient_movements" ADD CONSTRAINT "ingredient_movements_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "staff_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "drawing_repayments" (
    "id" TEXT NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "recordedBy" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversed" BOOLEAN NOT NULL DEFAULT false,
    "reversedAt" TIMESTAMP(3),

    CONSTRAINT "drawing_repayments_pkey" PRIMARY KEY ("id")
);

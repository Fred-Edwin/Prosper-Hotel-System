import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.TEST_DATABASE_URL,
});

export const testDb = new PrismaClient({ adapter });

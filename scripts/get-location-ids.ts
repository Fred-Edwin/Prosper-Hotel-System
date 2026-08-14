import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

async function main() {
  const locations = await db.location.findMany();
  for (const l of locations) console.log(l.code, l.id);
  await db.$disconnect();
}
main();

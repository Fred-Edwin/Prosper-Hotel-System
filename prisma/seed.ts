import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPin } from "@/modules/people";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Every staff member's PIN in seed data, for easy manual login while testing.
const SEED_PIN = "1234";

async function main() {
  await db.session.deleteMany({});
  await db.staffMember.deleteMany({});
  await db.location.deleteMany({});

  const restaurant = await db.location.create({
    data: { code: "restaurant", name: "Prosper Restaurant" },
  });
  const canteen = await db.location.create({
    data: { code: "canteen", name: "Prosper Canteen" },
  });

  const pinHash = await hashPin(SEED_PIN);

  await db.staffMember.createMany({
    data: [
      {
        name: "Grace Wanjiru",
        phone: "+254700000001",
        pinHash,
        role: "owner",
        locationId: restaurant.id,
        active: true,
      },
      {
        name: "Janiffer Achieng",
        phone: "+254700000002",
        pinHash,
        role: "store_manager",
        locationId: restaurant.id,
        active: true,
      },
      {
        name: "Sarah Njeri",
        phone: "+254700000003",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        active: true,
      },
      {
        name: "Brian Otieno",
        phone: "+254700000004",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        active: true,
      },
      {
        name: "Anne Wambui",
        phone: "+254700000005",
        pinHash,
        role: "attendant",
        locationId: canteen.id,
        active: true,
      },
      {
        name: "Peter Kiptoo",
        phone: "+254700000006",
        pinHash,
        role: "attendant",
        locationId: canteen.id,
        active: true,
      },
      // Edge case: deactivated staff member — must never authenticate,
      // but sales/history attributed to her must remain intact.
      {
        name: "Faith Mumbi",
        phone: "+254700000007",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        active: false,
      },
      // Edge case: a 200-character name.
      {
        name: "Nakhumicha Wafula Nabwire Adhiambo Chebet Wanjala Mutindi Barasa Kavutha Nyaboke Wangui Cherotich Auma Njoki Kemunto Achola Wairimu Kimani Owino Muthoni Kiplagat Adero Wangechi Nyawira Kiplimo Mumbua",
        phone: "+254700000008",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        active: true,
      },
    ],
  });

  console.log("Seeded 2 locations and 8 staff members.");
  console.log(`Every seeded staff member's PIN is ${SEED_PIN}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

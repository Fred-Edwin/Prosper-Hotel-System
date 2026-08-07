import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPin } from "@/modules/people";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Every staff member's PIN in seed data, for easy manual login while testing.
const SEED_PIN = "1234";

async function main() {
  await db.stockMovement.deleteMany({});
  await db.product.deleteMany({});
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

  const sarah = await db.staffMember.findUniqueOrThrow({
    where: { phone: "+254700000003" },
  });
  const anne = await db.staffMember.findUniqueOrThrow({
    where: { phone: "+254700000005" },
  });

  const [sodas, mukimo, chips, paper, biscuits] = await Promise.all([
    db.product.create({ data: { name: "Sodas (500ml)", kind: "goods" } }),
    db.product.create({ data: { name: "Mukimo", kind: "cooked_food" } }),
    db.product.create({ data: { name: "Chips", kind: "cooked_food" } }),
    db.product.create({ data: { name: "Printing paper (ream)", kind: "goods" } }),
    db.product.create({ data: { name: "Biscuits (packet)", kind: "goods" } }),
  ]);

  await db.stockMovement.createMany({
    data: [
      // Restaurant: a normal item with stock on hand.
      { productId: sodas.id, locationId: restaurant.id, quantity: 60, reason: "received", staffMemberId: sarah.id },
      { productId: sodas.id, locationId: restaurant.id, quantity: -18, reason: "sold", staffMemberId: sarah.id },
      { productId: mukimo.id, locationId: restaurant.id, quantity: 25, reason: "received", staffMemberId: sarah.id },
      { productId: mukimo.id, locationId: restaurant.id, quantity: -20, reason: "sold", staffMemberId: sarah.id },
      // Edge case: a product received then fully sold/wasted — zero on hand,
      // but still a row (not absent) so a cashier can tell "we had this and
      // ran out" apart from "we never stocked this".
      { productId: chips.id, locationId: restaurant.id, quantity: 15, reason: "received", staffMemberId: sarah.id },
      { productId: chips.id, locationId: restaurant.id, quantity: -12, reason: "sold", staffMemberId: sarah.id },
      { productId: chips.id, locationId: restaurant.id, quantity: -3, reason: "wasted", staffMemberId: sarah.id },
      // Printing paper only ever at the canteen — restaurant never received it,
      // so it correctly never appears in the restaurant's stock list.
      { productId: paper.id, locationId: canteen.id, quantity: 40, reason: "received", staffMemberId: anne.id },
      { productId: paper.id, locationId: canteen.id, quantity: -6, reason: "sold", staffMemberId: anne.id },
      { productId: biscuits.id, locationId: canteen.id, quantity: 100, reason: "received", staffMemberId: anne.id },
      { productId: biscuits.id, locationId: canteen.id, quantity: -32, reason: "sold", staffMemberId: anne.id },
    ],
  });

  console.log("Seeded 2 locations, 8 staff members, 5 products and stock movements.");
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

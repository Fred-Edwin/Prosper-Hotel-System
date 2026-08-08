import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPin } from "@/modules/people";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Every staff member's PIN in seed data, for easy manual login while testing.
const SEED_PIN = "1234";

async function main() {
  await db.paymentLine.deleteMany({});
  await db.saleLine.deleteMany({});
  await db.sale.deleteMany({});
  await db.customer.deleteMany({});
  await db.recipeLine.deleteMany({});
  await db.recipe.deleteMany({});
  await db.ingredientMovement.deleteMany({});
  await db.ingredient.deleteMany({});
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
        name: "Admin Owner",
        phone: "+254700000001",
        pinHash,
        role: "owner",
        locationId: restaurant.id,
        active: true,
      },
      {
        name: "Store Manager",
        phone: "+254700000002",
        pinHash,
        role: "store_manager",
        locationId: restaurant.id,
        active: true,
      },
      {
        name: "Restaurant Cashier",
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
        name: "Canteen Attendant",
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
    db.product.create({ data: { name: "Sodas (500ml)", kind: "goods", priceMinor: 80 } }),
    db.product.create({ data: { name: "Mukimo", kind: "cooked_food", priceMinor: 150 } }),
    db.product.create({ data: { name: "Chips", kind: "cooked_food", priceMinor: 100 } }),
    db.product.create({ data: { name: "Printing paper (ream)", kind: "goods", priceMinor: 550 } }),
    db.product.create({ data: { name: "Biscuits (packet)", kind: "goods", priceMinor: 50 } }),
  ]);

  const [maizeFlour, cookingOil, potatoes] = await Promise.all([
    db.ingredient.create({ data: { name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 120 } }),
    db.ingredient.create({ data: { name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 280 } }),
    db.ingredient.create({ data: { name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 80 } }),
  ]);

  // More ingredients purely so the receiving screen's picker/search has a
  // realistic list to exercise, not just the three the Recipes tab needs.
  // A mix of known and unknown last cost (the input pre-fill only fires for
  // the former), varied units, and one inactive — provably excluded from
  // the picker rather than just untested.
  await db.ingredient.createMany({
    data: [
      { name: "Rice", unitOfMeasure: "kg", lastKnownCostMinor: 150 },
      { name: "Onions", unitOfMeasure: "kg", lastKnownCostMinor: 90 },
      { name: "Tomatoes", unitOfMeasure: "kg", lastKnownCostMinor: 100 },
      { name: "Sugar", unitOfMeasure: "kg", lastKnownCostMinor: 140 },
      { name: "Tea leaves", unitOfMeasure: "packet", lastKnownCostMinor: 200 },
      { name: "Salt", unitOfMeasure: "kg", lastKnownCostMinor: 50 },
      { name: "Charcoal", unitOfMeasure: "bag", lastKnownCostMinor: 900 },
      { name: "Printing paper (bulk)", unitOfMeasure: "ream", lastKnownCostMinor: null },
      { name: "Toner", unitOfMeasure: "cartridge", lastKnownCostMinor: null },
      { name: "Discontinued spice mix", unitOfMeasure: "kg", lastKnownCostMinor: 60, active: false },
    ],
  });

  // Mukimo has a recipe (so the Recipes tab shows a real cost); Chips does
  // not — the absence is deliberate, per design.md: "a list of fifteen with
  // twelve blank states it" — the Recipes tab must show both cases.
  await db.recipe.create({
    data: {
      productId: mukimo.id,
      yieldQuantity: 10,
      effectiveFrom: new Date(),
      lines: {
        create: [
          { ingredientId: maizeFlour.id, quantity: 3 },
          { ingredientId: potatoes.id, quantity: 4 },
          { ingredientId: cookingOil.id, quantity: 0.5 },
        ],
      },
    },
  });

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

  console.log(
    "Seeded 2 locations, 8 staff members, 5 products, 13 ingredients, 1 recipe and stock movements.",
  );
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

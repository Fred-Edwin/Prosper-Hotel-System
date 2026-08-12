import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPin } from "@/modules/people";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

// Every staff member's PIN in seed data, for easy manual login while testing.
const SEED_PIN = "1234";

// "Today" for every date-scoped screen (Dashboard's Handover section,
// Today's Sales, Handover's already-done state) — must be real today, not a
// fixed historical date, or those screens render empty first-use states.
const today = new Date();
function todayAt(hour: number, minute = 0) {
  const d = new Date(today);
  d.setHours(hour, minute, 0, 0);
  return d;
}
function daysAgoAt(days: number, hour: number, minute = 0) {
  const d = new Date(today);
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  await db.drawingDebt.deleteMany({});
  await db.expense.deleteMany({});
  await db.handover.deleteMany({});
  await db.stockCountLine.deleteMany({});
  await db.stockCount.deleteMany({});
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
        dailyRateMinor: 0,
        active: true,
      },
      {
        name: "Store Manager",
        phone: "+254700000002",
        pinHash,
        role: "store_manager",
        locationId: restaurant.id,
        dailyRateMinor: 700,
        active: true,
      },
      {
        name: "Restaurant Cashier",
        phone: "+254700000003",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        dailyRateMinor: 550,
        active: true,
      },
      {
        name: "Brian Otieno",
        phone: "+254700000004",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        dailyRateMinor: 550,
        active: true,
      },
      {
        name: "Canteen Attendant",
        phone: "+254700000005",
        pinHash,
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
        active: true,
      },
      {
        name: "Peter Kiptoo",
        phone: "+254700000006",
        pinHash,
        role: "attendant",
        locationId: canteen.id,
        dailyRateMinor: 600,
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
        dailyRateMinor: 550,
        active: false,
      },
      // Edge case: a 200-character name.
      {
        name: "Nakhumicha Wafula Nabwire Adhiambo Chebet Wanjala Mutindi Barasa Kavutha Nyaboke Wangui Cherotich Auma Njoki Kemunto Achola Wairimu Kimani Owino Muthoni Kiplagat Adero Wangechi Nyawira Kiplimo Mumbua",
        phone: "+254700000008",
        pinHash,
        role: "cashier",
        locationId: restaurant.id,
        dailyRateMinor: 550,
        active: true,
      },
    ],
  });

  const owner = await db.staffMember.findUniqueOrThrow({ where: { phone: "+254700000001" } });
  const manager = await db.staffMember.findUniqueOrThrow({ where: { phone: "+254700000002" } });
  const sarah = await db.staffMember.findUniqueOrThrow({ where: { phone: "+254700000003" } });
  const brian = await db.staffMember.findUniqueOrThrow({ where: { phone: "+254700000004" } });
  const anne = await db.staffMember.findUniqueOrThrow({ where: { phone: "+254700000005" } });
  const peter = await db.staffMember.findUniqueOrThrow({ where: { phone: "+254700000006" } });

  const [sodas, mukimo, chips, paper, biscuits, photocopy, deliveryBox] = await Promise.all([
    db.product.create({ data: { name: "Sodas (500ml)", kind: "goods", priceMinor: 80 } }),
    db.product.create({ data: { name: "Mukimo", kind: "cooked_food", priceMinor: 150 } }),
    // lowStockLevel set (and never restocked below) so the dashboard's
    // low-stock indicator has a real example to show, not just the
    // fully-depleted chips edge case above zero.
    db.product.create({ data: { name: "Chips", kind: "cooked_food", priceMinor: 100, lowStockLevel: 5 } }),
    db.product.create({ data: { name: "Printing paper (ream)", kind: "goods", priceMinor: 550 } }),
    db.product.create({ data: { name: "Biscuits (packet)", kind: "goods", priceMinor: 50 } }),
    // Edge case: fourth ProductKind (service) so the catalogue's kind filter
    // and grouping has an example of all four.
    db.product.create({ data: { name: "Photocopy (per page)", kind: "service", priceMinor: 5 } }),
    // Edge case: fourth ProductKind (packaging), and inactive + no price at
    // once — proves the Price column's "—" and the "Inactive" badge coexist.
    db.product.create({ data: { name: "Delivery box", kind: "packaging", priceMinor: null, active: false } }),
    // Rice plate: a cooked_food product with a deliberately thin margin, to
    // demonstrate the Recipes tab's below-40%-margin warning.
    db.product.create({ data: { name: "Rice plate", kind: "cooked_food", priceMinor: 120 } }),
  ]);
  const ricePlate = await db.product.findUniqueOrThrow({ where: { name: "Rice plate" } });

  const [maizeFlour, cookingOil, potatoes] = await Promise.all([
    db.ingredient.create({ data: { name: "Maize flour", unitOfMeasure: "kg", lastKnownCostMinor: 120 } }),
    db.ingredient.create({ data: { name: "Cooking oil", unitOfMeasure: "litre", lastKnownCostMinor: 280 } }),
    db.ingredient.create({ data: { name: "Potatoes", unitOfMeasure: "kg", lastKnownCostMinor: 80 } }),
  ]);
  const rice = await db.ingredient.create({ data: { name: "Rice", unitOfMeasure: "kg", lastKnownCostMinor: 150 } });

  // More ingredients purely so the receiving screen's picker/search has a
  // realistic list to exercise, not just the ones the Recipes tab needs.
  // A mix of known and unknown last cost (the input pre-fill only fires for
  // the former), varied units, and one inactive — provably excluded from
  // the picker rather than just untested.
  const tea = await db.ingredient.create({ data: { name: "Tea leaves", unitOfMeasure: "packet", lastKnownCostMinor: 200 } });
  await db.ingredient.createMany({
    data: [
      { name: "Onions", unitOfMeasure: "kg", lastKnownCostMinor: 90 },
      { name: "Tomatoes", unitOfMeasure: "kg", lastKnownCostMinor: 100 },
      { name: "Sugar", unitOfMeasure: "kg", lastKnownCostMinor: 140 },
      { name: "Salt", unitOfMeasure: "kg", lastKnownCostMinor: 50 },
      { name: "Charcoal", unitOfMeasure: "bag", lastKnownCostMinor: 900 },
      { name: "Printing paper (bulk)", unitOfMeasure: "ream", lastKnownCostMinor: null },
      { name: "Toner", unitOfMeasure: "cartridge", lastKnownCostMinor: null },
      { name: "Discontinued spice mix", unitOfMeasure: "kg", lastKnownCostMinor: 60, active: false },
    ],
  });

  // Mukimo has a recipe with two versions (so Recipe's version-history delta
  // and "in use" badge both have something to show); Chips has none —
  // absence is deliberate, per design.md: "a list of fifteen with twelve
  // blank states it" — the Recipes tab must show both cases.
  await db.recipe.create({
    data: {
      productId: mukimo.id,
      yieldQuantity: 10,
      effectiveFrom: daysAgoAt(30, 8),
      lines: {
        create: [
          { ingredientId: maizeFlour.id, quantity: 3 },
          { ingredientId: potatoes.id, quantity: 5 },
          { ingredientId: cookingOil.id, quantity: 0.6 },
        ],
      },
    },
  });
  await db.recipe.create({
    data: {
      productId: mukimo.id,
      yieldQuantity: 10,
      effectiveFrom: daysAgoAt(2, 8),
      lines: {
        create: [
          { ingredientId: maizeFlour.id, quantity: 3 },
          { ingredientId: potatoes.id, quantity: 4 },
          { ingredientId: cookingOil.id, quantity: 0.5 },
        ],
      },
    },
  });
  // Rice plate: recipe priced deliberately close to ingredient cost so its
  // margin lands under 40% — Recipes tab's warning-state demo.
  await db.recipe.create({
    data: {
      productId: ricePlate.id,
      yieldQuantity: 10,
      effectiveFrom: daysAgoAt(10, 8),
      lines: {
        create: [
          { ingredientId: rice.id, quantity: 8 },
          { ingredientId: cookingOil.id, quantity: 0.4 },
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
      { productId: ricePlate.id, locationId: restaurant.id, quantity: 20, reason: "produced", staffMemberId: manager.id },
      { productId: ricePlate.id, locationId: restaurant.id, quantity: -9, reason: "sold", staffMemberId: sarah.id },
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
      { productId: photocopy.id, locationId: canteen.id, quantity: 500, reason: "received", staffMemberId: anne.id },
      { productId: photocopy.id, locationId: canteen.id, quantity: -120, reason: "sold", staffMemberId: anne.id },
    ],
  });

  await db.ingredientMovement.createMany({
    data: [
      { ingredientId: maizeFlour.id, locationId: restaurant.id, quantity: 50, reason: "received", unitCostMinor: 120, staffMemberId: manager.id, occurredAt: daysAgoAt(3, 9) },
      { ingredientId: cookingOil.id, locationId: restaurant.id, quantity: 20, reason: "received", unitCostMinor: 280, staffMemberId: manager.id, occurredAt: daysAgoAt(3, 9) },
      { ingredientId: potatoes.id, locationId: restaurant.id, quantity: 60, reason: "received", unitCostMinor: 80, staffMemberId: manager.id, occurredAt: daysAgoAt(1, 9) },
      { ingredientId: rice.id, locationId: restaurant.id, quantity: 40, reason: "received", unitCostMinor: 150, staffMemberId: manager.id, occurredAt: daysAgoAt(1, 9) },
      // Ingredients issued to the kitchen for the production run recorded above.
      { ingredientId: maizeFlour.id, locationId: restaurant.id, quantity: 15, reason: "issued", staffMemberId: manager.id, occurredAt: todayAt(7) },
      { ingredientId: potatoes.id, locationId: restaurant.id, quantity: 20, reason: "issued", staffMemberId: manager.id, occurredAt: todayAt(7) },
      { ingredientId: cookingOil.id, locationId: restaurant.id, quantity: 2, reason: "issued", staffMemberId: manager.id, occurredAt: todayAt(7) },
      // Wastage / consumed / given_away — all three non-sales categories,
      // per proposal.md's "wasted, consumed, given-away" sibling read.
      { ingredientId: potatoes.id, locationId: restaurant.id, quantity: 2, reason: "wasted", costBasisMinor: 80, isEstimated: false, staffMemberId: manager.id, occurredAt: daysAgoAt(1, 18) },
      { ingredientId: rice.id, locationId: restaurant.id, quantity: 1, reason: "consumed", costBasisMinor: 150, isEstimated: false, staffMemberId: manager.id, occurredAt: daysAgoAt(2, 18) },
      { ingredientId: tea.id, locationId: restaurant.id, quantity: 1, reason: "given_away", costBasisMinor: 200, isEstimated: true, staffMemberId: manager.id, occurredAt: daysAgoAt(4, 12) },
    ],
  });

  // Customers — some with an outstanding credit balance (for the New Sale
  // customer picker and the credit-sale demo), one fully settled.
  const janeCustomer = await db.customer.create({ data: { name: "Jane Wanjiru", phone: "+254711000001" } });
  const kevinCustomer = await db.customer.create({ data: { name: "Kevin Mwangi", phone: "+254711000002" } });
  const officeCustomer = await db.customer.create({ data: { name: "Riverside Offices Ltd", phone: "+254711000003" } });

  // Today's sales for Sarah (cashier) — spans counter/delivery, split
  // payment, credit, and one voided sale, all dated today so Today's Sales
  // and the Dashboard handover math both have real data to read.
  const saleCounterCash = await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: sarah.id,
      fulfilment: "counter",
      totalMinor: 320,
      occurredAt: todayAt(9, 10),
      lines: { create: [{ productId: sodas.id, quantity: 4, priceMinor: 80 }] },
      paymentLines: { create: [{ method: "cash", amountMinor: 320 }] },
    },
  });

  const saleSplit = await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: sarah.id,
      fulfilment: "counter",
      totalMinor: 400,
      occurredAt: todayAt(12, 30),
      lines: { create: [{ productId: mukimo.id, quantity: 2, priceMinor: 150 }, { productId: sodas.id, quantity: 1, priceMinor: 80 }, { productId: sodas.id, quantity: 1, priceMinor: 20 }] },
      paymentLines: { create: [{ method: "cash", amountMinor: 250 }, { method: "mpesa", amountMinor: 150 }] },
    },
  });

  const saleCredit = await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: sarah.id,
      fulfilment: "counter",
      customerId: janeCustomer.id,
      totalMinor: 300,
      occurredAt: todayAt(13, 5),
      lines: { create: [{ productId: mukimo.id, quantity: 2, priceMinor: 150 }] },
      paymentLines: { create: [{ method: "credit", amountMinor: 300, customerId: janeCustomer.id }] },
    },
  });

  const saleDelivery = await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: sarah.id,
      fulfilment: "delivery",
      customerId: officeCustomer.id,
      totalMinor: 850,
      deliveryFeeMinor: 100,
      occurredAt: todayAt(14, 20),
      lines: { create: [{ productId: chips.id, quantity: 5, priceMinor: 100 }, { productId: sodas.id, quantity: 3, priceMinor: 80 }, { productId: sodas.id, quantity: 1, priceMinor: 10 }] },
      paymentLines: { create: [{ method: "mpesa", amountMinor: 850 }] },
    },
  });

  // Older settled credit line for Kevin, so at least one customer's balance
  // reads as fully paid rather than every seeded customer being in debt.
  await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: brian.id,
      fulfilment: "counter",
      customerId: kevinCustomer.id,
      totalMinor: 150,
      occurredAt: daysAgoAt(5, 11),
      lines: { create: [{ productId: chips.id, quantity: 1, priceMinor: 100 }, { productId: sodas.id, quantity: 1, priceMinor: 50 }] },
      paymentLines: { create: [{ method: "cash", amountMinor: 150 }] },
    },
  });

  // A sale voided today — dimmed row + "Voided" badge in Today's Sales.
  await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: sarah.id,
      fulfilment: "counter",
      totalMinor: 100,
      occurredAt: todayAt(10, 45),
      voided: true,
      voidedAt: todayAt(10, 50),
      voidedBy: sarah.id,
      lines: { create: [{ productId: chips.id, quantity: 1, priceMinor: 100 }] },
      paymentLines: { create: [{ method: "cash", amountMinor: 100 }] },
    },
  });

  // Brian's own today sale, so a second cashier's Today's Sales isn't empty.
  await db.sale.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: brian.id,
      fulfilment: "counter",
      totalMinor: 160,
      occurredAt: todayAt(11, 0),
      lines: { create: [{ productId: sodas.id, quantity: 2, priceMinor: 80 }] },
      paymentLines: { create: [{ method: "cash", amountMinor: 160 }] },
    },
  });

  const todaysRestaurantSalesTotal =
    saleCounterCash.totalMinor + saleSplit.totalMinor + saleCredit.totalMinor + saleDelivery.totalMinor;
  const todaysRestaurantCash = 320 + 250; // saleCounterCash + saleSplit's cash line
  const todaysRestaurantMpesa = 150 + 850; // saleSplit's mpesa line + saleDelivery

  // Handovers — Sarah's matches exactly ("Agreed"); Brian is short, to show
  // the destructive-styled mismatch badge. Both dated today so Dashboard's
  // Handover section (today-scoped) has rows. Store Manager has NOT handed
  // over today, to demo the staff-home "hand over — reminder" state and the
  // Handover screen's blank (not-yet-done) flow when logging in as him.
  await db.handover.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: sarah.id,
      expectedCashMinor: todaysRestaurantCash,
      expectedMpesaMinor: todaysRestaurantMpesa,
      actualCashMinor: todaysRestaurantCash,
      actualMpesaMinor: todaysRestaurantMpesa,
      occurredAt: todayAt(15, 0),
    },
  });
  await db.handover.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: brian.id,
      expectedCashMinor: 160,
      expectedMpesaMinor: 0,
      actualCashMinor: 140, // 20 short
      actualMpesaMinor: 0,
      occurredAt: todayAt(15, 10),
    },
  });

  // Expenses — one per category, plus one reversed, so Money Out's summary
  // math and category filter both have real rows across all four kinds.
  const stockExpenseReceiptId = "seed-receipt-flour-oil";
  await db.expense.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: owner.id,
      category: "stock",
      amountMinor: 50 * 120 + 20 * 280, // matches the flour/oil receiving above
      note: "Flour and cooking oil delivery",
      receiptId: stockExpenseReceiptId,
      occurredAt: daysAgoAt(3, 9, 15),
    },
  });
  await db.expense.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: owner.id,
      category: "running",
      amountMinor: 2500,
      note: "Electricity bill",
      occurredAt: daysAgoAt(2, 16),
    },
  });
  await db.expense.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: owner.id,
      category: "asset",
      amountMinor: 15000,
      note: "New gas cylinder",
      occurredAt: daysAgoAt(6, 10),
    },
  });
  await db.expense.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: owner.id,
      category: "drawing",
      amountMinor: 5000,
      note: "Owner drawing",
      occurredAt: daysAgoAt(1, 17),
    },
  });
  // A reversed expense — "Reversed" badge, muted amount, excluded from totals.
  await db.expense.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: owner.id,
      category: "running",
      amountMinor: 1200,
      note: "Water bill (recorded in error, duplicate)",
      occurredAt: daysAgoAt(4, 9),
      reversed: true,
      reversedAt: daysAgoAt(4, 9, 30),
      reversedBy: owner.id,
    },
  });

  // Stock counts — restaurant count has a mix of agreed, corrected, and
  // still-open differences, so the owner-only comparison view (Stock #4)
  // has all three line states to show. Canteen count is a plain, fully
  // agreed count so both locations have at least one count on record.
  const restaurantCount = await db.stockCount.create({
    data: {
      locationId: restaurant.id,
      staffMemberId: manager.id,
      occurredAt: daysAgoAt(1, 18, 30),
      lines: {
        create: [
          // Agreed — counted matches expected exactly.
          { itemType: "product", itemId: sodas.id, countedQuantity: 42, expectedQuantity: 42 },
          // Still-open difference — counted below expected, not yet corrected.
          { itemType: "ingredient", itemId: potatoes.id, countedQuantity: 35, expectedQuantity: 38 },
          // Already-corrected difference.
          {
            itemType: "ingredient",
            itemId: maizeFlour.id,
            countedQuantity: 33,
            expectedQuantity: 35,
            correctedAt: daysAgoAt(1, 19),
            correctedBy: owner.id,
          },
        ],
      },
    },
  });
  await db.stockCount.create({
    data: {
      locationId: canteen.id,
      staffMemberId: anne.id,
      occurredAt: daysAgoAt(2, 17),
      lines: {
        create: [
          { itemType: "product", itemId: biscuits.id, countedQuantity: 68, expectedQuantity: 68 },
          { itemType: "product", itemId: paper.id, countedQuantity: 34, expectedQuantity: 34 },
        ],
      },
    },
  });

  console.log(
    "Seeded 2 locations, 8 staff members, 8 products, 12 ingredients, 3 recipe versions, stock/ingredient movements, 3 customers, 7 sales (incl. delivery, credit, split payment, void), 2 handovers (1 agreed, 1 short), 5 expenses (1 reversed), and 2 stock counts (1 with open + corrected differences).",
  );
  console.log(`Every seeded staff member's PIN is ${SEED_PIN}.`);
  console.log("Log in as 'Restaurant Cashier' or 'Brian Otieno' to see today's sales and a completed handover.");
  console.log("Log in as 'Store Manager' to see the not-yet-handed-over reminder and blank handover flow.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });

import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { RecordStockCountView } from "./record-stock-count";

/**
 * Stock count — record what's physically on hand. Ticket 20.
 *
 * Default is interactive — search for a product or ingredient, tap to add
 * it as a line, fill in the counted quantity, then Record count. onSubmit
 * is stubbed so no network call leaves the story.
 *
 * 2026-08-15: canteen stories (isCanteen: true) show two new behaviours —
 * expected quantity displayed per product line while counting, and a
 * post-submit "this count means you sold" review before the read view.
 * Try counting a product short of its expected quantity (e.g. Soda 500ml,
 * expected 40 — count something less than 40) then Record count to see the
 * review populated; count everything at its expected quantity to see the
 * review's empty state instead.
 *
 * Also 2026-08-15: tapping a tile now expands it in place with a quantity
 * input, rather than sending her to a separate panel below the grid to
 * type — the CanteenWithTransferredStock story below shows the "My stock"
 * / "From restaurant" tab filter too, same pattern as stock-list.tsx and
 * new-sale.tsx, which only appears once transferred-in stock exists to
 * split against (every other story here has none, so the tabs stay
 * absent — that's the correct fallback, not a gap).
 */
const meta = {
  title: "Modules/Stock/RecordStockCount",
  component: RecordStockCountView,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof RecordStockCountView>;

export default meta;
type Story = StoryObj<typeof meta>;

const items = [
  { id: "p1", name: "Soda 500ml", itemType: "product" as const, unit: "unit" },
  { id: "p2", name: "Mukimo", itemType: "product" as const, unit: "unit" },
  { id: "p3", name: "Chapati", itemType: "product" as const, unit: "unit" },
  { id: "i1", name: "Flour", itemType: "ingredient" as const, unit: "kg" },
  { id: "i2", name: "Cooking oil", itemType: "ingredient" as const, unit: "litre" },
  { id: "i3", name: "Potatoes", itemType: "ingredient" as const, unit: "kg" },
];

const canteenItems = [
  { id: "p1", name: "Soda 500ml", itemType: "product" as const, unit: "unit", expectedQuantity: 40, priceMinor: 10000 },
  { id: "p2", name: "Samosa", itemType: "product" as const, unit: "unit", expectedQuantity: 25, priceMinor: 5000 },
  { id: "p3", name: "Exercise book", itemType: "product" as const, unit: "unit", expectedQuantity: 60, priceMinor: 3000 },
];

// Same locationId shape stock-list.tsx and new-sale.tsx already use to
// split "My stock" from "From restaurant" — a product line's locationId
// equal to the canteen's own id is hers; anything else is transferred in.
const canteenItemsWithTransferredStock = [
  {
    id: "p1",
    name: "Exercise book",
    itemType: "product" as const,
    unit: "unit",
    expectedQuantity: 60,
    priceMinor: 3000,
    locationId: "loc-canteen",
  },
  {
    id: "p2",
    name: "Cakes",
    itemType: "product" as const,
    unit: "unit",
    expectedQuantity: 12,
    priceMinor: 15000,
    locationId: "loc-restaurant",
  },
  {
    id: "p3",
    name: "Samosa",
    itemType: "product" as const,
    unit: "unit",
    expectedQuantity: 25,
    priceMinor: 5000,
    locationId: "loc-restaurant",
  },
];

const stubSubmit = async () => ({ ok: true as const, countId: "count-1", lines: [] });

// Simulates recordStockCount's own comparison (soda and samosa counted
// short of expected; exercise books counted exactly) — mirrors what the
// backend would echo back in the count's confirmation for a canteen caller.
const stubSubmitCanteenShortfall = async () => ({
  ok: true as const,
  countId: "count-2",
  lines: [
    { itemType: "product" as const, itemId: "p1", countedQuantity: 33, expectedQuantity: 40 },
    { itemType: "product" as const, itemId: "p2", countedQuantity: 20, expectedQuantity: 25 },
    { itemType: "product" as const, itemId: "p3", countedQuantity: 60, expectedQuantity: 60 },
  ],
});

const stubSubmitCanteenNoShortfall = async () => ({
  ok: true as const,
  countId: "count-3",
  lines: [
    { itemType: "product" as const, itemId: "p1", countedQuantity: 40, expectedQuantity: 40 },
    { itemType: "product" as const, itemId: "p2", countedQuantity: 25, expectedQuantity: 25 },
  ],
});

// A real canteen catalogue is large enough that the grid runs well past
// one screen — this reproduces that so the sticky search bar / sticky
// footer can be checked against genuine scroll, not a handful of tiles
// that never overflow the viewport in the first place.
const manyCanteenItems = [
  "Soda 500ml", "Soda 300ml", "Water 500ml", "Water 1L", "Samosa", "Sausage",
  "Smokie", "Mandazi", "Chapati", "Boiled egg", "Exercise book", "Biro pen",
  "Pencil", "Ruler", "Eraser", "Sharpener", "Cakes", "Bread", "Milk 500ml",
  "Yoghurt", "Juice box", "Crisps", "Biscuits", "Sweets", "Gum", "Sugar 1kg",
  "Tea leaves", "Coffee sachet", "Matchbox", "Candle",
].map((name, i) => ({
  id: `p${i + 1}`,
  name,
  itemType: "product" as const,
  unit: "unit",
  expectedQuantity: 20 + i,
  priceMinor: 5000 + i * 100,
}));

const locations = [
  { id: "loc-restaurant", code: "restaurant", name: "Prosper Restaurant" },
  { id: "loc-canteen", code: "canteen", name: "Prosper Canteen" },
];

export const Default: Story = {
  args: {
    state: { status: "ready", items },
    locations,
    locationId: "loc-restaurant",
    onSubmit: stubSubmit,
  },
};

export const CanteenWithShortfall: Story = {
  name: "Canteen — expected quantity shown, review has a shortfall",
  args: {
    state: { status: "ready", items: canteenItems },
    locations,
    locationId: "loc-canteen",
    isCanteen: true,
    onSubmit: stubSubmitCanteenShortfall,
  },
};

export const CanteenWithTransferredStock: Story = {
  name: "Canteen — My stock / From restaurant tabs, tap a tile to count it",
  args: {
    state: { status: "ready", items: canteenItemsWithTransferredStock },
    locations,
    locationId: "loc-canteen",
    isCanteen: true,
    onSubmit: stubSubmit,
  },
};

export const CanteenNoShortfall: Story = {
  name: "Canteen — review empty, nothing counted short",
  args: {
    state: { status: "ready", items: canteenItems },
    locations,
    locationId: "loc-canteen",
    isCanteen: true,
    onSubmit: stubSubmitCanteenNoShortfall,
  },
};

export const CanteenLongCatalogue: Story = {
  name: "Canteen — long catalogue, check sticky search bar and footer",
  args: {
    state: { status: "ready", items: manyCanteenItems },
    locations,
    locationId: "loc-canteen",
    isCanteen: true,
    onSubmit: stubSubmit,
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" }, locations, locationId: "loc-restaurant" },
};

export const Empty: Story = {
  name: "Empty — first use",
  args: { state: { status: "ready", items: [] }, locations, locationId: "loc-restaurant" },
};

export const Error: Story = {
  args: { state: { status: "error" }, locations, locationId: "loc-restaurant" },
};

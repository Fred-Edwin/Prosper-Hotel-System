import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { StoreLedgerView, type StoreLedgerRowData, type StoreLedgerDayData } from "./store-ledger";

/**
 * The Ledger's Store tab (ticket 42, made editable by editable-ledger T6).
 * Real seed-shaped data: an ingredient whose cost moved within the period
 * (the up/down indicator) and one that didn't. Mounts `StoreLedgerView`
 * directly, same split as `ProductLedgerView`'s story: no network in
 * Storybook, only `LedgerShellView`'s real page composition supplies the
 * fetching `StoreLedger`.
 *
 * **Editing is off in most stories, and that is the point.** The view
 * treats `onReplaceRows` as the editing switch — without it every cell is
 * read-only, which is exactly the shape the reading stories want. The
 * `Editable` story passes a no-op so the hover affordance and the day-row
 * editors can be browsed.
 */

const days = (
  start: string,
  entries: Partial<StoreLedgerDayData>[],
  openingQty: number,
): StoreLedgerDayData[] => {
  let running = openingQty;
  return entries.map((e, i) => {
    const date = new Date(`${start}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + i);
    const day: StoreLedgerDayData = {
      date: date.toISOString().slice(0, 10),
      openingQty: running,
      purchasedQty: 0,
      purchasedValueMinor: 0,
      issuedToKitchen: 0,
      transferredIn: 0,
      transferredOut: 0,
      spoilage: 0,
      corrected: 0,
      closingQty: 0,
      ...e,
    };
    day.openingQty = running;
    day.closingQty =
      day.openingQty +
      day.purchasedQty +
      day.transferredIn +
      day.corrected -
      day.issuedToKitchen -
      day.transferredOut -
      day.spoilage;
    running = day.closingQty;
    return day;
  });
};

const potatoesRow: StoreLedgerRowData = {
  ingredientId: "i1",
  ingredientName: "Potatoes",
  unitOfMeasure: "kg",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 34,
  purchasedQty: 120,
  purchasedValueMinor: 756000,
  issuedToKitchen: 104,
  transferredIn: 0,
  transferredOut: 0,
  spoilage: 2,
  corrected: 0,
  closingQty: 48,
  closingValueMinor: 312000,
  unitCostMinor: 6500,
  previousUnitCostMinor: 6100,
  days: days(
    "2026-08-14",
    [
      { purchasedQty: 60, purchasedValueMinor: 378000, issuedToKitchen: 22 },
      { issuedToKitchen: 26 },
      { purchasedQty: 60, purchasedValueMinor: 378000, issuedToKitchen: 20, spoilage: 2 },
      { issuedToKitchen: 18 },
      { issuedToKitchen: 18 },
    ],
    34,
  ),
};

const beefRow: StoreLedgerRowData = {
  ingredientId: "i2",
  ingredientName: "Beef",
  unitOfMeasure: "kg",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 6,
  purchasedQty: 36,
  purchasedValueMinor: 2088000,
  issuedToKitchen: 34,
  transferredIn: 0,
  transferredOut: 0,
  spoilage: 0,
  corrected: 0,
  closingQty: 8,
  closingValueMinor: 464000,
  unitCostMinor: 58000,
  previousUnitCostMinor: 56000,
  days: days(
    "2026-08-14",
    [
      { purchasedQty: 12, purchasedValueMinor: 696000, issuedToKitchen: 7 },
      { issuedToKitchen: 6 },
      { purchasedQty: 12, purchasedValueMinor: 696000, issuedToKitchen: 8 },
      { purchasedQty: 12, purchasedValueMinor: 696000, issuedToKitchen: 7 },
      { issuedToKitchen: 6 },
    ],
    6,
  ),
};

const cookingOilRow: StoreLedgerRowData = {
  ingredientId: "i3",
  ingredientName: "Cooking oil",
  unitOfMeasure: "L",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 18,
  purchasedQty: 12,
  purchasedValueMinor: 384000,
  issuedToKitchen: 16,
  transferredIn: 0,
  transferredOut: 0,
  spoilage: 0,
  corrected: 0,
  closingQty: 14,
  closingValueMinor: 448000,
  unitCostMinor: 32000,
  previousUnitCostMinor: 32000,
  days: days(
    "2026-08-14",
    [
      { issuedToKitchen: 4 },
      { purchasedQty: 12, purchasedValueMinor: 384000, issuedToKitchen: 3 },
      { issuedToKitchen: 3 },
      { issuedToKitchen: 3 },
      { issuedToKitchen: 3 },
    ],
    18,
  ),
};

const printingPaperRow: StoreLedgerRowData = {
  ingredientId: "i4",
  ingredientName: "Printing paper",
  unitOfMeasure: "ream",
  locationId: "loc-canteen",
  locationCode: "canteen",
  openingQty: 6,
  purchasedQty: 8,
  purchasedValueMinor: 496000,
  issuedToKitchen: 0,
  transferredIn: 0,
  transferredOut: 5,
  spoilage: 0,
  corrected: 0,
  closingQty: 9,
  closingValueMinor: 558000,
  unitCostMinor: 62000,
  previousUnitCostMinor: 60000,
  days: days(
    "2026-08-14",
    [
      { purchasedQty: 8, purchasedValueMinor: 496000 },
      {},
      { transferredOut: 3 },
      { transferredOut: 2 },
      {},
    ],
    6,
  ),
};

/**
 * An ingredient the owner has already corrected: her opening edit wrote a
 * `corrected` movement, which the ledger shows in its own signed column so
 * the row still reconciles on screen. Before T6 this column did not exist
 * and the correction moved closing with nothing to explain it.
 */
const riceRow: StoreLedgerRowData = {
  ingredientId: "i5",
  ingredientName: "Rice",
  unitOfMeasure: "kg",
  locationId: "loc-restaurant",
  locationCode: "restaurant",
  openingQty: 20,
  purchasedQty: 25,
  purchasedValueMinor: 412500,
  issuedToKitchen: 30,
  transferredIn: 0,
  transferredOut: 0,
  spoilage: 0,
  corrected: 4,
  closingQty: 19,
  closingValueMinor: 313500,
  unitCostMinor: 16500,
  previousUnitCostMinor: 16500,
  days: days(
    "2026-08-14",
    [
      { issuedToKitchen: 6 },
      { purchasedQty: 25, purchasedValueMinor: 412500, issuedToKitchen: 6 },
      { issuedToKitchen: 6, corrected: 4 },
      { issuedToKitchen: 6 },
      { issuedToKitchen: 6 },
    ],
    20,
  ),
};

const locations = [
  { id: "loc-restaurant", name: "Restaurant" },
  { id: "loc-canteen", name: "Canteen" },
];

const allRows = [potatoesRow, beefRow, cookingOilRow, printingPaperRow, riceRow];

const meta = {
  title: "Modules/Reporting/StoreLedger",
  component: StoreLedgerView,
  parameters: { layout: "padded" },
  args: { onRetry: () => {} },
} satisfies Meta<typeof StoreLedgerView>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Populated: Story = {
  name: "Populated table",
  args: {
    state: { status: "ready", rows: allRows, locations },
  },
};

export const CostMoved: Story = {
  name: "Cost-moved indicator shown",
  args: {
    state: { status: "ready", rows: [potatoesRow, beefRow], locations },
  },
};

export const DayExpanded: Story = {
  name: "Row expanded to days (T6)",
  args: {
    state: { status: "ready", rows: allRows, locations },
    initialExpandedRowKey: "i1:loc-restaurant",
  },
};

export const Corrected: Story = {
  name: "A day carrying an owner correction",
  args: {
    state: { status: "ready", rows: [riceRow], locations },
    initialExpandedRowKey: "i5:loc-restaurant",
  },
};

export const Editable: Story = {
  name: "Editable — hover a day cell",
  args: {
    state: { status: "ready", rows: allRows, locations },
    initialExpandedRowKey: "i1:loc-restaurant",
    // Presence of this handler is what turns editing on. A no-op here: the
    // story has no network, so a committed edit would have nothing to save
    // to — the affordance and the editor are what this story is for.
    onReplaceRows: () => {},
    periodStart: "2026-08-14T00:00:00.000Z",
    periodEnd: "2026-08-18T23:59:59.999Z",
  },
};

export const Loading: Story = {
  args: { state: { status: "loading" } },
};

export const EmptyNoMovements: Story = {
  name: "Empty — no movements in period",
  args: {
    state: { status: "ready", rows: [], locations },
  },
};

export const EmptyFiltered: Story = {
  name: "Empty — filtered to zero rows",
  args: {
    state: { status: "ready", rows: [potatoesRow, beefRow], locations },
    initialQuery: "nonexistent ingredient",
  },
};

export const Denied: Story = {
  name: "Permission denied — not the owner",
  args: { state: { status: "denied" } },
};

export const ErrorLoading: Story = {
  name: "Error loading the store ledger",
  args: { state: { status: "error" } },
};

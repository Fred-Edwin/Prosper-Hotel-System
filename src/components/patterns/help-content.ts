/**
 * Central map of approved help copy, keyed by nav destination. A
 * destination with tabs holds one section per tab so the panel opens
 * once per page and covers every tab in one scroll. Content is the
 * client-approved copy from docs/help-copy-*-draft.md, used verbatim.
 */

export type HelpSection = {
  heading: string;
  summary: string;
  points: string[];
};

export type HelpEntry = {
  title: string;
  sections: HelpSection[];
};

export const helpContent: Record<string, HelpEntry> = {
  dashboard: {
    title: "Dashboard",
    sections: [
      {
        heading: "Profit",
        summary: "Today's figures, at a glance.",
        points: [
          "Switch between Day / Week / Month.",
          "Revenue minus Cost of goods sold minus Running costs equals Net profit. Tap any figure to see how it's built up.",
          "Marked “partly provisional”: the canteen doesn't record every sale individually, so its cost of goods is partly an estimate based on your last stock count there. It corrects itself once you count again.",
          "Below that, the same figures broken down by location — Restaurant and Canteen side by side.",
        ],
      },
      {
        heading: "Quick figures",
        summary: "Cash position, M-Pesa balance, owed to you, your drawings.",
        points: [
          "Cash position and M-Pesa balance — what you're actually holding, after everything handed over, minus everything paid out.",
          "Owed to you — total unpaid credit across all customers.",
          "Your drawings — money you've personally taken out, minus what you've paid back.",
        ],
      },
      {
        heading: "Revenue and profit chart",
        summary: "Last 14 days, revenue and net profit side by side.",
        points: [
          "One bar per day for each. A day with no bar means the business didn't trade that day, not that it made nothing.",
        ],
      },
      {
        heading: "Needs you",
        summary: "Anything that doesn't look right today.",
        points: [
          "A staff member who handed over less than expected, or a sale that was voided.",
          "Nothing listed means everything agreed today.",
          "Tap an item to go straight to the record behind it.",
        ],
      },
      {
        heading: "Handovers",
        summary: "Restaurant only — the canteen doesn't hand over the same way.",
        points: [
          "Who handed over today, what they owed you, and what they actually gave you.",
          "Agreed means it matched exactly. Anything else is shown in red as the difference.",
        ],
      },
      {
        heading: "Stock movements",
        summary: "Everything that moved today, grouped by reason and location.",
        points: [
          "Received, sold, transferred, wasted, and so on.",
          "Wasted, consumed, and given-away rows are shown in red, since that's value lost rather than sold.",
        ],
      },
      {
        heading: "Restaurant store",
        summary: "Today's ingredient flow at the restaurant.",
        points: [
          "What came in, what went to the kitchen, what was sent to the canteen, and what's left.",
        ],
      },
    ],
  },

  ledger: {
    title: "Ledger",
    sections: [
      {
        heading: "Product ledger",
        summary: "Every product sold, with its cost and profit.",
        points: [
          "Search by name, filter by location or category.",
          "Tap a day to expand it into individual sales.",
        ],
      },
      {
        heading: "Store ledger",
        summary: "Ingredients moving through the store, valued at what you paid for them.",
        points: [
          "Search and filter by location.",
          "No day-by-day expansion here — this tab shows the running picture, not individual transactions.",
        ],
      },
      {
        heading: "Non-sales ledger",
        summary: "Stock that left without being sold: wasted, used internally, or given away.",
        points: [
          "Filter by reason, search by item or who recorded it.",
          "An “est” tag means the cost shown is an estimate, because no purchase price or recipe exists for that item.",
        ],
      },
      {
        heading: "Cash ledger",
        summary: "Every cash and M-Pesa movement, with a running balance for each, tracked separately.",
        points: [
          "Filter by category, search by note.",
          "Tap a day to expand it into individual transactions.",
        ],
      },
    ],
  },

  stock: {
    title: "Stock",
    sections: [
      {
        heading: "Stock",
        summary: "How much of everything you have right now.",
        points: [
          "Switch between Restaurant and Canteen if both have stock.",
          "Shows current quantity and current value of everything on hand.",
          "Low stock filter shows what's running out.",
          "Record a count: compare what's on the shelf to what the records say. A mismatch is shown as a difference, not corrected automatically — you decide separately whether to correct it.",
        ],
      },
    ],
  },

  "money-out": {
    title: "Money out",
    sections: [
      {
        heading: "Money out",
        summary: "Every payment you make out of the business — you're the only one who records this, which is what makes your cash balance trustworthy.",
        points: [
          "Record an expense: choose a category — stock, running cost (electricity, gas, rent), an asset (equipment/furniture), or a personal drawing.",
          "Asset purchases and personal drawings don't count against profit — they still cost cash, just not business expense.",
          "A drawing is tracked as a debt you owe back to the business.",
          "Made a mistake? Reverse the entry — it stays on record, just marked cancelled and excluded from your totals.",
        ],
      },
    ],
  },

  people: {
    title: "People",
    sections: [
      {
        heading: "Staff",
        summary: "Everyone who works here.",
        points: [
          "Add a staff member — set their name, PIN, role, and location.",
          "Edit their rate or role.",
          "Deactivate someone who's left. Their past sales stay on record; they just can't log in anymore.",
        ],
      },
      {
        heading: "Days worked",
        summary: "Days worked and pay owed.",
        points: [
          "Record a day worked for a staff member.",
          "See what's owed and mark it as paid.",
        ],
      },
      {
        heading: "Customers",
        summary: "Everyone who owes you money.",
        points: [
          "See who owes you money, and how much.",
          "Add a new customer for credit sales or deliveries.",
        ],
      },
    ],
  },

  catalogue: {
    title: "Catalogue",
    sections: [
      {
        heading: "Products",
        summary: "Everything you sell — food, drinks, goods, services.",
        points: [
          "Add or edit a product's price and details.",
          "Turn a product inactive to stop it appearing at the till, without losing its sales history.",
        ],
      },
      {
        heading: "Ingredients",
        summary: "Everything you buy to cook with, never sold directly.",
        points: [
          "Add or edit an ingredient and its unit (kg, litre, etc.).",
        ],
      },
      {
        heading: "Categories",
        summary: "Groups for your products and ingredients, used as filters in your reports.",
        points: [
          "Add, rename, or remove one.",
        ],
      },
      {
        heading: "Recipes",
        summary: "How much of each ingredient goes into a cooked dish, and what that costs you.",
        points: [
          "Build a recipe: pick ingredients and quantities.",
          "A dish can have more than one recipe version over time — older ones stay on record.",
          "Not every dish needs a recipe. Without one, you still see total profit — just not that dish's own margin.",
        ],
      },
      {
        heading: "Assets",
        summary: "Equipment and furniture you own.",
        points: [
          "Record one when you buy it. It doesn't count against profit — buying it just turns cash into something you still own.",
        ],
      },
    ],
  },

  activity: {
    title: "Activity",
    sections: [
      {
        heading: "Activity",
        summary: "A record of everything entered, including corrections to past records.",
        points: [
          "Filter by type of entry or by who recorded it. Search covers reason text too.",
          "A correction is shown differently from a normal entry — it's a new entry that fixes a past figure, with a reason and your name attached. The original figure is never erased.",
          "Record a correction from here when a physical count disagrees with the record and you've decided to fix it. Only you can do this.",
        ],
      },
    ],
  },

  "new-sale": {
    title: "New sale",
    sections: [
      {
        heading: "New sale",
        summary: "Recording a sale at the till.",
        points: [
          "Choose Counter (served now) or Delivery (taken to a customer — pick who it's for, and add a delivery fee if there is one).",
          "Tap products to add them. Use the search box to find one fast.",
          "Adjust quantity with + / −, or remove an item.",
          "Payment: choose Cash, M-Pesa, or Credit, and enter the amount. Not all in one method? Tap Add payment method to split it — up to 3 ways.",
          "Choosing Credit asks you to pick the customer it's owed by (or add a new one).",
          "Complete sale once everything's paid and matched to a customer where needed.",
        ],
      },
    ],
  },

  "todays-sales": {
    title: "Today's sales",
    sections: [
      {
        heading: "Today's sales",
        summary: "Everything you've sold today, most recent first.",
        points: [
          "Tap a sale to see its full detail — items, payment method, and who it was delivered to, if anyone.",
          "Voided sales are shown dimmed, not hidden — they stay on record.",
          "Made a mistake? Void the sale from its detail view. This reverses the stock and payment, and the original stays visible marked void. You can only void your own sales, on the same day, before the day is closed.",
        ],
      },
    ],
  },

  wastage: {
    title: "Wastage",
    sections: [
      {
        heading: "Wastage",
        summary: "Recording stock that didn't get sold — spoiled, used by staff, or given away.",
        points: [
          "Search for the product or ingredient.",
          "Enter the quantity.",
          "Choose why: Wasted, Consumed, or Given away.",
          "Tap Record. You can record another straight after.",
        ],
      },
    ],
  },

  "staff-stock": {
    title: "Stock",
    sections: [
      {
        heading: "Stock",
        summary: "What you currently have on hand, at your location.",
        points: [
          "Just the product and how much of it is left — a quick look, not a full report.",
        ],
      },
    ],
  },

  handover: {
    title: "Handover",
    sections: [
      {
        heading: "Handover",
        summary: "Handing over today's cash and M-Pesa to the owner, at the end of your shift.",
        points: [
          "Count what's in the drawer. Enter Cash and M-Pesa separately — cash from notes and coins, M-Pesa checked against the paybill messages.",
          "You won't see what the system expects — that's deliberate. The owner checks your count against the record afterwards.",
          "Confirm the total, then tap Hand over.",
          "Already handed over today? You'll see what you recorded. Made a mistake? Record again to correct it, any time later that day.",
        ],
      },
    ],
  },

  // TODO(2026-08-13 canteen redesign): the last point below is stale —
  // the canteen now records every sale individually (docs/proposal.md
  // §4), not just credit ones, and Takings no longer exists. This copy
  // is client-approved verbatim (REQ-01) so it isn't being redrafted
  // unreviewed here; needs a real rewrite once the canteen's sell screen
  // is designed and new copy is approved the same way the rest was.
  "credit-sale": {
    title: "Credit sale",
    sections: [
      {
        heading: "Credit sale",
        summary: "Recording a sale that a customer will pay for later.",
        points: [
          "Tap products to add them, same as a normal sale.",
          "A customer is always required here — pick an existing one or add a new one.",
          "Record credit sale once you've added items and picked a customer.",
          "This is the only way to record an individual sale at the canteen — everything else is covered by your daily Takings total instead.",
        ],
      },
    ],
  },

  receiving: {
    title: "Receiving",
    sections: [
      {
        heading: "Receiving",
        summary: "Recording a delivery arriving from a supplier.",
        points: [
          "Switch between Products and Ingredients — one delivery can include both.",
          "For each item: enter quantity and the price paid per unit.",
          "This only records what arrived and what it cost — it doesn't record paying the supplier. That's handled separately.",
          "Complete once every item has a quantity and a cost.",
        ],
      },
    ],
  },

  "stock-count": {
    title: "Stock count",
    sections: [
      {
        heading: "Stock count",
        summary: "Counting what's physically on the shelf.",
        points: [
          "Search and add each product or ingredient you're counting.",
          "Enter the quantity you counted — just the number, nothing else.",
          "Submit to see the count on record. Comparing it against what the system expected, and correcting any difference, is the owner's step — you won't see that part here.",
        ],
      },
    ],
  },

  "transfer-stock": {
    title: "Transfer stock",
    sections: [
      {
        heading: "Transfer stock",
        summary: "Sending stock to the other location.",
        points: [
          "Search what you have on hand, tap to add it, set the quantity (capped at what's available).",
          "Review, then Transfer — it moves immediately, there's no approval step on the other end.",
          "Sent the wrong thing? Find it in the transfer history and Reverse it — the stock moves back, and the original stays on record.",
        ],
      },
    ],
  },

  "to-kitchen": {
    title: "To kitchen",
    sections: [
      {
        heading: "To kitchen",
        summary: "Issuing ingredients to the kitchen for cooking.",
        points: [
          "Search and add each ingredient, with quantity only — no cost involved, since nothing is being bought or lost here.",
          "Complete once every item has a quantity.",
        ],
      },
    ],
  },

  production: {
    title: "Production",
    sections: [
      {
        heading: "Production",
        summary: "Recording what the kitchen made.",
        points: [
          "Pick the dish, enter the quantity made.",
          "Only dishes with a current recipe can be recorded this way — if one's missing, you'll be told to check with the owner.",
          "One dish per entry.",
        ],
      },
    ],
  },
};

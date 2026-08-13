// docs/architecture.md's "Product home location" note: this needs stock's
// movement ledger, so the implementation lives in stock/routes.ts (see its
// comment) — the URL stays catalogue-namespaced, only the re-export target
// changed.
export { sellableProductsAtLocationRoute as GET } from "@/modules/stock";

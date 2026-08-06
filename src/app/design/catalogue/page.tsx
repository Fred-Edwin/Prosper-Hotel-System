import { Suspense } from "react";
import { CatalogueRound } from "@/components/design/catalogue/round";

export default function CataloguePage() {
  return (
    <Suspense>
      <CatalogueRound />
    </Suspense>
  );
}

import { Suspense } from "react";
import { MoneyOutPage } from "@/components/design/money-out/page";

export default function Page() {
  return (
    <Suspense>
      <MoneyOutPage />
    </Suspense>
  );
}

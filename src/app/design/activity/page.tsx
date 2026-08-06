import { Suspense } from "react";
import { ActivityPage } from "@/components/design/activity/page";

export default function Page() {
  return (
    <Suspense>
      <ActivityPage />
    </Suspense>
  );
}

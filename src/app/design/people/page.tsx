import { Suspense } from "react";
import { PeopleRound } from "@/components/design/people/round";

export default function PeoplePage() {
  return (
    <Suspense>
      <PeopleRound />
    </Suspense>
  );
}

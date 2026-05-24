import { Suspense } from "react";
import { TutorSearchScreen } from "@/components/discovery/tutor-search-screen";

export default function TutorsPage() {
  return (
    <Suspense>
      <TutorSearchScreen />
    </Suspense>
  );
}

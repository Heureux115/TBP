import { Suspense } from "react";
import { TutorReviewsScreen } from "@/components/discovery/tutor-reviews-screen";

export default async function TutorReviewsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense>
      <TutorReviewsScreen id={id} />
    </Suspense>
  );
}

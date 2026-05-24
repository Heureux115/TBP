import { Suspense } from "react";
import { TutorDetailScreen } from "@/components/discovery/tutor-detail-screen";

export default async function TutorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <Suspense>
      <TutorDetailScreen id={id} />
    </Suspense>
  );
}

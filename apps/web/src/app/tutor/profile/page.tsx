import { TutorProfileScreen } from "@/components/tutor/tutor-profile-screen";
import type { TutorVerificationStatus } from "@/lib/tutor-api";

const statusMap: Record<string, TutorVerificationStatus> = {
  draft: "DRAFT",
  pending: "PENDING_REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
};

export default async function TutorProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const params = await searchParams;
  const initialStatus = params.status ? statusMap[params.status] : "PENDING_REVIEW";

  return <TutorProfileScreen initialStatus={initialStatus || "PENDING_REVIEW"} />;
}

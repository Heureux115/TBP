import { AdminTutorDetailScreen } from "@/components/admin/admin-tutor-detail-screen";
import type { TutorVerificationStatus } from "@/lib/tutor-api";

const statusMap: Record<string, TutorVerificationStatus> = {
  pending: "PENDING_REVIEW",
  approved: "APPROVED",
  rejected: "REJECTED",
  draft: "DRAFT",
};

export default async function AdminTutorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const routeParams = await params;
  const queryParams = await searchParams;
  const initialStatus = queryParams.status ? statusMap[queryParams.status] : "PENDING_REVIEW";

  return (
    <AdminTutorDetailScreen
      initialStatus={initialStatus || "PENDING_REVIEW"}
      tutorId={routeParams.id}
    />
  );
}

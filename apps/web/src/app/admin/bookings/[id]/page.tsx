import { AdminBookingDetailScreen } from "@/components/admin/admin-booking-detail-screen";

export default async function AdminBookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const routeParams = await params;

  return <AdminBookingDetailScreen bookingId={routeParams.id} />;
}

import { BookingDetailScreen } from "@/components/bookings/booking-detail-screen";

export default async function BookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetailScreen id={id} />;
}

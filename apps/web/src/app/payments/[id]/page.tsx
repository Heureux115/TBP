import { PaymentReceiptScreen } from "@/components/payments/payment-receipt-screen";

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PaymentReceiptScreen id={id} />;
}

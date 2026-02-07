import PrescriptionOrderPageClient from './PrescriptionOrderPageClient';

export async function generateStaticParams() {
  return [{ id: 'placeholder' }];
}

export default function PrescriptionOrderPage() {
  return <PrescriptionOrderPageClient />;
}

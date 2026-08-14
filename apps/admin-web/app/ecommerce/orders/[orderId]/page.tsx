import AdminOrderDetailPageClient from './AdminOrderDetailPageClient';

/** Non-empty list required for `output: 'export'` (Next treats `[]` as missing). Real IDs load client-side. */
export async function generateStaticParams() {
  return [{ orderId: 'placeholder' }];
}

export default function AdminEcommerceOrderDetailPage() {
  return <AdminOrderDetailPageClient />;
}

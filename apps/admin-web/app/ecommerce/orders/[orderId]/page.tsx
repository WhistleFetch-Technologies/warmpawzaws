import OrderDetailPageClient from './OrderDetailPageClient';

/** Placeholder for static export; real order IDs load client-side. */
export async function generateStaticParams() {
  return [{ orderId: '__' }];
}

export default function AdminEcommerceOrderDetailPage() {
  return <OrderDetailPageClient />;
}

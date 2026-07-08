import WalkerVendorProfilePageClient from './WalkerVendorProfilePageClient';

export async function generateStaticParams() {
  return [{ vendorId: 'placeholder' }];
}

export default function WalkerVendorProfilePage() {
  return <WalkerVendorProfilePageClient />;
}

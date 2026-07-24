import { WarmpawzPayVendorClient } from './WarmpawzPayVendorClient';

export async function generateStaticParams() {
  return [{ vendorId: '_' }];
}

export const dynamicParams = true;

export default function WarmpawzPayVendorPage({ params }: { params: { vendorId?: string } }) {
  return <WarmpawzPayVendorClient vendorId={params?.vendorId} />;
}

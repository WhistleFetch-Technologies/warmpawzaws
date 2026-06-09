import VendorShareDeepLinkClient from './VendorShareDeepLinkClient';

export async function generateStaticParams() {
  return [{ vendorId: 'placeholder' }];
}

export default function VendorShareDeepLinkPage() {
  return <VendorShareDeepLinkClient />;
}

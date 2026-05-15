import PackagePurchaseSessionsClient from './PackagePurchaseSessionsClient';

/** Non-empty list required for `output: 'export'` (Next treats `[]` as missing). Real IDs load client-side. */
export async function generateStaticParams() {
  return [{ packagePurchaseId: '__' }];
}

export default function VendorPackageSessionsPage() {
  return <PackagePurchaseSessionsClient />;
}

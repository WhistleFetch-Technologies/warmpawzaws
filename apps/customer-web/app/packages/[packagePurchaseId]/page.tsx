import PackagePurchaseSessionsClient from './PackagePurchaseSessionsClient';

/** Non-empty list required for `output: 'export'` (Next treats `[]` as missing). */
export async function generateStaticParams() {
  return [{ packagePurchaseId: '__' }];
}

export default function CustomerPackagePurchasePage() {
  return <PackagePurchaseSessionsClient />;
}

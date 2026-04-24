import { PackagePurchaseSessionsPageClient } from './PackagePurchaseSessionsPageClient';

/**
 * `output: 'export'` requires a non-empty `generateStaticParams` (Next only treats it as present when
 * `prerenderRoutes.length > 0`). Real session ids are resolved in the client from the URL on navigation.
 * Optional: add CloudFront/S3 404 → index for deep links to `/packages/:id` if not pre-rendered.
 */
export async function generateStaticParams() {
  return [{ packagePurchaseId: 'index' }];
}

export default function VendorPackageSessionsPage() {
  return <PackagePurchaseSessionsPageClient />;
}

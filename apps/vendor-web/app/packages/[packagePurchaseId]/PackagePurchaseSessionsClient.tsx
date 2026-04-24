'use client';

import { useParams } from 'next/navigation';
import { PackagePurchaseSessionsVendorView } from '@/components/vendor/PackagePurchaseSessionsVendorView';

export default function PackagePurchaseSessionsClient() {
  const params = useParams();
  const packagePurchaseId =
    typeof params?.packagePurchaseId === 'string' ? params.packagePurchaseId : '';

  if (!packagePurchaseId) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-gray-600">
        Missing package id.
      </div>
    );
  }

  return <PackagePurchaseSessionsVendorView packagePurchaseId={packagePurchaseId} />;
}

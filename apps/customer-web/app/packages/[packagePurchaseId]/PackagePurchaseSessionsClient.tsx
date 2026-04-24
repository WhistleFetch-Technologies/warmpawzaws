'use client';

import { useParams } from 'next/navigation';
import { PackagePurchaseSessionsView } from '@/components/customer/packages/PackagePurchaseSessionsView';

export default function PackagePurchaseSessionsClient() {
  const params = useParams();
  const packagePurchaseId =
    typeof params?.packagePurchaseId === 'string' ? params.packagePurchaseId : '';

  if (!packagePurchaseId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-6 text-sm text-gray-600">
        Missing package id.
      </div>
    );
  }

  return <PackagePurchaseSessionsView packagePurchaseId={packagePurchaseId} />;
}

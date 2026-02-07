'use client';

import { useRouter } from 'next/navigation';
import { SpecializedServicesDashboard } from '@/components/vendor/specialized/SpecializedServicesDashboard';

export default function SpecializedServicesPage() {
  const router = useRouter();

  // Get vendor data from localStorage
  const vendorData = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('vendorData') || '{}') : {};
  const vendorId = typeof window !== 'undefined' ? localStorage.getItem('vendorId') || '' : '';

  // Determine role name for specialized services
  const vendorRole = vendorData?.roleName?.toLowerCase() || vendorData?.role_name?.toLowerCase() || 'vendor';

  return (
    <SpecializedServicesDashboard
      vendorId={vendorId}
      vendorRole={vendorRole}
      onBack={() => router.push('/dashboard')}
    />
  );
}

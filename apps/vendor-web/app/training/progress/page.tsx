'use client';

/**
 * Standalone progress: training enrollments + completed session bookings (universal).
 * Walkers see aggregated completed walks when the service name indicates a walk.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProgressTrackingDashboard } from '@/components/vendor/ProgressTrackingDashboard';
import { requireVendorSessionOrRedirect } from '@/lib/session-utils';
import {
  getVendorProgressRoleType,
  isVendorWalkerProgramProgress,
  type VendorProgressRoleType,
} from '@/lib/vendor-utils';

export default function TrainingProgressPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [roleType, setRoleType] = useState<VendorProgressRoleType>('trainer');

  useEffect(() => {
    void (async () => {
      const ok = await requireVendorSessionOrRedirect();
      if (!ok) return;

      const id = localStorage.getItem('vendorId') || '';
      if (!id) {
        router.replace('/onboarding');
        return;
      }

      let vendorData: Record<string, unknown> = {};
      try {
        vendorData = JSON.parse(localStorage.getItem('vendorData') || '{}') as Record<string, unknown>;
      } catch {
        vendorData = {};
      }

      setVendorId(id);
      const progressRole = getVendorProgressRoleType(vendorData);
      if (isVendorWalkerProgramProgress(vendorData)) {
        router.replace('/bookings?walkSessions=1');
        return;
      }
      setRoleType(progressRole);
      setReady(true);
    })();
  }, [router]);

  if (!ready || !vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42] mx-auto" />
          <p className="mt-4 text-gray-600 text-sm">Loading progress…</p>
        </div>
      </div>
    );
  }

  return (
    <ProgressTrackingDashboard
      vendorId={vendorId}
      roleType={roleType}
      onBack={() => router.push('/')}
    />
  );
}

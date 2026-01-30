'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { VendorEarningsSettlementDashboard } from '@/components/vendor/VendorEarningsSettlementDashboard';

/**
 * Settlements Page
 * Now uses the comprehensive VendorEarningsSettlementDashboard with full features:
 * - Tier management with upgrade flow
 * - Analytics cards (Total Revenue, This Month, Avg Settlement, Commission Saved)
 * - Tabbed interface (Overview, Earnings, Settlements, Tier Benefits)
 * - Settlement history with breakup modals
 * - Bank account management
 * - Request payout functionality
 */
export default function SettlementsPage() {
  const router = useRouter();
  const [vendorId, setVendorId] = useState<string | null>(null);

  useEffect(() => {
    const storedVendorId = localStorage.getItem('vendorId');
    if (!storedVendorId) {
      router.push('/onboarding');
      return;
    }
    setVendorId(storedVendorId);
  }, [router]);

  if (!vendorId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-amber-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return <VendorEarningsSettlementDashboard vendorId={vendorId} />;
}

'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { InsurancePayoutPage } from '@/components/admin/warmpawz-insurance/payouts/InsurancePayoutPage';

export default function WarmpawzInsurancePremiumPayoutRoutePage() {
  return (
    <AdminLayout>
      <InsurancePayoutPage />
    </AdminLayout>
  );
}

'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { WarmpawzAppointmentsFeatureGate } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsFeatureGate';
import { WapptPoliciesPage } from '@/components/admin/warmpawz-appointments/policies/WapptPoliciesPage';

export default function WarmpawzAppointmentsPoliciesRoutePage() {
  return (
    <AdminLayout>
      <WarmpawzAppointmentsFeatureGate>
        <WapptPoliciesPage />
      </WarmpawzAppointmentsFeatureGate>
    </AdminLayout>
  );
}

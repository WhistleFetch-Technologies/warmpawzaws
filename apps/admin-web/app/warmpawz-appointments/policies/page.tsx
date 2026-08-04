'use client';

import { WarmpawzAppointmentsFeatureGate } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsFeatureGate';
import { WapptPoliciesPage } from '@/components/admin/warmpawz-appointments/policies/WapptPoliciesPage';

export default function WarmpawzAppointmentsPoliciesRoutePage() {
  return (
    <WarmpawzAppointmentsFeatureGate>
      <WapptPoliciesPage />
    </WarmpawzAppointmentsFeatureGate>
  );
}

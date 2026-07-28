'use client';

import { WarmpawzAppointmentsFeatureGate } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsFeatureGate';
import { WapptDashboardPage } from '@/components/admin/warmpawz-appointments/dashboard/DashboardPage';

export default function WarmpawzAppointmentsDashboardRoutePage() {
  return (
    <WarmpawzAppointmentsFeatureGate>
      <WapptDashboardPage />
    </WarmpawzAppointmentsFeatureGate>
  );
}

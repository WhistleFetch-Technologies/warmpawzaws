'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { WarmpawzAppointmentsFeatureGate } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsFeatureGate';
import { WapptDashboardPage } from '@/components/admin/warmpawz-appointments/dashboard/DashboardPage';

export default function WarmpawzAppointmentsDashboardRoutePage() {
  return (
    <AdminLayout>
      <WarmpawzAppointmentsFeatureGate>
        <WapptDashboardPage />
      </WarmpawzAppointmentsFeatureGate>
    </AdminLayout>
  );
}

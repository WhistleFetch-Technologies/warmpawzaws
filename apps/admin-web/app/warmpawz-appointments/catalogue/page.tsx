'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CatalogueDashboardPage } from '@/components/admin/warmpawz-appointments/catalogue/CatalogueDashboardPage';
import { WarmpawzAppointmentsFeatureGate } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsFeatureGate';

export default function WarmpawzAppointmentsCataloguePage() {
  return (
    <AdminLayout>
      <WarmpawzAppointmentsFeatureGate>
        <CatalogueDashboardPage />
      </WarmpawzAppointmentsFeatureGate>
    </AdminLayout>
  );
}

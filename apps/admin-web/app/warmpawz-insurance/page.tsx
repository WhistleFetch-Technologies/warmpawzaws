'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CompanyCatalogue } from '@/components/admin/warmpawz-insurance/catalogue/CompanyCatalogue';

export default function WarmpawzInsuranceCataloguePage() {
  return (
    <AdminLayout>
      <CompanyCatalogue />
    </AdminLayout>
  );
}

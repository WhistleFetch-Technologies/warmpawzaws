'use client';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { InsuranceCompaniesPage } from '@/components/admin/warmpawz-insurance/companies/InsuranceCompaniesPage';

export default function WarmpawzInsuranceCompaniesRoutePage() {
  return (
    <AdminLayout>
      <InsuranceCompaniesPage />
    </AdminLayout>
  );
}

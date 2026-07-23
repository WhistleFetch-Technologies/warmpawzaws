'use client';
export const dynamic = 'force-dynamic';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CatalogueCreatePage } from '@/components/admin/warmpawz-pay/catalogue/CatalogueCreatePage';

export default function WarmpawzPayCatalogueCreatePage() {
  return (
    <AdminLayout>
      <CatalogueCreatePage />
    </AdminLayout>
  );
}

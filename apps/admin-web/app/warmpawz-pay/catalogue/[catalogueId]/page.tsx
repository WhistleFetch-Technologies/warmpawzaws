'use client';
export const dynamic = 'force-dynamic';

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CatalogueDetailPage } from '@/components/admin/warmpawz-pay/catalogue/CatalogueDetailPage';

export default function WarmpawzPayCatalogueDetailPage({
  params,
}: {
  params: { catalogueId: string };
}) {
  return (
    <AdminLayout>
      <CatalogueDetailPage catalogueId={params.catalogueId} />
    </AdminLayout>
  );
}

import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { CatalogueDetailRouteClient } from './CatalogueDetailRouteClient';

// `output: 'export'` requires at least one segment; build uses `placeholder` only for the HTML shell.
export async function generateStaticParams() {
  return [{ catalogueId: 'placeholder' }];
}

export const dynamicParams = true;

export default function WarmpawzPayCatalogueDetailPage({
  params,
}: {
  params: { catalogueId: string };
}) {
  return (
    <AdminLayout>
      <CatalogueDetailRouteClient catalogueId={params.catalogueId} />
    </AdminLayout>
  );
}

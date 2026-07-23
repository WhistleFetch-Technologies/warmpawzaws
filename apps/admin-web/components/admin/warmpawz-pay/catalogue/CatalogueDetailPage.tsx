'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@warmpawz/ui';
import { Trash2, Upload, Download } from 'lucide-react';
import {
  useCatalogueDetail,
  useDeleteCatalogueEntry,
  usePublishCatalogueEntry,
  useUnpublishCatalogueEntry,
} from '@/hooks/warmpawz-pay/useCatalogue';
import { formatCatalogueDate, shortVendorId } from '@/lib/warmpawz-pay-catalogue-admin';
import { ConfirmDialog } from './ConfirmDialog';
import { EligibilityBadge } from './EligibilityBadge';
import { EligibilityWarnings } from './EligibilityWarnings';
import { LoadingSkeleton } from './LoadingSkeleton';
import { StatusBadge } from './StatusBadge';
import { WarmpawzPayCatalogueShell } from './WarmpawzPayCatalogueShell';

type PendingAction = 'publish' | 'unpublish' | 'delete';

export interface CatalogueDetailPageProps {
  readonly catalogueId: string;
}

export function CatalogueDetailPage({ catalogueId }: CatalogueDetailPageProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const { data, isLoading, error } = useCatalogueDetail(catalogueId);
  const publishMutation = usePublishCatalogueEntry();
  const unpublishMutation = useUnpublishCatalogueEntry();
  const deleteMutation = useDeleteCatalogueEntry();

  const anyMutationPending =
    publishMutation.isPending || unpublishMutation.isPending || deleteMutation.isPending;

  const runPendingAction = async () => {
    if (!pendingAction) {
      return;
    }

    try {
      if (pendingAction === 'publish') {
        await publishMutation.mutateAsync(catalogueId);
      } else if (pendingAction === 'unpublish') {
        await unpublishMutation.mutateAsync(catalogueId);
      } else if (pendingAction === 'delete') {
        await deleteMutation.mutateAsync(catalogueId);
        router.push('/warmpawz-pay/catalogue');
      }
    } finally {
      setPendingAction(null);
    }
  };

  const confirmCopy = (() => {
    switch (pendingAction) {
      case 'publish':
        return {
          title: 'Publish catalogue entry?',
          description: 'This vendor will be marked published in the Warmpawz Pay catalogue.',
        };
      case 'unpublish':
        return {
          title: 'Unpublish catalogue entry?',
          description: 'The entry will return to draft and stop being published.',
        };
      case 'delete':
        return {
          title: 'Delete catalogue entry?',
          description: 'This action cannot be undone.',
          destructive: true,
        };
      default:
        return { title: '', description: '' };
    }
  })();

  if (isLoading) {
    return (
      <WarmpawzPayCatalogueShell title="Catalogue Detail">
        <LoadingSkeleton />
      </WarmpawzPayCatalogueShell>
    );
  }

  if (error || !data) {
    return (
      <WarmpawzPayCatalogueShell
        title="Catalogue Detail"
        actions={
          <Button type="button" variant="outline" onClick={() => router.push('/warmpawz-pay/catalogue')}>
            Back to catalogue
          </Button>
        }
      >
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Catalogue entry not found.'}
        </div>
      </WarmpawzPayCatalogueShell>
    );
  }

  return (
    <WarmpawzPayCatalogueShell
      title={data.businessName}
      subtitle="Catalogue entry details and eligibility snapshot."
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => router.push('/warmpawz-pay/catalogue')}>
            Back to catalogue
          </Button>
          {data.publishStatus === 'draft' ? (
            <Button
              type="button"
              disabled={anyMutationPending}
              onClick={() => setPendingAction('publish')}
            >
              <Upload className="mr-2 h-4 w-4" />
              Publish
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={anyMutationPending}
              onClick={() => setPendingAction('unpublish')}
            >
              <Download className="mr-2 h-4 w-4" />
              Unpublish
            </Button>
          )}
          <Button
            type="button"
            variant="destructive"
            disabled={anyMutationPending}
            onClick={() => setPendingAction('delete')}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Vendor information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Business name</span>
              <span className="font-medium text-gray-900">{data.businessName}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Vendor ID</span>
              <span className="font-mono text-xs">{shortVendorId(data.vendorId)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Owner</span>
              <span>{data.ownerName ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">City</span>
              <span>{data.city ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Phone</span>
              <span>{data.phone ?? '—'}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Vendor status</span>
              <span className="capitalize">{data.eligibility.vendorStatus}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catalogue status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Publish status</span>
              <StatusBadge status={data.publishStatus} />
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-gray-500">Customer visible</span>
              <EligibilityBadge customerVisible={data.eligibility.customerVisible} />
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Published at</span>
              <span>{formatCatalogueDate(data.publishedAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Created</span>
              <span>{formatCatalogueDate(data.createdAt)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-gray-500">Updated</span>
              <span>{formatCatalogueDate(data.updatedAt)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6">
        <EligibilityWarnings eligibility={data.eligibility} warnings={data.warnings} />
      </div>

      <ConfirmDialog
        open={pendingAction !== null}
        title={confirmCopy.title}
        description={confirmCopy.description}
        destructive={'destructive' in confirmCopy && confirmCopy.destructive === true}
        loading={anyMutationPending}
        onOpenChange={(open) => {
          if (!open) {
            setPendingAction(null);
          }
        }}
        onConfirm={() => void runPendingAction()}
      />
    </WarmpawzPayCatalogueShell>
  );
}

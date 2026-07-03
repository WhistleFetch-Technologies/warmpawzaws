'use client';

import { useState } from 'react';
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from '@warmpawz/ui';
import { CheckCircle2, Undo2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { publishPolicy, rollbackPolicy } from '@/lib/discount-policy/discount-policy-api';
import { ComingSoonPanel } from '../shared/ApiPendingBanner';
import type { DiscountPolicyBundle } from '@/lib/discount-policy/types';

export function PublishWorkflowSection({
  draft,
  onPublished,
}: {
  draft: DiscountPolicyBundle;
  onPublished: () => void;
}) {
  const [loading, setLoading] = useState<'publish' | 'rollback' | null>(null);
  const [apiUnavailable, setApiUnavailable] = useState(false);

  const handlePublish = async () => {
    setLoading('publish');
    setApiUnavailable(false);
    try {
      const ok = await publishPolicy(draft);
      if (!ok) {
        setApiUnavailable(true);
        toast.error('Publish API unavailable — save draft locally until Phase 8.');
      } else {
        toast.success('Policy published');
        onPublished();
      }
    } finally {
      setLoading(null);
    }
  };

  const handleRollback = async () => {
    setLoading('rollback');
    try {
      const ok = await rollbackPolicy('latest');
      if (!ok) {
        toast.error('Rollback API unavailable');
      } else {
        toast.success('Rollback requested');
        onPublished();
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Publish workflow</CardTitle>
          <CardDescription>Draft → Validate → Approve → Publish. Engine behaviour changes only after publish.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => void handlePublish()} disabled={loading !== null}>
            <Upload className="mr-1.5 h-4 w-4" aria-hidden />
            {loading === 'publish' ? 'Publishing…' : 'Publish policy'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRollback()}
            disabled={loading !== null}
          >
            <Undo2 className="mr-1.5 h-4 w-4" aria-hidden />
            Rollback
          </Button>
        </CardContent>
      </Card>

      {apiUnavailable ? (
        <ComingSoonPanel
          title="Publish & rollback pending Phase 8"
          description="Policy publish writes to SSM/runtime storage via the backend. No engine behaviour changes until this API succeeds."
          apiPath="POST /admin/discount-policy/publish"
        />
      ) : (
        <Card>
          <CardContent className="flex items-start gap-3 py-6 text-sm text-slate-600">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-emerald-600 shrink-0" aria-hidden />
            <p>
              Use the Validation tab before publishing. Published policies receive a fingerprint and
              publishId recorded in audit history.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

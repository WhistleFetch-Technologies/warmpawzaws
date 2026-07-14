'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@warmpawz/ui';
import { fetchPolicyAudit } from '@/lib/discount-policy/discount-policy-api';
import { ComingSoonPanel } from '../shared/ApiPendingBanner';

export function AuditViewerSection() {
  const [audit, setAudit] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const data = await fetchPolicyAudit();
      if (!data) setUnavailable(true);
      else setAudit(data);
      setLoading(false);
    })();
  }, []);

  if (unavailable && !loading) {
    return (
      <ComingSoonPanel
        title="Audit viewer coming soon"
        description="Priority, stack, and settlement decision audits from resolver runs will appear here via GET /admin/discount-policy/audit. Today audits are available in CloudWatch resolver logs only."
        apiPath="GET /admin/discount-policy/audit"
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Decision audit</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-slate-500">Loading audit data…</p>
        ) : (
          <pre className="overflow-x-auto rounded-lg bg-slate-900 p-4 text-xs text-slate-100">
            {JSON.stringify(audit, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { AdminRouteGuard } from '@/components/admin/layout/AdminRouteGuard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

export default function AdminPackageSessionsPage() {
  const [packagePurchaseId, setPackagePurchaseId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown> | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const q = new URLSearchParams();
      if (packagePurchaseId.trim()) q.set('packagePurchaseId', packagePurchaseId.trim());
      if (customerId.trim()) q.set('customerId', customerId.trim());
      if (vendorId.trim()) q.set('vendorId', vendorId.trim());
      const res = (await apiClient.get(
        `/admin/package-purchases/lookup/sessions?${q.toString()}`
      )) as Record<string, unknown>;
      if ((res as any).error) {
        setError(String((res as any).error));
        return;
      }
      setData(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminRouteGuard>
      <AdminLayout title="Package sessions" description="Read-only session-wise progress for a purchase">
        <Card className="max-w-3xl">
          <CardHeader>
            <CardTitle>Lookup</CardTitle>
            <p className="text-sm text-muted-foreground">
              Enter a package purchase UUID, or both customer and vendor UUIDs to load the latest purchase
              between them.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ppid">Package purchase ID</Label>
              <Input
                id="ppid"
                value={packagePurchaseId}
                onChange={(e) => setPackagePurchaseId(e.target.value)}
                placeholder="UUID"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="cid">Customer ID (optional)</Label>
                <Input
                  id="cid"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="UUID"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vid">Vendor ID (optional)</Label>
                <Input
                  id="vid"
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  placeholder="UUID"
                />
              </div>
            </div>
            <Button type="button" onClick={() => void load()} disabled={loading}>
              {loading ? 'Loading…' : 'Load sessions'}
            </Button>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {data?.summary ? (
              <div className="rounded-md border bg-muted/40 p-4 text-sm">
                <p className="font-medium">Summary</p>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">
                  {JSON.stringify(data.summary, null, 2)}
                </pre>
              </div>
            ) : null}
            {Array.isArray(data?.sessions) ? (
              <div className="rounded-md border p-4 text-sm">
                <p className="font-medium">Sessions ({(data.sessions as unknown[]).length})</p>
                <pre className="mt-2 max-h-96 overflow-auto text-xs">
                  {JSON.stringify(data.sessions, null, 2)}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </AdminLayout>
    </AdminRouteGuard>
  );
}

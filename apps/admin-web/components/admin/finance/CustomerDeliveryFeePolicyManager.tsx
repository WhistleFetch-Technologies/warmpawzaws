/**
 * Admin: customer delivery fee & radius policy (Zone A/B slabs, surges, help copy).
 * Backed by platform_settings key customer:delivery:fee_policy.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@warmpawz/ui/button';

export function CustomerDeliveryFeePolicyManager() {
  const [rawJson, setRawJson] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<{
        success: boolean;
        policy: Record<string, unknown>;
        validationWarning?: string;
        updatedAt?: string;
      }>('/admin/delivery-fee-policy');
      setRawJson(JSON.stringify(res.policy, null, 2));
      setUpdatedAt(res.updatedAt ?? null);
      if (res.validationWarning) {
        setMessage(`Loaded defaults warning: ${res.validationWarning}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const parsed = JSON.parse(rawJson);
      await apiClient.put<{ success: boolean }>('/admin/delivery-fee-policy', { policy: parsed });
      setMessage('Saved successfully.');
      await load();
    } catch (e: unknown) {
      if (e instanceof SyntaxError) {
        setError('Invalid JSON: ' + e.message);
      } else {
        setError(e instanceof Error ? e.message : 'Save failed');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-gray-600">Loading delivery fee policy…</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-md font-semibold text-gray-900">Customer delivery fee policy</h4>
        <p className="text-sm text-gray-600 mt-1">
          Zone A/B by distance and order-value slabs, surge amounts, and policy text shown to customers via{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">GET /customer/delivery-fee-policy</code>.
          {updatedAt && (
            <span className="block mt-1 text-xs text-gray-500">Last updated: {updatedAt}</span>
          )}
        </p>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3">{error}</div>
      )}
      {message && (
        <div className="rounded-lg bg-green-50 text-green-800 text-sm px-4 py-3">{message}</div>
      )}

      <textarea
        className="w-full min-h-[420px] font-mono text-xs border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
        value={rawJson}
        onChange={(e) => setRawJson(e.target.value)}
        spellCheck={false}
      />

      <div className="flex gap-3 flex-wrap">
        <Button type="button" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save policy'}
        </Button>
        <Button type="button" variant="outline" onClick={load} disabled={loading || saving}>
          Reload from server
        </Button>
      </div>

      <p className="text-xs text-gray-500">
        Slabs use half-open ranges: <code>minOrderInr</code> inclusive, <code>maxOrderInr</code> exclusive,
        or null for unlimited upper bound. Distance: Zone A is ≤ <code>zoneABoundaryKm</code> KM; Zone B is up
        to <code>maxServiceRadiusKm</code> KM.
      </p>
    </div>
  );
}

/**
 * Admin: customer delivery fee & radius policy (Zone A/B slabs, surges, help copy).
 * Backed by platform_settings key customer:delivery:fee_policy.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { Button } from '@warmpawz/ui/button';

type OrderValueSlab = {
  minOrderInr: number;
  maxOrderInr: number | null;
  deliveryFeeInr: number;
};

type CustomerDeliveryFeePolicy = {
  version: number;
  maxServiceRadiusKm: number;
  zoneABoundaryKm: number;
  zones: {
    zoneA: OrderValueSlab[];
    zoneB: OrderValueSlab[];
  };
  surges: {
    weekendInr: number;
    festivalMinInr: number;
    festivalMaxInr: number;
    rainMinInr: number;
    rainMaxInr: number;
    priorityNote?: string;
  };
  zoneSurgeConfig?: {
    zoneA: { weekend: boolean; festival: boolean; rain: boolean };
    zoneB: { weekend: boolean; festival: boolean; rain: boolean };
  };
  runtimeSignals?: {
    festivalActive: boolean;
    rainActive: boolean;
  };
  content: {
    coverageSummary: string;
    zoneADescription?: string;
    zoneBDescription?: string;
    surgeIntro?: string;
    rulesFreeDelivery: string[];
    rulesBeyond5Km: string[];
    rulesBeyond8Km: string[];
    importantNotes: string[];
  };
};

const EMPTY_POLICY: CustomerDeliveryFeePolicy = {
  version: 1,
  maxServiceRadiusKm: 10,
  zoneABoundaryKm: 5,
  zones: {
    zoneA: [],
    zoneB: [],
  },
  surges: {
    weekendInr: 0,
    festivalMinInr: 0,
    festivalMaxInr: 0,
    rainMinInr: 0,
    rainMaxInr: 0,
    priorityNote: '',
  },
  zoneSurgeConfig: {
    zoneA: { weekend: true, festival: true, rain: true },
    zoneB: { weekend: true, festival: true, rain: true },
  },
  runtimeSignals: {
    festivalActive: false,
    rainActive: false,
  },
  content: {
    coverageSummary: '',
    zoneADescription: '',
    zoneBDescription: '',
    surgeIntro: '',
    rulesFreeDelivery: [],
    rulesBeyond5Km: [],
    rulesBeyond8Km: [],
    importantNotes: [],
  },
};

export function CustomerDeliveryFeePolicyManager() {
  const [policy, setPolicy] = useState<CustomerDeliveryFeePolicy>(EMPTY_POLICY);
  const [rawJson, setRawJson] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [quoteInput, setQuoteInput] = useState({
    orderSubtotalInr: 1200,
    distanceKm: 4,
    weekend: false,
    festival: false,
    rain: false,
  });
  const [quoteResult, setQuoteResult] = useState<Record<string, unknown> | null>(null);
  const [quoting, setQuoting] = useState(false);

  const syncRaw = useCallback((p: CustomerDeliveryFeePolicy) => {
    setRawJson(JSON.stringify(p, null, 2));
  }, []);

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
      const next = res.policy as CustomerDeliveryFeePolicy;
      setPolicy(next);
      syncRaw(next);
      setUpdatedAt(res.updatedAt ?? null);
      if (res.validationWarning) {
        setMessage(`Loaded defaults warning: ${res.validationWarning}`);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load policy');
    } finally {
      setLoading(false);
    }
  }, [syncRaw]);

  useEffect(() => {
    load();
  }, [load]);

  const updatePolicy = (updater: (prev: CustomerDeliveryFeePolicy) => CustomerDeliveryFeePolicy) => {
    setPolicy((prev) => {
      const next = updater(prev);
      syncRaw(next);
      return next;
    });
  };

  const updateSlab = (zone: 'zoneA' | 'zoneB', index: number, key: keyof OrderValueSlab, value: string) => {
    updatePolicy((prev) => {
      const slabs = [...prev.zones[zone]];
      const slab = { ...slabs[index] };
      if (key === 'maxOrderInr') {
        slab.maxOrderInr = value === '' ? null : Math.max(0, Number(value));
      } else {
        slab[key] = Math.max(0, Number(value)) as never;
      }
      slabs[index] = slab;
      return {
        ...prev,
        zones: {
          ...prev.zones,
          [zone]: slabs,
        },
      };
    });
  };

  const addSlab = (zone: 'zoneA' | 'zoneB') => {
    updatePolicy((prev) => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zone]: [...prev.zones[zone], { minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 0 }],
      },
    }));
  };

  const removeSlab = (zone: 'zoneA' | 'zoneB', index: number) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: {
        ...prev.zones,
        [zone]: prev.zones[zone].filter((_, i) => i !== index),
      },
    }));
  };

  const updateContentListItem = (
    key: 'rulesFreeDelivery' | 'rulesBeyond5Km' | 'rulesBeyond8Km' | 'importantNotes',
    index: number,
    value: string
  ) => {
    updatePolicy((prev) => {
      const nextList = [...prev.content[key]];
      nextList[index] = value;
      return {
        ...prev,
        content: {
          ...prev.content,
          [key]: nextList,
        },
      };
    });
  };

  const updateZoneSurgeFlag = (
    zone: 'zoneA' | 'zoneB',
    key: 'weekend' | 'festival' | 'rain',
    checked: boolean
  ) => {
    updatePolicy((prev) => ({
      ...prev,
      zoneSurgeConfig: {
        zoneA: prev.zoneSurgeConfig?.zoneA || EMPTY_POLICY.zoneSurgeConfig!.zoneA,
        zoneB: prev.zoneSurgeConfig?.zoneB || EMPTY_POLICY.zoneSurgeConfig!.zoneB,
        [zone]: {
          ...(prev.zoneSurgeConfig?.[zone] || EMPTY_POLICY.zoneSurgeConfig![zone]),
          [key]: checked,
        },
      },
    }));
  };

  const updateRuntimeSignal = (key: 'festivalActive' | 'rainActive', checked: boolean) => {
    updatePolicy((prev) => ({
      ...prev,
      runtimeSignals: {
        festivalActive: prev.runtimeSignals?.festivalActive ?? false,
        rainActive: prev.runtimeSignals?.rainActive ?? false,
        [key]: checked,
      },
    }));
  };

  const addContentListItem = (
    key: 'rulesFreeDelivery' | 'rulesBeyond5Km' | 'rulesBeyond8Km' | 'importantNotes'
  ) => {
    updatePolicy((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        [key]: [...prev.content[key], ''],
      },
    }));
  };

  const removeContentListItem = (
    key: 'rulesFreeDelivery' | 'rulesBeyond5Km' | 'rulesBeyond8Km' | 'importantNotes',
    index: number
  ) => {
    updatePolicy((prev) => ({
      ...prev,
      content: {
        ...prev.content,
        [key]: prev.content[key].filter((_, i) => i !== index),
      },
    }));
  };

  const handlePreviewQuote = async () => {
    setQuoting(true);
    setError(null);
    try {
      const res = await apiClient.post<{ success: boolean; calculation: Record<string, unknown> }>(
        '/customer/delivery-fee/calculate',
        quoteInput
      );
      setQuoteResult(res.calculation || null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to preview quote');
    } finally {
      setQuoting(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const parsed = JSON.parse(rawJson);
      await apiClient.put<{ success: boolean; policy: CustomerDeliveryFeePolicy }>('/admin/delivery-fee-policy', { policy: parsed });
      setMessage('Saved successfully.');
      setPolicy(parsed as CustomerDeliveryFeePolicy);
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

  const renderSlabEditor = (zone: 'zoneA' | 'zoneB', title: string) => (
    <div className="border border-gray-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-gray-900">{title}</h5>
        <Button type="button" variant="outline" onClick={() => addSlab(zone)}>
          Add slab
        </Button>
      </div>
      {policy.zones[zone].length === 0 && (
        <p className="text-xs text-gray-500">No slabs added yet.</p>
      )}
      {policy.zones[zone].map((slab, index) => (
        <div key={`${zone}-${index}`} className="grid grid-cols-12 gap-2 items-end border border-gray-100 rounded-md p-2">
          <label className="col-span-3 text-xs text-gray-600">
            Min order
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={0}
              value={slab.minOrderInr}
              onChange={(e) => updateSlab(zone, index, 'minOrderInr', e.target.value)}
            />
          </label>
          <label className="col-span-3 text-xs text-gray-600">
            Max order
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={0}
              value={slab.maxOrderInr ?? ''}
              onChange={(e) => updateSlab(zone, index, 'maxOrderInr', e.target.value)}
              placeholder="No upper limit"
            />
          </label>
          <label className="col-span-4 text-xs text-gray-600">
            Delivery fee
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={0}
              value={slab.deliveryFeeInr}
              onChange={(e) => updateSlab(zone, index, 'deliveryFeeInr', e.target.value)}
            />
          </label>
          <div className="col-span-2 flex justify-end">
            <Button type="button" variant="outline" onClick={() => removeSlab(zone, index)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderListEditor = (
    key: 'rulesFreeDelivery' | 'rulesBeyond5Km' | 'rulesBeyond8Km' | 'importantNotes',
    title: string
  ) => (
    <div className="border border-gray-200 rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h5 className="font-semibold text-gray-900">{title}</h5>
        <Button type="button" variant="outline" onClick={() => addContentListItem(key)}>
          Add line
        </Button>
      </div>
      {policy.content[key].map((line, index) => (
        <div key={`${key}-${index}`} className="flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1 text-sm"
            value={line}
            onChange={(e) => updateContentListItem(key, index, e.target.value)}
          />
          <Button type="button" variant="outline" onClick={() => removeContentListItem(key, index)}>
            Remove
          </Button>
        </div>
      ))}
      {policy.content[key].length === 0 && <p className="text-xs text-gray-500">No lines added.</p>}
    </div>
  );

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h5 className="font-semibold text-gray-900">Coverage</h5>
          <label className="block text-xs text-gray-600">
            Policy version
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={1}
              value={policy.version}
              onChange={(e) =>
                updatePolicy((prev) => ({ ...prev, version: Math.max(1, Number(e.target.value || 1)) }))
              }
            />
          </label>
          <label className="block text-xs text-gray-600">
            Max service radius (KM)
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={1}
              value={policy.maxServiceRadiusKm}
              onChange={(e) =>
                updatePolicy((prev) => ({
                  ...prev,
                  maxServiceRadiusKm: Math.max(1, Number(e.target.value || 1)),
                }))
              }
            />
          </label>
          <label className="block text-xs text-gray-600">
            Zone A boundary (KM)
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={1}
              value={policy.zoneABoundaryKm}
              onChange={(e) =>
                updatePolicy((prev) => ({
                  ...prev,
                  zoneABoundaryKm: Math.max(1, Number(e.target.value || 1)),
                }))
              }
            />
          </label>
        </div>

        <div className="border border-gray-200 rounded-lg p-4 space-y-3">
          <h5 className="font-semibold text-gray-900">Surges (INR)</h5>
          {(
            [
              ['weekendInr', 'Weekend'],
              ['festivalMinInr', 'Festival min'],
              ['festivalMaxInr', 'Festival max'],
              ['rainMinInr', 'Rain min'],
              ['rainMaxInr', 'Rain max'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-xs text-gray-600">
              {label}
              <input
                className="mt-1 w-full border rounded px-2 py-1 text-sm"
                type="number"
                min={0}
                value={policy.surges[key]}
                onChange={(e) =>
                  updatePolicy((prev) => ({
                    ...prev,
                    surges: {
                      ...prev.surges,
                      [key]: Math.max(0, Number(e.target.value || 0)),
                    },
                  }))
                }
              />
            </label>
          ))}
          <label className="block text-xs text-gray-600">
            Priority note
            <textarea
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              rows={2}
              value={policy.surges.priorityNote || ''}
              onChange={(e) =>
                updatePolicy((prev) => ({
                  ...prev,
                  surges: { ...prev.surges, priorityNote: e.target.value },
                }))
              }
            />
          </label>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <div>
          <h5 className="font-semibold text-gray-900">Delivery fee slabs (not duplicate)</h5>
          <p className="text-xs text-gray-600 mt-1">
            Two columns are required: <strong>Zone A</strong> applies when distance ≤ Zone A boundary KM;
            <strong> Zone B</strong> applies from just beyond that up to max service radius. Each zone has its own
            order-value slabs and fees.
          </p>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {renderSlabEditor(
            'zoneA',
            `Zone A slabs (≤ ${policy.zoneABoundaryKm} KM)`
          )}
          {renderSlabEditor(
            'zoneB',
            `Zone B slabs (beyond ${policy.zoneABoundaryKm} KM, up to ${policy.maxServiceRadiusKm} KM)`
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <div>
          <h5 className="font-semibold text-gray-900">Surge pricing</h5>
          <p className="text-xs text-gray-600 mt-1">
            <strong>Weekend</strong> is automatic (Sat/Sun IST) when enabled per zone below.
            <strong> Festival / Rain active</strong> turns on those surges platform-wide (checkout uses them when the API does not override).
            Zone toggles for festival/rain are optional extras; global active alone is enough for those two.
          </p>
        </div>
        <div className="flex flex-wrap gap-6 pb-2 border-b border-gray-100">
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.runtimeSignals?.festivalActive ?? false}
              onChange={(e) => updateRuntimeSignal('festivalActive', e.target.checked)}
            />
            Festival active (global)
          </label>
          <label className="text-xs text-gray-700 flex items-center gap-2">
            <input
              type="checkbox"
              checked={policy.runtimeSignals?.rainActive ?? false}
              onChange={(e) => updateRuntimeSignal('rainActive', e.target.checked)}
            />
            Rain active (global)
          </label>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(['zoneA', 'zoneB'] as const).map((zone) => (
            <div key={zone} className="rounded-md border border-gray-100 p-3 space-y-2 bg-gray-50/50">
              <h6 className="text-sm font-medium text-gray-900">
                {zone === 'zoneA' ? 'Zone A — apply weekend surge?' : 'Zone B — apply weekend surge?'}
              </h6>
              <p className="text-xs text-gray-500">
                Festival/rain still follow global switches above. Use these to disable weekend surcharge in this zone only.
              </p>
              <div className="flex flex-wrap gap-4">
                {(['weekend', 'festival', 'rain'] as const).map((flag) => (
                  <label key={`${zone}-${flag}`} className="text-xs text-gray-700 flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={
                        policy.zoneSurgeConfig?.[zone]?.[flag] ??
                        EMPTY_POLICY.zoneSurgeConfig![zone][flag]
                      }
                      onChange={(e) => updateZoneSurgeFlag(zone, flag, e.target.checked)}
                    />
                    {flag === 'weekend' ? 'Weekend' : flag === 'festival' ? 'Festival (extra)' : 'Rain (extra)'}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h5 className="font-semibold text-gray-900">Customer copy</h5>
        <label className="block text-xs text-gray-600">
          Coverage summary
          <textarea
            className="mt-1 w-full border rounded px-2 py-1 text-sm"
            rows={2}
            value={policy.content.coverageSummary}
            onChange={(e) =>
              updatePolicy((prev) => ({
                ...prev,
                content: { ...prev.content, coverageSummary: e.target.value },
              }))
            }
          />
        </label>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <label className="block text-xs text-gray-600">
            Zone A description
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              value={policy.content.zoneADescription || ''}
              onChange={(e) =>
                updatePolicy((prev) => ({
                  ...prev,
                  content: { ...prev.content, zoneADescription: e.target.value },
                }))
              }
            />
          </label>
          <label className="block text-xs text-gray-600">
            Zone B description
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              value={policy.content.zoneBDescription || ''}
              onChange={(e) =>
                updatePolicy((prev) => ({
                  ...prev,
                  content: { ...prev.content, zoneBDescription: e.target.value },
                }))
              }
            />
          </label>
        </div>
        <label className="block text-xs text-gray-600">
          Surge intro
          <input
            className="mt-1 w-full border rounded px-2 py-1 text-sm"
            value={policy.content.surgeIntro || ''}
            onChange={(e) =>
              updatePolicy((prev) => ({
                ...prev,
                content: { ...prev.content, surgeIntro: e.target.value },
              }))
            }
          />
        </label>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {renderListEditor('rulesFreeDelivery', 'Free delivery rules')}
        {renderListEditor('rulesBeyond5Km', 'Rules beyond 5 KM')}
        {renderListEditor('rulesBeyond8Km', 'Rules beyond 8 KM')}
        {renderListEditor('importantNotes', 'Important notes')}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h5 className="font-semibold text-gray-900">Preview calculator</h5>
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-2">
          <input
            className="border rounded px-2 py-1 text-sm"
            type="number"
            min={0}
            value={quoteInput.orderSubtotalInr}
            onChange={(e) => setQuoteInput((prev) => ({ ...prev, orderSubtotalInr: Number(e.target.value || 0) }))}
            placeholder="Subtotal"
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            type="number"
            min={0}
            value={quoteInput.distanceKm}
            onChange={(e) => setQuoteInput((prev) => ({ ...prev, distanceKm: Number(e.target.value || 0) }))}
            placeholder="Distance KM"
          />
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={quoteInput.weekend}
              onChange={(e) => setQuoteInput((prev) => ({ ...prev, weekend: e.target.checked }))}
            />
            Weekend
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={quoteInput.festival}
              onChange={(e) => setQuoteInput((prev) => ({ ...prev, festival: e.target.checked }))}
            />
            Festival
          </label>
          <label className="text-xs text-gray-600 flex items-center gap-2">
            <input
              type="checkbox"
              checked={quoteInput.rain}
              onChange={(e) => setQuoteInput((prev) => ({ ...prev, rain: e.target.checked }))}
            />
            Rain
          </label>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={handlePreviewQuote} disabled={quoting}>
            {quoting ? 'Calculating…' : 'Calculate sample fee'}
          </Button>
          {quoteResult && (
            <span className="text-xs text-gray-600">
              Zone: {String(quoteResult.zone || 'n/a')} • Total: ₹{String(quoteResult.totalDeliveryFeeInr || 0)}
            </span>
          )}
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h5 className="font-semibold text-gray-900">Advanced JSON</h5>
          <Button type="button" variant="outline" onClick={() => setShowAdvancedJson((v) => !v)}>
            {showAdvancedJson ? 'Hide JSON' : 'Show JSON'}
          </Button>
        </div>
        {showAdvancedJson && (
          <textarea
            className="w-full min-h-[320px] font-mono text-xs border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            value={rawJson}
            onChange={(e) => setRawJson(e.target.value)}
            spellCheck={false}
          />
        )}
      </div>

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

/**
 * Admin: customer delivery fee policy — dynamic distance zones, slabs, surges, help copy.
 * Backed by platform_settings key customer:delivery:fee_policy (v2).
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

type DeliveryFeeZone = {
  id: string;
  name: string;
  sortOrder: number;
  minDistanceKm: number;
  maxDistanceKm: number;
  slabs: OrderValueSlab[];
  surgeConfig: { weekend: boolean; festival: boolean; rain: boolean };
  description?: string;
  operationalRules?: string[];
};

type CustomerDeliveryFeePolicy = {
  version: number;
  maxServiceRadiusKm: number;
  zones: DeliveryFeeZone[];
  surges: {
    weekendInr: number;
    festivalMinInr: number;
    festivalMaxInr: number;
    rainMinInr: number;
    rainMaxInr: number;
    priorityNote?: string;
  };
  runtimeSignals?: {
    festivalActive: boolean;
    rainActive: boolean;
  };
  content: {
    coverageSummary: string;
    surgeIntro?: string;
    rulesFreeDelivery: string[];
    importantNotes: string[];
  };
};

function newZoneId(): string {
  return `zone_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function sortZones(zones: DeliveryFeeZone[]): DeliveryFeeZone[] {
  return [...zones].sort((a, b) => a.sortOrder - b.sortOrder);
}

function reindexZones(zones: DeliveryFeeZone[], maxServiceRadiusKm: number): DeliveryFeeZone[] {
  const sorted = sortZones(zones);
  return sorted.map((z, i) => ({
    ...z,
    sortOrder: i,
    minDistanceKm: i === 0 ? 0 : sorted[i - 1].maxDistanceKm,
    maxDistanceKm: i === sorted.length - 1 ? maxServiceRadiusKm : z.maxDistanceKm,
  }));
}

const EMPTY_POLICY: CustomerDeliveryFeePolicy = {
  version: 2,
  maxServiceRadiusKm: 10,
  zones: [
    {
      id: 'zone_near',
      name: 'Zone A',
      sortOrder: 0,
      minDistanceKm: 0,
      maxDistanceKm: 5,
      slabs: [
        { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 99 },
        { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 49 },
        { minOrderInr: 1500, maxOrderInr: null, deliveryFeeInr: 0 },
      ],
      surgeConfig: { weekend: true, festival: true, rain: true },
      description: 'Up to 5 KM from fulfillment.',
      operationalRules: [],
    },
    {
      id: 'zone_mid',
      name: 'Zone B',
      sortOrder: 1,
      minDistanceKm: 5,
      maxDistanceKm: 10,
      slabs: [
        { minOrderInr: 0, maxOrderInr: 1000, deliveryFeeInr: 149 },
        { minOrderInr: 1000, maxOrderInr: 1500, deliveryFeeInr: 99 },
        { minOrderInr: 1500, maxOrderInr: 2000, deliveryFeeInr: 49 },
        { minOrderInr: 2000, maxOrderInr: null, deliveryFeeInr: 0 },
      ],
      surgeConfig: { weekend: true, festival: true, rain: true },
      description: 'Beyond 5 KM up to 10 KM.',
      operationalRules: [],
    },
  ],
  surges: {
    weekendInr: 0,
    festivalMinInr: 0,
    festivalMaxInr: 0,
    rainMinInr: 0,
    rainMaxInr: 0,
    priorityNote: '',
  },
  runtimeSignals: {
    festivalActive: false,
    rainActive: false,
  },
  content: {
    coverageSummary: '',
    surgeIntro: '',
    rulesFreeDelivery: [],
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

  const updateSlab = (zoneId: string, index: number, key: keyof OrderValueSlab, value: string) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => {
        if (z.id !== zoneId) return z;
        const slabs = [...z.slabs];
        const slab = { ...slabs[index] };
        if (key === 'maxOrderInr') {
          slab.maxOrderInr = value === '' ? null : Math.max(0, Number(value));
        } else {
          slab[key] = Math.max(0, Number(value)) as never;
        }
        slabs[index] = slab;
        return { ...z, slabs };
      }),
    }));
  };

  const addSlab = (zoneId: string) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === zoneId
          ? { ...z, slabs: [...z.slabs, { minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 0 }] }
          : z
      ),
    }));
  };

  const removeSlab = (zoneId: string, index: number) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === zoneId ? { ...z, slabs: z.slabs.filter((_, i) => i !== index) } : z
      ),
    }));
  };

  const addZone = () => {
    updatePolicy((prev) => {
      const sorted = sortZones(prev.zones);
      const last = sorted[sorted.length - 1];
      const splitAt = last
        ? Math.min(last.maxDistanceKm, prev.maxServiceRadiusKm)
        : prev.maxServiceRadiusKm;
      const mid =
        last && last.minDistanceKm < splitAt
          ? Math.round(((last.minDistanceKm + splitAt) / 2) * 10) / 10
          : splitAt / 2 || 1;

      const newZone: DeliveryFeeZone = {
        id: newZoneId(),
        name: `Zone ${String.fromCharCode(65 + sorted.length)}`,
        sortOrder: sorted.length,
        minDistanceKm: last ? mid : 0,
        maxDistanceKm: last ? splitAt : prev.maxServiceRadiusKm,
        slabs: [{ minOrderInr: 0, maxOrderInr: null, deliveryFeeInr: 0 }],
        surgeConfig: { weekend: true, festival: true, rain: true },
        description: '',
        operationalRules: [],
      };

      let zones = [...sorted];
      if (last) {
        zones = zones.map((z, i) =>
          i === zones.length - 1 ? { ...z, maxDistanceKm: mid } : z
        );
        zones.push(newZone);
      } else {
        zones = [newZone];
      }

      return {
        ...prev,
        zones: reindexZones(zones, prev.maxServiceRadiusKm),
      };
    });
  };

  const removeZone = (zoneId: string) => {
    updatePolicy((prev) => {
      if (prev.zones.length <= 1) return prev;
      const zones = reindexZones(
        prev.zones.filter((z) => z.id !== zoneId),
        prev.maxServiceRadiusKm
      );
      return { ...prev, zones };
    });
  };

  const moveZone = (zoneId: string, direction: 'up' | 'down') => {
    updatePolicy((prev) => {
      const sorted = sortZones(prev.zones);
      const idx = sorted.findIndex((z) => z.id === zoneId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev;
      const next = [...sorted];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return {
        ...prev,
        zones: reindexZones(next, prev.maxServiceRadiusKm),
      };
    });
  };

  const updateZoneField = (
    zoneId: string,
    field: 'name' | 'description' | 'maxDistanceKm',
    value: string | number
  ) => {
    updatePolicy((prev) => {
      const sorted = sortZones(prev.zones);
      const idx = sorted.findIndex((z) => z.id === zoneId);
      if (idx < 0) return prev;

      let zones = sorted.map((z) => {
        if (z.id !== zoneId) return z;
        if (field === 'name') return { ...z, name: String(value) };
        if (field === 'description') return { ...z, description: String(value) };
        return { ...z, maxDistanceKm: Math.max(z.minDistanceKm + 0.1, Number(value)) };
      });

      if (field === 'maxDistanceKm' && idx < zones.length - 1) {
        const newMax = zones[idx].maxDistanceKm;
        zones = zones.map((z, i) => (i === idx + 1 ? { ...z, minDistanceKm: newMax } : z));
      }

      if (idx === zones.length - 1 && field === 'maxDistanceKm') {
        return {
          ...prev,
          maxServiceRadiusKm: zones[idx].maxDistanceKm,
          zones: reindexZones(zones, zones[idx].maxDistanceKm),
        };
      }

      return { ...prev, zones: reindexZones(zones, prev.maxServiceRadiusKm) };
    });
  };

  const updateZoneSurgeFlag = (
    zoneId: string,
    key: 'weekend' | 'festival' | 'rain',
    checked: boolean
  ) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === zoneId
          ? { ...z, surgeConfig: { ...z.surgeConfig, [key]: checked } }
          : z
      ),
    }));
  };

  const updateOperationalRule = (zoneId: string, index: number, value: string) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) => {
        if (z.id !== zoneId) return z;
        const rules = [...(z.operationalRules || [])];
        rules[index] = value;
        return { ...z, operationalRules: rules };
      }),
    }));
  };

  const addOperationalRule = (zoneId: string) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === zoneId
          ? { ...z, operationalRules: [...(z.operationalRules || []), ''] }
          : z
      ),
    }));
  };

  const removeOperationalRule = (zoneId: string, index: number) => {
    updatePolicy((prev) => ({
      ...prev,
      zones: prev.zones.map((z) =>
        z.id === zoneId
          ? { ...z, operationalRules: (z.operationalRules || []).filter((_, i) => i !== index) }
          : z
      ),
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

  const updateContentListItem = (
    key: 'rulesFreeDelivery' | 'importantNotes',
    index: number,
    value: string
  ) => {
    updatePolicy((prev) => {
      const nextList = [...prev.content[key]];
      nextList[index] = value;
      return {
        ...prev,
        content: { ...prev.content, [key]: nextList },
      };
    });
  };

  const addContentListItem = (key: 'rulesFreeDelivery' | 'importantNotes') => {
    updatePolicy((prev) => ({
      ...prev,
      content: { ...prev.content, [key]: [...prev.content[key], ''] },
    }));
  };

  const removeContentListItem = (key: 'rulesFreeDelivery' | 'importantNotes', index: number) => {
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
      const parsed = JSON.parse(rawJson) as CustomerDeliveryFeePolicy;
      parsed.version = Math.max(2, parsed.version || 2);
      parsed.zones = reindexZones(parsed.zones, parsed.maxServiceRadiusKm);
      await apiClient.put<{ success: boolean; policy: CustomerDeliveryFeePolicy }>(
        '/admin/delivery-fee-policy',
        { policy: parsed }
      );
      setMessage('Saved successfully.');
      setPolicy(parsed);
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

  const sortedZones = sortZones(policy.zones);

  const renderSlabEditor = (zone: DeliveryFeeZone) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h6 className="text-sm font-medium text-gray-900">Order-value slabs</h6>
        <Button type="button" variant="outline" onClick={() => addSlab(zone.id)}>
          Add slab
        </Button>
      </div>
      {zone.slabs.length === 0 && <p className="text-xs text-gray-500">No slabs added yet.</p>}
      {zone.slabs.map((slab, index) => (
        <div
          key={`${zone.id}-slab-${index}`}
          className="grid grid-cols-12 gap-2 items-end border border-gray-100 rounded-md p-2"
        >
          <label className="col-span-3 text-xs text-gray-600">
            Min order
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={0}
              value={slab.minOrderInr}
              onChange={(e) => updateSlab(zone.id, index, 'minOrderInr', e.target.value)}
            />
          </label>
          <label className="col-span-3 text-xs text-gray-600">
            Max order
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={0}
              value={slab.maxOrderInr ?? ''}
              onChange={(e) => updateSlab(zone.id, index, 'maxOrderInr', e.target.value)}
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
              onChange={(e) => updateSlab(zone.id, index, 'deliveryFeeInr', e.target.value)}
            />
          </label>
          <div className="col-span-2 flex justify-end">
            <Button type="button" variant="outline" onClick={() => removeSlab(zone.id, index)}>
              Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );

  const renderListEditor = (
    key: 'rulesFreeDelivery' | 'importantNotes',
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
          Dynamic distance zones with order-value slabs, surge amounts, and policy text shown to customers via{' '}
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
              min={2}
              value={policy.version}
              onChange={(e) =>
                updatePolicy((prev) => ({
                  ...prev,
                  version: Math.max(2, Number(e.target.value || 2)),
                }))
              }
            />
          </label>
          <label className="block text-xs text-gray-600">
            Max service radius (KM)
            <input
              className="mt-1 w-full border rounded px-2 py-1 text-sm"
              type="number"
              min={1}
              step={0.1}
              value={policy.maxServiceRadiusKm}
              onChange={(e) => {
                const max = Math.max(1, Number(e.target.value || 1));
                updatePolicy((prev) => ({
                  ...prev,
                  maxServiceRadiusKm: max,
                  zones: reindexZones(prev.zones, max),
                }));
              }}
            />
          </label>
          <p className="text-xs text-gray-500">
            Zones must be contiguous from 0 KM to this max. The last zone&apos;s upper bound is set automatically.
          </p>
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

      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h5 className="font-semibold text-gray-900">Delivery zones</h5>
            <p className="text-xs text-gray-600 mt-1">
              Add as many zones as needed. Each zone has its own distance band, slabs, surge toggles, and operational rules.
            </p>
          </div>
          <Button type="button" variant="outline" onClick={addZone}>
            Add zone
          </Button>
        </div>

        {sortedZones.map((zone, zoneIndex) => {
          const isLast = zoneIndex === sortedZones.length - 1;
          const isFirst = zoneIndex === 0;
          return (
            <div key={zone.id} className="border border-orange-100 rounded-lg p-4 space-y-4 bg-orange-50/20">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <h6 className="font-semibold text-gray-900">
                    {zone.name} ({zone.minDistanceKm} – {zone.maxDistanceKm} KM)
                  </h6>
                  <p className="text-xs text-gray-500 font-mono">{zone.id}</p>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isFirst}
                    onClick={() => moveZone(zone.id, 'up')}
                  >
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isLast}
                    onClick={() => moveZone(zone.id, 'down')}
                  >
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={sortedZones.length <= 1}
                    onClick={() => removeZone(zone.id)}
                  >
                    Delete zone
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                <label className="block text-xs text-gray-600">
                  Zone name
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    value={zone.name}
                    onChange={(e) => updateZoneField(zone.id, 'name', e.target.value)}
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  From (KM)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm bg-gray-50"
                    type="number"
                    value={zone.minDistanceKm}
                    readOnly
                  />
                </label>
                <label className="block text-xs text-gray-600">
                  To (KM)
                  <input
                    className="mt-1 w-full border rounded px-2 py-1 text-sm"
                    type="number"
                    min={zone.minDistanceKm + 0.1}
                    step={0.1}
                    value={zone.maxDistanceKm}
                    onChange={(e) => updateZoneField(zone.id, 'maxDistanceKm', e.target.value)}
                  />
                </label>
              </div>

              <label className="block text-xs text-gray-600">
                Customer description
                <input
                  className="mt-1 w-full border rounded px-2 py-1 text-sm"
                  value={zone.description || ''}
                  onChange={(e) => updateZoneField(zone.id, 'description', e.target.value)}
                  placeholder={`e.g. ${zone.minDistanceKm}–${zone.maxDistanceKm} KM from fulfillment`}
                />
              </label>

              <div className="rounded-md border border-gray-100 p-3 space-y-2 bg-white">
                <h6 className="text-sm font-medium text-gray-900">Surge toggles for this zone</h6>
                <div className="flex flex-wrap gap-4">
                  {(['weekend', 'festival', 'rain'] as const).map((flag) => (
                    <label key={`${zone.id}-${flag}`} className="text-xs text-gray-700 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={zone.surgeConfig[flag]}
                        onChange={(e) => updateZoneSurgeFlag(zone.id, flag, e.target.checked)}
                      />
                      {flag === 'weekend' ? 'Weekend' : flag === 'festival' ? 'Festival' : 'Rain'}
                    </label>
                  ))}
                </div>
              </div>

              {renderSlabEditor(zone)}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h6 className="text-sm font-medium text-gray-900">Operational rules (customer copy)</h6>
                  <Button type="button" variant="outline" onClick={() => addOperationalRule(zone.id)}>
                    Add rule
                  </Button>
                </div>
                {(zone.operationalRules || []).map((line, index) => (
                  <div key={`${zone.id}-rule-${index}`} className="flex gap-2">
                    <input
                      className="flex-1 border rounded px-2 py-1 text-sm"
                      value={line}
                      onChange={(e) => updateOperationalRule(zone.id, index, e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => removeOperationalRule(zone.id, index)}
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-4">
        <div>
          <h5 className="font-semibold text-gray-900">Surge pricing (global switches)</h5>
          <p className="text-xs text-gray-600 mt-1">
            Weekend is automatic (Sat/Sun IST) when enabled per zone. Festival / Rain active turns on those surges platform-wide.
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
      </div>

      <div className="border border-gray-200 rounded-lg p-4 space-y-3">
        <h5 className="font-semibold text-gray-900">Customer copy (global)</h5>
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
            onChange={(e) =>
              setQuoteInput((prev) => ({ ...prev, orderSubtotalInr: Number(e.target.value || 0) }))
            }
            placeholder="Subtotal"
          />
          <input
            className="border rounded px-2 py-1 text-sm"
            type="number"
            min={0}
            step={0.1}
            value={quoteInput.distanceKm}
            onChange={(e) =>
              setQuoteInput((prev) => ({ ...prev, distanceKm: Number(e.target.value || 0) }))
            }
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
        <div className="flex items-center gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={handlePreviewQuote} disabled={quoting}>
            {quoting ? 'Calculating…' : 'Calculate sample fee'}
          </Button>
          {quoteResult && (
            <span className="text-xs text-gray-600">
              {quoteResult.zoneName
                ? `${String(quoteResult.zoneName)} (${String(quoteResult.zoneId || quoteResult.zone)})`
                : `Zone: ${String(quoteResult.zone || 'n/a')}`}{' '}
              • Total: ₹{String(quoteResult.totalDeliveryFeeInr || 0)}
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
        Order slabs use half-open ranges: <code>minOrderInr</code> inclusive, <code>maxOrderInr</code>{' '}
        exclusive, or null for unlimited. Distance zones are contiguous from 0 KM; shared boundaries belong to the
        lower zone (matches legacy Zone A/B behavior).
      </p>
    </div>
  );
}

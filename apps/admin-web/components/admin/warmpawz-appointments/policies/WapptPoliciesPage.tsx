'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@warmpawz/ui';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { WarmpawzAppointmentsShell } from '@/components/admin/warmpawz-appointments/shared/WarmpawzAppointmentsShell';
import {
  WAPPT_POLICY_CATEGORIES,
  fetchWapptCategoryPolicyTiers,
  fetchWapptPlatformPolicyTiers,
  saveWapptCategoryPolicyTiers,
  saveWapptPlatformPolicyTiers,
  type WapptPolicyTier,
} from '@/lib/warmpawz-appointments-policies-admin';

const CANCELLED_BY_OPTIONS = [
  { value: 'pet_parent', label: 'Customer' },
  { value: 'provider', label: 'Provider' },
] as const;

function emptyTier(cancelledBy: 'pet_parent' | 'provider' = 'pet_parent'): WapptPolicyTier {
  return {
    name: cancelledBy === 'provider' ? 'Provider cancel' : 'Customer cancel',
    cancelledBy,
    refundPercentage: cancelledBy === 'provider' ? 100 : 75,
    hoursBeforeService: 24,
    cancellationFee: 0,
    serviceLocation: 'all',
    cancellationWindow: cancelledBy === 'pet_parent' ? '24_plus' : undefined,
    vendorCancellationReason: cancelledBy === 'provider' ? 'operational' : undefined,
  };
}

export function WapptPoliciesPage() {
  const [tab, setTab] = useState<'platform' | 'category'>('platform');
  const [category, setCategory] = useState<string>('grooming');
  const [tiers, setTiers] = useState<WapptPolicyTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void loadTiers();
  }, [tab, category]);

  async function loadTiers() {
    try {
      setLoading(true);
      const rows =
        tab === 'platform'
          ? await fetchWapptPlatformPolicyTiers()
          : await fetchWapptCategoryPolicyTiers(category);
      setTiers(rows.length > 0 ? rows : [emptyTier()]);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load WAPPT policies');
      setTiers([emptyTier()]);
    } finally {
      setLoading(false);
    }
  }

  function updateTier(index: number, patch: Partial<WapptPolicyTier>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function addTier() {
    setTiers((prev) => [...prev, emptyTier()]);
  }

  function removeTier(index: number) {
    setTiers((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSave() {
    try {
      setSaving(true);
      if (tab === 'platform') {
        await saveWapptPlatformPolicyTiers(tiers);
      } else {
        await saveWapptCategoryPolicyTiers(category, tiers);
      }
      toast.success('WAPPT policies saved');
      await loadTiers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save policies');
    } finally {
      setSaving(false);
    }
  }

  return (
    <WarmpawzAppointmentsShell
      title="Cancellation & refund policies"
      subtitle="Platform defaults and per-hub overrides for Book Appointment bookings"
      actions={
        <Button onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Saving…' : 'Save policies'}
        </Button>
      }
    >
      <div className="space-y-4 rounded-lg border bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <Button variant={tab === 'platform' ? 'default' : 'outline'} onClick={() => setTab('platform')}>
            Platform default
          </Button>
          <Button variant={tab === 'category' ? 'default' : 'outline'} onClick={() => setTab('category')}>
            Category override
          </Button>
        </div>

        {tab === 'category' && (
          <div className="max-w-xs">
            <Label htmlFor="wappt-category">Hub category</Label>
            <select
              id="wappt-category"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {WAPPT_POLICY_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Empty category override inherits platform default at runtime.
            </p>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading policy tiers…</p>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier, idx) => (
              <div key={tier.id ?? `tier-${idx}`} className="rounded border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium">Tier {idx + 1}</h3>
                  <Button type="button" variant="ghost" size="sm" onClick={() => removeTier(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input value={tier.name} onChange={(e) => updateTier(idx, { name: e.target.value })} />
                  </div>
                  <div>
                    <Label>Cancelled by</Label>
                    <select
                      className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                      value={tier.cancelledBy ?? 'pet_parent'}
                      onChange={(e) =>
                        updateTier(idx, {
                          cancelledBy: e.target.value as WapptPolicyTier['cancelledBy'],
                        })
                      }
                    >
                      {CANCELLED_BY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>Refund %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={tier.refundPercentage ?? 0}
                      onChange={(e) => updateTier(idx, { refundPercentage: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>Cancellation fee (₹)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={tier.cancellationFee ?? 0}
                      onChange={(e) => updateTier(idx, { cancellationFee: Number(e.target.value) })}
                    />
                  </div>
                  {(tier.cancelledBy ?? 'pet_parent') === 'pet_parent' && (
                    <div>
                      <Label>Hours before service</Label>
                      <Input
                        type="number"
                        min={0}
                        value={tier.hoursBeforeService ?? 24}
                        onChange={(e) =>
                          updateTier(idx, {
                            hoursBeforeService: Number(e.target.value),
                            cancellationWindow: undefined,
                          })
                        }
                      />
                    </div>
                  )}
                  {(tier.cancelledBy ?? 'pet_parent') === 'provider' && (
                    <div>
                      <Label>Provider reason</Label>
                      <select
                        className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                        value={tier.vendorCancellationReason ?? 'operational'}
                        onChange={(e) => updateTier(idx, { vendorCancellationReason: e.target.value })}
                      >
                        <option value="emergency">Emergency</option>
                        <option value="operational">Operational</option>
                        <option value="technical">Technical</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addTier}>
              <Plus className="mr-2 h-4 w-4" />
              Add tier
            </Button>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Tele consult and e-commerce orders continue to use Finance → Refund Policies and E-commerce Policies.
        </p>
      </div>
    </WarmpawzAppointmentsShell>
  );
}

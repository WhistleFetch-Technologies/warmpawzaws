'use client';

import React, { useEffect, useState } from 'react';
import { Button, Input, Label } from '@warmpawz/ui';
import { toast } from 'sonner';
import {
  fetchWpayConvenienceSettings,
  updateWpayConvenienceSettings,
  type WpayConvenienceSettings,
  type WpayFeeMode,
} from '@/lib/warmpawz-pay-settings-admin';

const EMPTY: WpayConvenienceSettings = {
  platformFee: 0,
  platformFeeMode: 'fixed',
  platformFeeGstRate: 18,
  convenienceFee: 0,
  convenienceFeeMode: 'fixed',
  convenienceGstRate: 18,
  platformGstRate: 18,
  burnMode: false,
};

function FeeModeToggle({
  id,
  value,
  onChange,
}: {
  id: string;
  value: WpayFeeMode;
  onChange: (mode: WpayFeeMode) => void;
}) {
  return (
    <div
      id={id}
      className="inline-flex rounded-md border border-gray-200 bg-white p-0.5"
      role="group"
      aria-label="Fee mode"
    >
      <button
        type="button"
        onClick={() => onChange('fixed')}
        className={`rounded px-2.5 py-1 text-xs font-medium ${
          value === 'fixed' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        Fixed ₹
      </button>
      <button
        type="button"
        onClick={() => onChange('percent')}
        className={`rounded px-2.5 py-1 text-xs font-medium ${
          value === 'percent' ? 'bg-orange-500 text-white' : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        Percentage %
      </button>
    </div>
  );
}

export function ConvenienceSettingsPanel() {
  const [settings, setSettings] = useState<WpayConvenienceSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchWpayConvenienceSettings()
      .then((loaded) =>
        setSettings({
          ...EMPTY,
          ...loaded,
          platformFeeMode: loaded.platformFeeMode === 'percent' ? 'percent' : 'fixed',
          convenienceFeeMode: loaded.convenienceFeeMode === 'percent' ? 'percent' : 'fixed',
        }),
      )
      .catch(() => toast.error('Failed to load WPay fee settings'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await updateWpayConvenienceSettings(settings);
      setSettings({
        ...EMPTY,
        ...saved,
        platformFeeMode: saved.platformFeeMode === 'percent' ? 'percent' : 'fixed',
        convenienceFeeMode: saved.convenienceFeeMode === 'percent' ? 'percent' : 'fixed',
      });
      toast.success('WPay fee settings saved');
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading WPay fee settings…</p>;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-gray-900">Global WPay Fee Settings</h3>
        <p className="text-sm text-gray-500">
          Platform fee and convenience fee are GST-exclusive (GST on top). Percentage mode uses the
          post-discount customer amount (quoted − discount), not the original quote. If total fees
          including fee GST would consume the full discount, all fees are dropped so the customer
          still receives the displayed discount. Platform revenue GST is inclusive in margin
          (commission − discount).
        </p>
      </div>

      <div
        className={`mb-4 rounded-lg border p-3 ${
          settings.burnMode
            ? 'border-amber-300 bg-amber-50'
            : 'border-gray-200 bg-gray-50'
        }`}
      >
        <label htmlFor="wpay-burn-mode" className="flex cursor-pointer items-start gap-3">
          <input
            id="wpay-burn-mode"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
            checked={settings.burnMode}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSettings((s) => ({ ...s, burnMode: e.target.checked }))
            }
          />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Burn / Test mode{settings.burnMode ? ' — ACTIVE' : ''}
            </span>
            <span className="mt-0.5 block text-xs text-gray-600">
              When on: customer still sees the published discount and pays the same (plus fees).
              Vendor is paid the full quoted bill; platform funds the discount. Turn off to restore
              normal tier commission immediately on new payments.
            </span>
          </span>
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="wpay-platform-fee">
              Platform Fee ({settings.platformFeeMode === 'percent' ? '%' : '₹'})
            </Label>
            <FeeModeToggle
              id="wpay-platform-fee-mode"
              value={settings.platformFeeMode}
              onChange={(platformFeeMode) => setSettings((s) => ({ ...s, platformFeeMode }))}
            />
          </div>
          <Input
            id="wpay-platform-fee"
            type="number"
            min={0}
            max={settings.platformFeeMode === 'percent' ? 100 : undefined}
            step={settings.platformFeeMode === 'percent' ? 0.01 : 1}
            value={settings.platformFee}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSettings((s) => ({ ...s, platformFee: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpay-platform-fee-gst">Platform Fee GST (%)</Label>
          <Input
            id="wpay-platform-fee-gst"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={settings.platformFeeGstRate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSettings((s) => ({ ...s, platformFeeGstRate: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label htmlFor="wpay-convenience-fee">
              Convenience Fee ({settings.convenienceFeeMode === 'percent' ? '%' : '₹'})
            </Label>
            <FeeModeToggle
              id="wpay-convenience-fee-mode"
              value={settings.convenienceFeeMode}
              onChange={(convenienceFeeMode) => setSettings((s) => ({ ...s, convenienceFeeMode }))}
            />
          </div>
          <Input
            id="wpay-convenience-fee"
            type="number"
            min={0}
            max={settings.convenienceFeeMode === 'percent' ? 100 : undefined}
            step={settings.convenienceFeeMode === 'percent' ? 0.01 : 1}
            value={settings.convenienceFee}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSettings((s) => ({ ...s, convenienceFee: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpay-convenience-gst">Convenience GST (%)</Label>
          <Input
            id="wpay-convenience-gst"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={settings.convenienceGstRate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSettings((s) => ({ ...s, convenienceGstRate: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpay-platform-gst">Platform Revenue GST (%)</Label>
          <Input
            id="wpay-platform-gst"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={settings.platformGstRate}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSettings((s) => ({ ...s, platformGstRate: Number(e.target.value) || 0 }))
            }
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <Button type="button" onClick={() => void onSave()} disabled={saving} className="bg-[#FF8C42] hover:bg-[#FF7A2E]">
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </section>
  );
}

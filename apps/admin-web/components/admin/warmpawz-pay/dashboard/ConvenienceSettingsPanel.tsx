'use client';

import { useEffect, useState } from 'react';
import { Button, Input, Label } from '@warmpawz/ui';
import { toast } from 'sonner';
import {
  fetchWpayConvenienceSettings,
  updateWpayConvenienceSettings,
  type WpayConvenienceSettings,
} from '@/lib/warmpawz-pay-settings-admin';

const EMPTY: WpayConvenienceSettings = {
  platformFee: 0,
  platformFeeGstRate: 18,
  convenienceFee: 0,
  convenienceGstRate: 18,
  platformGstRate: 18,
};

export function ConvenienceSettingsPanel() {
  const [settings, setSettings] = useState<WpayConvenienceSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchWpayConvenienceSettings()
      .then(setSettings)
      .catch(() => toast.error('Failed to load WPay fee settings'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await updateWpayConvenienceSettings(settings);
      setSettings(saved);
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
          Platform fee and convenience fee are GST-exclusive (GST on top). Platform revenue GST is
          inclusive in margin (commission − discount).
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-2">
          <Label htmlFor="wpay-platform-fee">Platform Fee (₹)</Label>
          <Input
            id="wpay-platform-fee"
            type="number"
            min={0}
            step={1}
            value={settings.platformFee}
            onChange={(e) =>
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
            onChange={(e) =>
              setSettings((s) => ({ ...s, platformFeeGstRate: Number(e.target.value) || 0 }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wpay-convenience-fee">Convenience Fee (₹)</Label>
          <Input
            id="wpay-convenience-fee"
            type="number"
            min={0}
            step={1}
            value={settings.convenienceFee}
            onChange={(e) =>
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
            onChange={(e) =>
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
            onChange={(e) =>
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

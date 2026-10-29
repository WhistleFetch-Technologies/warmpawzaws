'use client';

import { useEffect, useState } from 'react';
import { Button } from '@warmpawz/ui';
import { toast } from 'sonner';
import {
  fetchWpayVendorExportSettings,
  updateWpayVendorExportSettings,
} from '@/lib/warmpawz-pay-settings-admin';

export function VendorExportToggle() {
  const [allowDataDownload, setAllowDataDownload] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchWpayVendorExportSettings()
      .then((loaded) => setAllowDataDownload(loaded.allowDataDownload))
      .catch(() => toast.error('Failed to load vendor download setting'))
      .finally(() => setLoading(false));
  }, []);

  const onSave = async () => {
    setSaving(true);
    try {
      const saved = await updateWpayVendorExportSettings({ allowDataDownload });
      setAllowDataDownload(saved.allowDataDownload);
      toast.success(
        saved.allowDataDownload
          ? 'Vendors can download earnings Excel'
          : 'Vendor earnings download is off',
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Failed to save vendor download setting');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Loading vendor download setting…</p>;
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3">
        <h3 className="text-base font-semibold text-gray-900">Allow vendor data download</h3>
        <p className="text-sm text-gray-500">
          When on, vendors can download Excel of Bookings → Earnings for the selected date window.
          Only customer, channel, datetime, amount to receive, and status are included.
        </p>
      </div>
      <label htmlFor="wpay-allow-vendor-download" className="flex cursor-pointer items-start gap-3">
        <input
          id="wpay-allow-vendor-download"
          type="checkbox"
          className="mt-1 h-4 w-4 rounded border-gray-300 text-[#FF8C42] focus:ring-[#FF8C42]"
          checked={allowDataDownload}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setAllowDataDownload(e.target.checked)
          }
        />
        <span className="text-sm text-gray-800">
          Allow vendors to download their earnings list
        </span>
      </label>
      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
        >
          {saving ? 'Saving…' : 'Save download setting'}
        </Button>
      </div>
    </section>
  );
}

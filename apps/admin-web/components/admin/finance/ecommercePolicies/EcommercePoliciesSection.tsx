'use client';

import { useState, useEffect } from 'react';
import { Button, Input, Label, Checkbox } from '@warmpawz/ui';
import { Save, Package, RotateCcw, Clock } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

const DEFAULT_NON_RETURNABLE = [
  'opened_pet_food',
  'opened_treats_supplements',
  'hygiene_once_opened',
  'customized',
  'clearance',
];

const NON_RETURNABLE_LABELS: Record<string, string> = {
  opened_pet_food: 'Opened pet food & treats',
  opened_treats_supplements: 'Supplements & wellness consumables (opened)',
  hygiene_once_opened: 'Personal hygiene & care products (once opened)',
  customized: 'Customized items',
  clearance: 'Clearance items',
  non_returnable_marked: 'Items marked Non-Returnable on product page',
};

export function EcommercePoliciesSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState({
    returnWindowHours: 48,
    cancelBeforeDispatchFullRefund: true,
    refundProcessingDays: 7,
    nonReturnableCategories: [] as string[],
  });

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/admin/finance/ecommerce-policy-config').catch(() => ({}));
      const raw = (res as any)?.config ?? (res as any)?.data ?? res;
      if (raw && typeof raw === 'object') {
        setConfig({
          returnWindowHours: Number(raw.returnWindowHours ?? raw.return_window_hours ?? 48) || 48,
          cancelBeforeDispatchFullRefund: raw.cancelBeforeDispatchFullRefund !== false && raw.cancel_before_dispatch_full_refund !== false,
          refundProcessingDays: Number(raw.refundProcessingDays ?? raw.refund_processing_days ?? 7) || 7,
          nonReturnableCategories: Array.isArray(raw.nonReturnableCategories ?? raw.non_returnable_categories)
            ? (raw.nonReturnableCategories ?? raw.non_returnable_categories)
            : DEFAULT_NON_RETURNABLE,
        });
      }
    } catch {
      setConfig({
        returnWindowHours: 48,
        cancelBeforeDispatchFullRefund: true,
        refundProcessingDays: 7,
        nonReturnableCategories: DEFAULT_NON_RETURNABLE,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/admin/finance/ecommerce-policy-config', {
        returnWindowHours: config.returnWindowHours,
        cancelBeforeDispatchFullRefund: config.cancelBeforeDispatchFullRefund,
        refundProcessingDays: config.refundProcessingDays,
        nonReturnableCategories: config.nonReturnableCategories,
      });
      toast.success('Ecommerce policy saved');
      await loadConfig();
    } catch {
      toast.error('Failed to save ecommerce policy');
    } finally {
      setSaving(false);
    }
  };

  const toggleNonReturnable = (key: string) => {
    const next = config.nonReturnableCategories.includes(key)
      ? config.nonReturnableCategories.filter((k) => k !== key)
      : [...config.nonReturnableCategories, key];
    setConfig({ ...config, nonReturnableCategories: next });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div>
            <h2 className="text-black text-xl font-semibold">Ecommerce Cancellation & Returns</h2>
            <p className="text-gray-500 text-sm mt-1">Order cancellation, return window, and non-returnable categories</p>
          </div>
          <PolicyHelpButton docKey="finance-ecommerce-policies" />
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#FF8C42] text-white hover:bg-[#E67A32]">
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Return / replacement window (hours after delivery)
            </Label>
            <Input
              type="number"
              min={24}
              max={168}
              value={config.returnWindowHours}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setConfig({ ...config, returnWindowHours: Number.isFinite(v) ? Math.max(24, Math.min(168, v)) : 48 });
              }}
            />
            <p className="text-xs text-gray-500">Return or replacement requests must be raised within this many hours of delivery (e.g. 48).</p>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4" />
              Refund processing (business days)
            </Label>
            <Input
              type="number"
              min={1}
              max={14}
              value={config.refundProcessingDays}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setConfig({ ...config, refundProcessingDays: Number.isFinite(v) ? Math.max(1, Math.min(14, v)) : 7 });
              }}
            />
            <p className="text-xs text-gray-500">Refunds processed to original payment method within this many business days.</p>
          </div>
        </div>

        <div className="flex items-center gap-2 border p-4 rounded-lg bg-green-50/50">
          <Checkbox
            checked={config.cancelBeforeDispatchFullRefund}
            onCheckedChange={(checked) => setConfig({ ...config, cancelBeforeDispatchFullRefund: !!checked })}
          />
          <div>
            <Label>Cancel before dispatch → full refund</Label>
            <p className="text-xs text-gray-500">Orders cancelled before they are shipped receive a full refund.</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Non-returnable categories (unless damaged/incorrect)
          </Label>
          <p className="text-xs text-gray-500">Select categories that are generally non-returnable. Returns may still be accepted if the product is damaged, defective, or wrong item.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 border p-4 rounded-lg">
            {(Object.keys(NON_RETURNABLE_LABELS) as string[]).map((key) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  checked={config.nonReturnableCategories.includes(key)}
                  onCheckedChange={() => toggleNonReturnable(key)}
                />
                <Label className="text-sm">{NON_RETURNABLE_LABELS[key] ?? key}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

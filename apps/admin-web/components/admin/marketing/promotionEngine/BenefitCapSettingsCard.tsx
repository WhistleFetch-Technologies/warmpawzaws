'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from '@warmpawz/ui';
import {
  BENEFIT_CAP_MESSAGE_MAX,
  DEFAULT_BENEFIT_CAP,
  describeBenefitCapWindow,
  fetchBenefitCapSettings,
  previewBenefitCapMessage,
  saveBenefitCapSettings,
  validateBenefitCap,
  type BenefitCapBlock,
  type BenefitCapConfig,
  type BenefitCapWindowType,
  type BenefitCapWindowUnit,
} from '@/lib/promo-engine/benefit-cap';

const BLOCK_OPTIONS: Array<{ value: BenefitCapBlock; label: string }> = [
  { value: 'both', label: 'Discount + cashback + wallet' },
  { value: 'discount', label: 'Discount only' },
  { value: 'cashback', label: 'Cashback + wallet only' },
];

/**
 * Global cap on how many benefit payments (promo discount, cashback or wallet spend) one
 * customer can make per window. Applies to every promotion and checkout channel.
 */
export function BenefitCapSettingsCard() {
  const [cfg, setCfg] = useState<BenefitCapConfig>(DEFAULT_BENEFIT_CAP);
  const [saved, setSaved] = useState<BenefitCapConfig | null>(null);
  const [meta, setMeta] = useState<{ updatedBy: string | null; updatedAt: string | null }>({
    updatedBy: null,
    updatedAt: null,
  });
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    fetchBenefitCapSettings()
      .then((res) => {
        setCfg(res.benefitCap);
        setSaved(res.benefitCap);
        setMeta({ updatedBy: res.updatedBy, updatedAt: res.updatedAt });
      })
      .catch(() => setLoadError(true));
  }, []);

  const set = <K extends keyof BenefitCapConfig>(key: K, value: BenefitCapConfig[K]) =>
    setCfg((prev) => ({ ...prev, [key]: value }));
  const errors = validateBenefitCap(cfg);
  const dirty = saved != null && JSON.stringify(saved) !== JSON.stringify(cfg);

  const save = async () => {
    if (errors.length) return;
    setBusy(true);
    try {
      const next = await saveBenefitCapSettings({ ...cfg, message: cfg.message?.trim() || null });
      setCfg(next);
      setSaved(next);
      setMeta((m) => ({ ...m, updatedAt: new Date().toISOString() }));
      toast.success(next.enabled ? 'Benefit cap saved and active' : 'Benefit cap saved (off)');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const intField = (key: 'max_benefit_payments' | 'window_length') => (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => set(key, e.target.value === '' ? 0 : Math.trunc(Number(e.target.value)));

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Benefit payment cap (all promotions)</h3>
          <p className="text-sm text-slate-500">
            Limits how many payments one customer can make with a promo discount, cashback or wallet
            in a window. Payments over the cap go through at full price with the customer told why.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="benefit-cap-enabled">{cfg.enabled ? 'On' : 'Off'}</Label>
          <Switch
            id="benefit-cap-enabled"
            checked={cfg.enabled}
            disabled={saved == null}
            onCheckedChange={(on: boolean) => set('enabled', on)}
          />
        </div>
      </div>

      {loadError ? (
        <p className="text-sm text-red-700">
          Could not load settings — deploy the Lambda and run migration 1126.
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label>Max benefit payments</Label>
              <Input
                type="number"
                min={1}
                max={100}
                step={1}
                value={cfg.max_benefit_payments || ''}
                onChange={intField('max_benefit_payments')}
              />
              <p className="mt-1 text-xs text-slate-500">Payment number {cfg.max_benefit_payments + 1} is blocked.</p>
            </div>
            <div>
              <Label>Block on capped payments</Label>
              <Select value={cfg.block} onValueChange={(v: string) => set('block', v as BenefitCapBlock)}>
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BLOCK_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Window type</Label>
              <Select
                value={cfg.window_type}
                onValueChange={(v: string) => set('window_type', v as BenefitCapWindowType)}
              >
                <SelectTrigger className="bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="calendar">Calendar (fixed reset)</SelectItem>
                  <SelectItem value="rolling">Rolling</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Length</Label>
                <Input
                  type="number"
                  min={1}
                  step={1}
                  value={cfg.window_length || ''}
                  onChange={intField('window_length')}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Select
                  value={cfg.window_unit}
                  onValueChange={(v: string) => set('window_unit', v as BenefitCapWindowUnit)}
                >
                  <SelectTrigger className="bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                    <SelectItem value="weeks">Weeks</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {cfg.window_type === 'calendar' ? (
              <div>
                <Label>Reset time (IST)</Label>
                <Input
                  type="time"
                  value={cfg.reset_time}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => set('reset_time', e.target.value)}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="benefit-cap-fee"
                checked={cfg.waive_platform_fee}
                onCheckedChange={(on: boolean) => set('waive_platform_fee', on)}
              />
              <Label htmlFor="benefit-cap-fee">Waive Pay Bill platform fee on capped payments</Label>
            </div>
            <p className="text-xs text-slate-500 sm:col-span-2">{describeBenefitCapWindow(cfg)} · max 30 days.</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label>Customer message (optional)</Label>
              <textarea
                className="mt-1 min-h-24 w-full rounded-md border border-slate-300 p-2 text-sm"
                maxLength={BENEFIT_CAP_MESSAGE_MAX}
                placeholder="Leave blank for the default message"
                value={cfg.message ?? ''}
                onChange={(e) => set('message', e.target.value)}
              />
              <p className="text-xs text-slate-500">
                Placeholders: {'{cap}'} {'{used}'} {'{blocked}'} {'{fee}'} {'{resume_at}'}
              </p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              {previewBenefitCapMessage(cfg)}
            </div>
            {errors.length ? (
              <ul className="space-y-1 text-xs text-red-700">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                {meta.updatedAt ? `Last saved ${new Date(meta.updatedAt).toLocaleString('en-IN')}` : ''}
              </p>
              <Button type="button" disabled={busy || !dirty || errors.length > 0} onClick={() => void save()}>
                {busy ? 'Saving…' : 'Save cap settings'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

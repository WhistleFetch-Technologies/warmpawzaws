'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Label,
  Input,
  Button,
} from '@warmpawz/ui';
import { Play, Save } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

interface SettlementScheduleForm {
  scheduleTime: string;
  minPayoutAmount: number;
  timezone: string;
  settlementPeriodDays?: number;
  eventBridgeCronUtc?: string | null;
  /** Default bus rule updated on Save (dev/stage/prod from server env). */
  eventBridgeRuleName?: string | null;
}

export function SettlementScheduleSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState<SettlementScheduleForm>({
    scheduleTime: '09:00',
    minPayoutAmount: 100,
    timezone: 'Asia/Kolkata',
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await apiClient.get<any>('/admin/finance/settlement-schedule');
      const raw = (data as any).data?.settings ?? (data as any).settings;
      if (raw) {
        setSettings({
          scheduleTime: raw.scheduleTime || '09:00',
          minPayoutAmount: raw.minPayoutAmount ?? 100,
          timezone: raw.timezone || 'Asia/Kolkata',
          settlementPeriodDays: raw.settlementPeriodDays,
          eventBridgeCronUtc: raw.eventBridgeCronUtc ?? null,
          eventBridgeRuleName: raw.eventBridgeRuleName ?? null,
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settlement schedule settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        scheduleTime: settings.scheduleTime,
        minPayoutAmount: settings.minPayoutAmount,
        timezone: settings.timezone,
      };
      const data = await apiClient.post<any>('/admin/finance/settlement-schedule', payload);
      const next = (data as any).data?.settings || (data as any).settings;
      if (next) {
        setSettings({
          scheduleTime: next.scheduleTime || settings.scheduleTime,
          minPayoutAmount: next.minPayoutAmount ?? settings.minPayoutAmount,
          timezone: next.timezone || settings.timezone,
          settlementPeriodDays: next.settlementPeriodDays,
          eventBridgeCronUtc: next.eventBridgeCronUtc ?? null,
          eventBridgeRuleName: next.eventBridgeRuleName ?? settings.eventBridgeRuleName ?? null,
        });
      }
      const eb = (data as any).data?.eventBridge ?? (data as any).eventBridge;
      if (eb?.synced === true) {
        toast.success('Settings saved and daily schedule updated in EventBridge.');
      } else if (eb?.skipped) {
        toast.success('Settings saved. EventBridge sync skipped (rule name not configured on server).');
      } else if (eb?.synced === false) {
        toast.warning(
          `Settings saved, but EventBridge was not updated: ${eb.error || 'unknown error'}. Check Lambda IAM (events:PutRule on the settlement rule) and ENVIRONMENT or SETTLEMENT_CALCULATE_CRON_RULE_NAME.`
        );
      } else {
        toast.success('Settlement schedule saved successfully');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const data = await apiClient.post<any>('/settlements/calculate-daily', {});
      const created = (data as any).settlementsCreated ?? (data as any).data?.settlementsCreated ?? 0;
      const total = (data as any).totalAmount ?? (data as any).data?.totalAmount ?? 0;
      toast.success(
        created > 0
          ? `Created ${created} settlement(s), total ₹${Number(total).toLocaleString()}. Process payouts from Payout Management.`
          : 'No new settlements (no eligible bookings).'
      );
      loadSettings();
    } catch (error: any) {
      const msg = (error?.response?.data as any)?.error ?? error?.message ?? 'Failed to run settlement calculation';
      toast.error(msg);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle>Daily job & thresholds</CardTitle>
            <PolicyHelpButton docKey="finance-schedule-settings" />
          </div>
          <CardDescription>
            Automatic daily run (EventBridge →{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">/settlements/calculate-daily</code>) and minimum payout
            used in calculation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Schedule time</Label>
              <Input
                type="time"
                value={settings.scheduleTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({ ...settings, scheduleTime: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <select
                value={settings.timezone}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setSettings({ ...settings, timezone: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Minimum payout amount (₹)</Label>
            <Input
              type="number"
              min={0}
              step={1}
              value={settings.minPayoutAmount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSettings({
                  ...settings,
                  minPayoutAmount: parseFloat(e.target.value) || 0,
                })
              }
            />
            <p className="text-sm text-gray-500">
              Settlements below this net amount are skipped. Eligibility window still follows{' '}
              <strong>Finance → Tier Management</strong> (payout period days).
            </p>
          </div>

          {settings.settlementPeriodDays != null && (
            <p className="text-xs text-gray-500">
              Default tier payout period: <strong>{settings.settlementPeriodDays}</strong> day(s) — edit in Tier Management.
            </p>
          )}

          {settings.eventBridgeRuleName && (
            <p className="text-xs text-gray-500 font-mono break-all">
              EventBridge rule (this environment): {settings.eventBridgeRuleName}
            </p>
          )}
          {settings.eventBridgeCronUtc && (
            <p className="text-xs text-gray-500 font-mono break-all">
              Equivalent EventBridge UTC cron: {settings.eventBridgeCronUtc}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-gray-500 text-right max-w-md">
          Save updates the database and the daily EventBridge rule (when configured). Process Now runs calculation immediately; send to bank from Payout Management.
        </p>
        <div className="flex items-center gap-3">
          <Button onClick={handleProcessNow} disabled={processing} variant="outline">
            <Play className="w-4 h-4 mr-2" />
            {processing ? 'Processing...' : 'Process Now'}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-[#FF8C42] text-white hover:bg-[#E67A32]"
          >
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}

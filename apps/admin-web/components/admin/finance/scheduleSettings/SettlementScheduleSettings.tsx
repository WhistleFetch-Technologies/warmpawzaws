'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Switch,
  Label,
  Input,
  Button,
} from '@warmpawz/ui';
import {
  Clock,
  Calendar,
  IndianRupee,
  Settings as SettingsIcon,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  Save,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { toast } from 'sonner';
import { PolicyHelpButton } from '@/components/PolicyHelpButton';

interface SettlementSchedule {
  enabled: boolean;
  scheduleType: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  scheduleDay: number;
  scheduleTime: string;
  settlementPeriodDays: number;
  autoProcess: boolean;
  minPayoutAmount: number;
  timezone: string;
  lastProcessedAt: string | null;
  nextProcessAt: string | null;
}

export function SettlementScheduleSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [settings, setSettings] = useState<SettlementSchedule>({
    enabled: true,
    scheduleType: 'daily',
    scheduleDay: 1,
    scheduleTime: '09:00',
    settlementPeriodDays: 3,
    autoProcess: true,
    minPayoutAmount: 100,
    timezone: 'Asia/Kolkata',
    lastProcessedAt: null,
    nextProcessAt: null,
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
        setSettings({ ...raw, settlementPeriodDays: raw.settlementPeriodDays ?? 7 });
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
      const data = await apiClient.post<any>('/admin/finance/settlement-schedule', settings);
      setSettings((data as any).data?.settings || (data as any).settings || settings);
      toast.success('Settlement schedule saved successfully');
    } catch (error) {
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
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h2 className="text-black text-xl font-semibold">Schedule Settings</h2>
        <PolicyHelpButton docKey="finance-schedule-settings" />
      </div>
      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Settlement Schedule Status</CardTitle>
          <CardDescription>Current schedule configuration and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  settings.enabled ? 'bg-green-100' : 'bg-gray-100'
                }`}
              >
                {settings.enabled ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600" />
                ) : (
                  <Pause className="w-6 h-6 text-gray-600" />
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {settings.enabled ? 'Schedule Active' : 'Schedule Disabled'}
                </p>
                <p className="text-sm text-gray-500">
                  {settings.scheduleType} at {settings.scheduleTime}
                </p>
              </div>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked: boolean) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          {settings.lastProcessedAt && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Last processed: {new Date(settings.lastProcessedAt).toLocaleString()}
              </p>
            </div>
          )}

          {settings.nextProcessAt && (
            <div className="mt-2 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600">
                Next process: {new Date(settings.nextProcessAt).toLocaleString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Schedule Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Schedule Configuration</CardTitle>
          <CardDescription>Configure automatic settlement processing schedule</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Schedule Type</Label>
              <select
                value={settings.scheduleType}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({
                    ...settings,
                    scheduleType: e.target.value as any,
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Bi-weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {settings.scheduleType !== 'daily' && (
              <div className="space-y-2">
                <Label>Schedule Day</Label>
                <Input
                  type="number"
                  min="1"
                  max={settings.scheduleType === 'weekly' ? 7 : 31}
                  value={settings.scheduleDay}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setSettings({
                      ...settings,
                      scheduleDay: parseInt(e.target.value),
                    })
                  }
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Schedule Time</Label>
              <Input
                type="time"
                value={settings.scheduleTime}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({
                    ...settings,
                    scheduleTime: e.target.value,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Settlement Period (days)</Label>
              <Input
                type="number"
                value={settings.settlementPeriodDays}
                readOnly
                className="bg-gray-100 cursor-not-allowed"
                title="Read-only: defined by default tier in Tier Management (single source of truth)"
              />
              <p className="text-xs text-gray-500">
                From default tier (Finance → Tier Management). Edit payout period there.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto Process</Label>
                <p className="text-sm text-gray-500">
                  Automatically process settlements on schedule
                </p>
              </div>
              <Switch
                checked={settings.autoProcess}
                onCheckedChange={(checked: boolean) =>
                  setSettings({ ...settings, autoProcess: checked })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Minimum Payout Amount (₹)</Label>
              <Input
                type="number"
                value={settings.minPayoutAmount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setSettings({
                    ...settings,
                    minPayoutAmount: parseFloat(e.target.value),
                  })
                }
              />
              <p className="text-sm text-gray-500">
                Only process payouts above this amount
              </p>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <select
                value={settings.timezone}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#FF8C42]"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex flex-col items-end gap-2">
        <p className="text-xs text-gray-500 text-right max-w-md">
          Scheduled runs create settlements as per tier. Process Now runs calculation now; send to bank from Payout Management (including retry for failed payouts).
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

/**
 * SETTLEMENT SCHEDULE SETTINGS
 * 
 * Admin component for configuring automatic payout schedule
 * Located in Finance & Logistics > Settings tab
 */

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../../ui/card';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Switch } from '../../ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Badge } from '../../ui/badge';
import { Separator } from '../../ui/separator';
import { Clock, Calendar, DollarSign, Settings as SettingsIcon, Play, Pause, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { projectId, publicAnonKey } from '../../../utils/supabase/info';

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
    nextProcessAt: null
  });

  const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/admin/finance/settlement-schedule`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.settings) {
          setSettings(data.settings);
        }
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
      const response = await fetch(`${API_BASE}/admin/finance/settlement-schedule`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        const data = await response.json();
        setSettings(data.settings);
        toast.success('Settlement schedule saved successfully');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Error saving settings');
    } finally {
      setSaving(false);
    }
  };

  const handleProcessNow = async () => {
    setProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/admin/finance/process-settlements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`
        },
        body: JSON.stringify({ force: false })
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(`Processed ${data.processed} settlements successfully`);
        loadSettings();
      } else {
        toast.error('Failed to process settlements');
      }
    } catch (error) {
      toast.error('Error processing settlements');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8C42]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Settlement Schedule</h2>
          <p className="text-sm text-slate-500">Configure automatic payout processing schedule</p>
        </div>
        <Button
          onClick={handleProcessNow}
          disabled={processing}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
        >
          {processing ? 'Processing...' : 'Process Now'}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Schedule Configuration</CardTitle>
                <CardDescription>Set when automatic payouts should run</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Automatic Settlements</Label>
                <p className="text-xs text-slate-500">Process payouts automatically based on schedule</p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(c) => setSettings({ ...settings, enabled: c })}
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Schedule Type</Label>
                <Select
                  value={settings.scheduleType}
                  onValueChange={(value: any) => setSettings({ ...settings, scheduleType: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {settings.scheduleType === 'weekly' || settings.scheduleType === 'biweekly' ? (
                <div className="space-y-2">
                  <Label>Day of Week</Label>
                  <Select
                    value={String(settings.scheduleDay)}
                    onValueChange={(value) => setSettings({ ...settings, scheduleDay: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Monday</SelectItem>
                      <SelectItem value="2">Tuesday</SelectItem>
                      <SelectItem value="3">Wednesday</SelectItem>
                      <SelectItem value="4">Thursday</SelectItem>
                      <SelectItem value="5">Friday</SelectItem>
                      <SelectItem value="6">Saturday</SelectItem>
                      <SelectItem value="0">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : settings.scheduleType === 'monthly' ? (
                <div className="space-y-2">
                  <Label>Day of Month (1-31)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={settings.scheduleDay}
                    onChange={(e) => setSettings({ ...settings, scheduleDay: parseInt(e.target.value) || 1 })}
                  />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Time (HH:mm)</Label>
                <Input
                  type="time"
                  value={settings.scheduleTime}
                  onChange={(e) => setSettings({ ...settings, scheduleTime: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings({ ...settings, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Settlement Rules */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 bg-orange-100 rounded-lg">
                <DollarSign className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <CardTitle className="text-lg">Settlement Rules</CardTitle>
                <CardDescription>Configure payout thresholds and periods</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Settlement Period (Days)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    value={settings.settlementPeriodDays}
                    onChange={(e) => setSettings({ ...settings, settlementPeriodDays: parseInt(e.target.value) || 0 })}
                    className="pr-12"
                  />
                  <div className="absolute right-3 top-2.5 text-slate-400 text-sm">Days</div>
                </div>
                <p className="text-xs text-slate-500">
                  Bookings completed T+{settings.settlementPeriodDays} days ago will be eligible for payout
                </p>
              </div>

              <div className="space-y-2">
                <Label>Minimum Payout Amount (₹)</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    value={settings.minPayoutAmount}
                    onChange={(e) => setSettings({ ...settings, minPayoutAmount: parseInt(e.target.value) || 0 })}
                    className="pl-8"
                  />
                  <div className="absolute left-3 top-2.5 text-slate-400 text-sm">₹</div>
                </div>
                <p className="text-xs text-slate-500">
                  Only process payouts above this amount
                </p>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Process</Label>
                  <p className="text-xs text-slate-500">Automatically process payouts on schedule</p>
                </div>
                <Switch
                  checked={settings.autoProcess}
                  onCheckedChange={(c) => setSettings({ ...settings, autoProcess: c })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Schedule Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
              <div className={`p-2 rounded-lg ${settings.enabled ? 'bg-green-100' : 'bg-gray-100'}`}>
                {settings.enabled ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-600" />
                )}
              </div>
              <div>
                <p className="text-sm text-slate-600">Status</p>
                <p className="font-semibold text-slate-900">
                  {settings.enabled ? 'Active' : 'Disabled'}
                </p>
              </div>
            </div>

            {settings.lastProcessedAt && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Clock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Last Processed</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(settings.lastProcessedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {settings.nextProcessAt && (
              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-lg">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <Calendar className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Next Process</p>
                  <p className="font-semibold text-slate-900">
                    {new Date(settings.nextProcessAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-[#FF8C42] hover:bg-[#FF7A2E]"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}


'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Label,
  Switch,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Badge,
} from '@warmpawz/ui';
import { Users, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface ReferralProgramSettings {
  is_enabled: boolean;
  max_redemptions_per_code: number | null;
  minimum_booking_amount: number | null;
  referrer_action_name: string;
  referee_action_name: string;
}

interface ReferralSignupRow {
  id: string;
  status: string;
  created_at: string;
  qualified_at?: string | null;
  rewarded_at?: string | null;
  referral_code: string;
  referrer_name?: string;
  referrer_phone?: string;
  referee_name?: string;
  referee_phone?: string;
}

interface ReferralStats {
  pending: number;
  qualified: number;
  rewarded: number;
  rejected: number;
  total: number;
  totalPointsIssued: number;
}

interface LoyaltyActionRule {
  action_name: string;
  action_category: string;
  is_active: boolean;
}

export function ReferralSignupsManagement() {
  const [settings, setSettings] = useState<ReferralProgramSettings>({
    is_enabled: true,
    max_redemptions_per_code: null,
    minimum_booking_amount: null,
    referrer_action_name: 'customer_referral',
    referee_action_name: 'referral_signup',
  });
  const [actionRules, setActionRules] = useState<LoyaltyActionRule[]>([]);
  const [signups, setSignups] = useState<ReferralSignupRow[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, statsRes, signupsRes, rulesRes] = await Promise.all([
        apiClient.get<{ settings: ReferralProgramSettings }>('/admin/referral-program-settings'),
        apiClient.get<{ stats: ReferralStats }>('/admin/referrals/stats'),
        apiClient.get<{ signups: ReferralSignupRow[] }>(
          `/admin/referrals/signups${statusFilter !== 'all' ? `?status=${encodeURIComponent(statusFilter)}` : ''}`
        ),
        apiClient.get<{ rules?: LoyaltyActionRule[] }>('/admin/loyalty-action-rules?actionCategory=referral_rewards'),
      ]);
      if (settingsRes.settings) setSettings(settingsRes.settings);
      if (statsRes.stats) setStats(statsRes.stats);
      setSignups(signupsRes.signups || []);
      setActionRules(
        (rulesRes.rules || []).filter((r) => r.is_active !== false)
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const res = await apiClient.put<{ settings: ReferralProgramSettings }>(
        '/admin/referral-program-settings',
        {
          ...settings,
          max_redemptions_per_code:
            settings.max_redemptions_per_code === null ||
            settings.max_redemptions_per_code === undefined ||
            Number.isNaN(Number(settings.max_redemptions_per_code))
              ? null
              : Number(settings.max_redemptions_per_code),
          minimum_booking_amount:
            settings.minimum_booking_amount === null ||
            settings.minimum_booking_amount === undefined ||
            Number.isNaN(Number(settings.minimum_booking_amount))
              ? null
              : Number(settings.minimum_booking_amount),
        }
      );
      if (res.settings) setSettings(res.settings);
      toast.success('Referral program settings saved');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const exportCsv = () => {
    if (signups.length === 0) {
      toast.info('No signups to export');
      return;
    }
    const header = [
      'id',
      'status',
      'referral_code',
      'referrer_name',
      'referrer_phone',
      'referee_name',
      'referee_phone',
      'created_at',
      'rewarded_at',
    ];
    const lines = signups.map((row) =>
      [
        row.id,
        row.status,
        row.referral_code,
        row.referrer_name || '',
        row.referrer_phone || '',
        row.referee_name || '',
        row.referee_phone || '',
        row.created_at,
        row.rewarded_at || '',
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `referral-signups-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-800',
      qualified: 'bg-blue-100 text-blue-800',
      rewarded: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
    };
    return (
      <Badge className={map[status] || 'bg-gray-100 text-gray-800'}>{status}</Badge>
    );
  };

  const referralRuleOptions = actionRules.length
    ? actionRules
    : [
        { action_name: 'customer_referral', action_category: 'referral_rewards', is_active: true },
        { action_name: 'referral_signup', action_category: 'referral_rewards', is_active: true },
      ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Program settings</CardTitle>
          <CardDescription>
            Control referral caps and which loyalty action rules award points. Point amounts are
            edited under Action Rules (referral_rewards category).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="referral-enabled">Program enabled</Label>
            <Switch
              id="referral-enabled"
              checked={settings.is_enabled}
              onCheckedChange={(checked) =>
                setSettings((s) => ({ ...s, is_enabled: checked }))
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="max-redemptions">Max friends per code (blank = unlimited)</Label>
              <Input
                id="max-redemptions"
                type="number"
                min={1}
                value={settings.max_redemptions_per_code ?? ''}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    max_redemptions_per_code: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
            <div>
              <Label htmlFor="min-booking">Minimum booking amount (₹)</Label>
              <Input
                id="min-booking"
                type="number"
                min={0}
                step="0.01"
                value={settings.minimum_booking_amount ?? ''}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    minimum_booking_amount: e.target.value ? Number(e.target.value) : null,
                  }))
                }
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Referrer action name</Label>
              <Select
                value={settings.referrer_action_name}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, referrer_action_name: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {referralRuleOptions.map((r) => (
                    <SelectItem key={r.action_name} value={r.action_name}>
                      {r.action_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Referee action name</Label>
              <Select
                value={settings.referee_action_name}
                onValueChange={(v) =>
                  setSettings((s) => ({ ...s, referee_action_name: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {referralRuleOptions.map((r) => (
                    <SelectItem key={r.action_name} value={r.action_name}>
                      {r.action_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={saveSettings} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : 'Save settings'}
          </Button>
        </CardContent>
      </Card>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {(['pending', 'qualified', 'rewarded', 'rejected', 'total'] as const).map((key) => (
            <Card key={key}>
              <CardContent className="pt-4 text-center">
                <p className="text-2xl font-bold">{stats[key]}</p>
                <p className="text-xs text-muted-foreground capitalize">{key}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Referral signups
            </CardTitle>
            <CardDescription>Read-only monitor of referral redemption lifecycle</CardDescription>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="qualified">Qualified</SelectItem>
                <SelectItem value="rewarded">Rewarded</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-1" />
              CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading…</p>
          ) : signups.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No referral signups yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Referrer</TableHead>
                  <TableHead>Referee</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Linked</TableHead>
                  <TableHead>Rewarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signups.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono text-sm">{row.referral_code}</TableCell>
                    <TableCell>
                      <div className="text-sm">{row.referrer_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{row.referrer_phone}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{row.referee_name || '—'}</div>
                      <div className="text-xs text-muted-foreground">{row.referee_phone}</div>
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="text-xs">
                      {row.created_at ? new Date(row.created_at).toLocaleString() : '—'}
                    </TableCell>
                    <TableCell className="text-xs">
                      {row.rewarded_at ? new Date(row.rewarded_at).toLocaleString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

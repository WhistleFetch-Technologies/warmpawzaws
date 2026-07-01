'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AdminLayout } from '@/components/admin/layout/AdminLayout';
import { apiClient } from '@/lib/api-client';
import { CampaignPreview, type PreviewPlatform } from '@/components/admin/notification-engine/CampaignPreview';
import { hasAdminPortalPermission } from '@/lib/admin-permissions';
import { AlertTriangle, Bell, Loader2, Send, Save } from 'lucide-react';

type TargetApp = 'CUSTOMER' | 'VENDOR';
type TargetingType = 'BROADCAST' | 'SPECIFIC_USERS' | 'REGIONS' | 'CITIES' | 'SEGMENTS';
type CampaignStatus = 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'SENT' | 'FAILED' | 'CANCELLED';

interface CampaignRow {
  id: string;
  name: string;
  title: string;
  target_app: TargetApp;
  status: CampaignStatus;
  estimated_recipients: number;
  scheduled_at_utc?: string;
  created_at: string;
  targeting_type: string;
}

interface TemplateRow {
  id: string;
  name: string;
  title_template: string;
  message_template: string;
  cta_template?: string;
  target_app: TargetApp;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  QUEUED: 'bg-indigo-100 text-indigo-700',
  SENDING: 'bg-yellow-100 text-yellow-800',
  SENT: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-200 text-gray-600',
};

const emptyForm = {
  name: '',
  target_app: 'CUSTOMER' as TargetApp,
  channel: 'PUSH',
  title: '',
  message: '',
  cta_text: '',
  deep_link: '',
  image_url: '',
  targeting_type: 'BROADCAST' as TargetingType,
  pet_type: '',
  activity: '',
  wallet_min: '',
  vendor_type: '',
  vendor_status: '',
  has_push_token: false,
  push_platform: '',
  scheduled_at_utc: '',
  timezone: 'Asia/Kolkata',
  region_ids: [] as string[],
  city_names: [] as string[],
  segment_ids: [] as string[],
  user_ids_text: '',
};

interface RegionRow {
  id: string;
  name: string;
  code: string;
}

interface SegmentRow {
  id: string;
  name: string;
  target_app: TargetApp;
}

export default function NotificationEnginePage() {
  const [form, setForm] = useState(emptyForm);
  const [previewPlatform, setPreviewPlatform] = useState<PreviewPlatform>('android');
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [settings, setSettings] = useState({ customerPushEnabled: true, vendorPushEnabled: true });
  const [estimate, setEstimate] = useState<{ estimatedRecipients: number; warnings: string[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimating, setEstimating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [segments, setSegments] = useState<SegmentRow[]>([]);

  const canSend = hasAdminPortalPermission(['admin.notifications.send', 'admin.full_access']);
  const canCreate = hasAdminPortalPermission(['admin.notifications.create', 'admin.full_access']);

  const titleLen = form.title.length;
  const messageLen = form.message.length;
  const ctaLen = form.cta_text.length;

  const pushDisabled =
    (form.target_app === 'CUSTOMER' && !settings.customerPushEnabled) ||
    (form.target_app === 'VENDOR' && !settings.vendorPushEnabled);

  const validationErrors = useMemo(() => {
    const errs: string[] = [];
    if (!form.name.trim()) errs.push('Campaign name is required');
    if (!form.title.trim() || titleLen > 60) errs.push('Title required (max 60 characters)');
    if (!form.message.trim() || messageLen > 180) errs.push('Message required (max 180 characters)');
    if (form.cta_text && ctaLen > 20) errs.push('CTA max 20 characters');
    return errs;
  }, [form, titleLen, messageLen, ctaLen]);

  const loadInitial = useCallback(async () => {
    try {
      setLoading(true);
      const [campaignRes, templateRes, settingsRes, regionRes, cityRes, segmentRes] = await Promise.all([
        apiClient.get<any>('/admin/notifications/campaigns'),
        apiClient.get<any>('/admin/notifications/templates'),
        apiClient.get<any>('/admin/notifications/settings'),
        apiClient.get<any>('/admin/regions').catch(() => ({ regions: [] })),
        apiClient.get<any>('/admin/banners/locations/cities').catch(() => ({ cities: [] })),
        apiClient.get<any>('/admin/notifications/segments').catch(() => ({ segments: [] })),
      ]);
      setCampaigns(campaignRes.campaigns || []);
      setTemplates(templateRes.templates || []);
      if (settingsRes.settings) setSettings(settingsRes.settings);
      setRegions(regionRes.regions || []);
      setCities((cityRes.cities || []).map((c: { value?: string } | string) =>
        typeof c === 'string' ? c : String(c.value || '')
      ).filter(Boolean));
      setSegments(segmentRes.segments || []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load notification engine');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  const buildAudiencePayload = () => ({
    targeting_type: form.targeting_type,
    target_app: form.target_app,
    region_ids: form.region_ids.length ? form.region_ids : undefined,
    city_names: form.city_names.length ? form.city_names : undefined,
    segment_ids: form.segment_ids.length ? form.segment_ids : undefined,
    user_ids: form.user_ids_text
      ? form.user_ids_text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : undefined,
    pet_type: form.pet_type || undefined,
    activity: form.activity || undefined,
    wallet_min: form.wallet_min ? Number(form.wallet_min) : undefined,
    vendor_type: form.vendor_type || undefined,
    vendor_status: form.vendor_status || undefined,
    has_push_token: form.has_push_token || undefined,
    push_platform: form.push_platform || undefined,
  });

  const toggleArrayValue = (key: 'region_ids' | 'city_names' | 'segment_ids', value: string) => {
    setForm((prev) => {
      const current = prev[key] as string[];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [key]: next };
    });
  };

  const runEstimate = async () => {
    try {
      setEstimating(true);
      setError(null);
      const res = await apiClient.post<any>('/admin/notifications/estimate-audience', buildAudiencePayload());
      setEstimate({ estimatedRecipients: res.estimatedRecipients ?? 0, warnings: res.warnings || [] });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Estimate failed');
    } finally {
      setEstimating(false);
    }
  };

  const startNewCampaign = () => {
    setDraftCampaignId(null);
    setEstimate(null);
    setError(null);
    setSuccess(null);
    setForm({ ...emptyForm });
  };

  const saveDraft = async (): Promise<string | null> => {
    if (!canCreate) return draftCampaignId;
    if (validationErrors.length) {
      setError(validationErrors.join('; '));
      return null;
    }
    try {
      setSaving(true);
      setError(null);
      const { user_ids_text, region_ids, city_names, segment_ids, ...rest } = form;
      const payload = {
        ...rest,
        status: 'DRAFT',
        wallet_min: form.wallet_min ? Number(form.wallet_min) : undefined,
        region_ids,
        city_names,
        segment_ids,
        user_ids: user_ids_text
          ? user_ids_text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
          : undefined,
      };
      const existing = draftCampaignId
        ? campaigns.find((c) => c.id === draftCampaignId)
        : undefined;
      const terminalStatus =
        existing && ['SENT', 'CANCELLED', 'SENDING'].includes(existing.status);
      const createNew = !draftCampaignId || terminalStatus;

      const res = createNew
        ? await apiClient.post<any>('/admin/notifications/campaigns', payload)
        : await apiClient.put<any>(`/admin/notifications/campaigns/${draftCampaignId}`, payload);
      const id = (res.campaign?.id as string) || (createNew ? null : draftCampaignId);
      if (id) setDraftCampaignId(id);
      setSuccess(
        terminalStatus
          ? 'Previous campaign was already sent — saved as a new draft'
          : 'Campaign draft saved'
      );
      loadInitial();
      return id;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const sendCampaign = async (schedule = false) => {
    if (!canSend) return;
    if (validationErrors.length) {
      setError(validationErrors.join('; '));
      return;
    }
    try {
      setSending(true);
      setError(null);
      const id = await saveDraft();
      if (!id) return;

      await apiClient.post(`/admin/notifications/campaigns/${id}/validate`);

      if (schedule) {
        if (!form.scheduled_at_utc) {
          setError('Schedule datetime required');
          return;
        }
        await apiClient.post(`/admin/notifications/campaigns/${id}/schedule`, {
          scheduled_at_utc: new Date(form.scheduled_at_utc).toISOString(),
          timezone: form.timezone,
        });
        setSuccess('Campaign scheduled');
      } else {
        const sendRes = await apiClient.post<any>(`/admin/notifications/campaigns/${id}/send`);
        const sent = sendRes.sentRecipients ?? estimate?.estimatedRecipients;
        setSuccess(
          `Campaign sent to ${sent ?? '?'} recipients (inbox + push). Use "New campaign" to send again.`
        );
        setDraftCampaignId(null);
        setEstimate(null);
      }
      loadInitial();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Send failed';
      setError(
        msg.includes('already SENT')
          ? 'This campaign was already sent. Click "New campaign", then Save Draft and Send Now.'
          : msg
      );
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (t: TemplateRow) => {
    setForm((prev) => ({
      ...prev,
      target_app: t.target_app,
      title: t.title_template,
      message: t.message_template,
      cta_text: t.cta_template || '',
    }));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Bell className="w-7 h-7 text-orange-500" />
                Notification Engine
              </h1>
              <p className="text-sm text-gray-500 mt-1">Audience → Message → Preview → Estimate → Review → Send</p>
            </div>
            <div className="text-xs text-gray-500">
              Push: Customer {settings.customerPushEnabled ? 'on' : 'off'} · Vendor {settings.vendorPushEnabled ? 'on' : 'off'}
              <span className="block text-[10px]">Configure in Platform Settings → Notifications</span>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto p-6 space-y-6 pb-16">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex justify-between">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)}>✕</button>
            </div>
          )}
          {success && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex justify-between">
              <span>{success}</span>
              <button type="button" onClick={() => setSuccess(null)}>✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 space-y-6">
              {/* 1 Campaign Details */}
              <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">1. Campaign Details</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Campaign Name</label>
                    <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Target App</label>
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.target_app}
                      onChange={(e) => setForm({ ...form, target_app: e.target.value as TargetApp })}>
                      <option value="CUSTOMER">Customer</option>
                      <option value="VENDOR">Vendor</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Channel</label>
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.channel} disabled>
                      <option value="PUSH">Push</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <input className="mt-1 w-full border rounded-lg px-3 py-2 bg-gray-50" value="Draft" readOnly />
                  </div>
                </div>
              </section>

              {/* 2 Audience */}
              <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">2. Audience Selection</h2>
                <select className="w-full border rounded-lg px-3 py-2" value={form.targeting_type}
                  onChange={(e) => setForm({ ...form, targeting_type: e.target.value as TargetingType })}>
                  <option value="BROADCAST">Broadcast</option>
                  <option value="REGIONS">Regions</option>
                  <option value="CITIES">Cities</option>
                  <option value="SEGMENTS">Segments</option>
                  <option value="SPECIFIC_USERS">Specific Users</option>
                </select>

                {form.targeting_type === 'REGIONS' && (
                  <div className="pt-2">
                    <label className="text-sm text-gray-600">Regions</label>
                    <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {regions.length === 0 ? (
                        <p className="text-xs text-gray-500">No regions loaded</p>
                      ) : (
                        regions.map((r) => (
                          <label key={r.id} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.region_ids.includes(r.id)}
                              onChange={() => toggleArrayValue('region_ids', r.id)}
                            />
                            {r.name} ({r.code})
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {form.targeting_type === 'CITIES' && (
                  <div className="pt-2">
                    <label className="text-sm text-gray-600">Cities</label>
                    <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {cities.length === 0 ? (
                        <p className="text-xs text-gray-500">No cities loaded</p>
                      ) : (
                        cities.map((city) => (
                          <label key={city} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={form.city_names.includes(city)}
                              onChange={() => toggleArrayValue('city_names', city)}
                            />
                            {city}
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {form.targeting_type === 'SEGMENTS' && (
                  <div className="pt-2">
                    <label className="text-sm text-gray-600">Segments</label>
                    <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                      {segments.filter((s) => s.target_app === form.target_app).length === 0 ? (
                        <p className="text-xs text-gray-500">No segments for this app</p>
                      ) : (
                        segments
                          .filter((s) => s.target_app === form.target_app)
                          .map((s) => (
                            <label key={s.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={form.segment_ids.includes(s.id)}
                                onChange={() => toggleArrayValue('segment_ids', s.id)}
                              />
                              {s.name}
                            </label>
                          ))
                      )}
                    </div>
                  </div>
                )}

                {form.targeting_type === 'SPECIFIC_USERS' && (
                  <div className="pt-2">
                    <label className="text-sm text-gray-600">User UUIDs (comma or space separated)</label>
                    <textarea
                      rows={3}
                      className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-xs"
                      value={form.user_ids_text}
                      onChange={(e) => setForm({ ...form, user_ids_text: e.target.value })}
                      placeholder="00000000-0000-0000-0000-000000000001"
                    />
                  </div>
                )}

                {form.target_app === 'CUSTOMER' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-sm text-gray-600">Pet Type</label>
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.pet_type}
                        onChange={(e) => setForm({ ...form, pet_type: e.target.value })}>
                        <option value="">Any</option>
                        <option value="dog">Dog</option>
                        <option value="cat">Cat</option>
                        <option value="bird">Bird</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Activity</label>
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.activity}
                        onChange={(e) => setForm({ ...form, activity: e.target.value })}>
                        <option value="">Any</option>
                        <option value="active">Active</option>
                        <option value="inactive_30">Inactive 30 Days</option>
                        <option value="inactive_60">Inactive 60 Days</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Min Wallet Balance</label>
                      <input type="number" className="mt-1 w-full border rounded-lg px-3 py-2" value={form.wallet_min}
                        onChange={(e) => setForm({ ...form, wallet_min: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-100">
                  <label className="flex items-center gap-2 text-sm text-gray-700 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={form.has_push_token}
                      onChange={(e) => setForm({ ...form, has_push_token: e.target.checked })}
                    />
                    Only users with an active push token (recommended for push campaigns)
                  </label>
                  <div>
                    <label className="text-sm text-gray-600">Push platform (optional)</label>
                    <select
                      className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={form.push_platform}
                      onChange={(e) => setForm({ ...form, push_platform: e.target.value })}
                      disabled={!form.has_push_token}
                    >
                      <option value="">Any platform</option>
                      <option value="ios">iOS</option>
                      <option value="android">Android</option>
                      <option value="web">Web</option>
                    </select>
                  </div>
                </div>

                {form.target_app === 'VENDOR' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="text-sm text-gray-600">Vendor Type</label>
                      <select className="mt-1 w-full border rounded-lg px-3 py-2" value={form.vendor_type}
                        onChange={(e) => setForm({ ...form, vendor_type: e.target.value })}>
                        <option value="">Any</option>
                        <option value="grooming">Grooming</option>
                        <option value="veterinary">Veterinary</option>
                        <option value="boarding">Boarding</option>
                        <option value="training">Training</option>
                        <option value="walking">Walking</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Status</label>
                      <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.vendor_status}
                        onChange={(e) => setForm({ ...form, vendor_status: e.target.value })} placeholder="approved" />
                    </div>
                  </div>
                )}

                <button type="button" onClick={runEstimate} disabled={estimating}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50">
                  {estimating ? 'Estimating…' : '5. Estimate Audience'}
                </button>
              </section>

              {/* 3 Builder + Templates */}
              <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">3. Notification Builder</h2>
                {templates.length > 0 && (
                  <div>
                    <label className="text-sm text-gray-600">Load Template</label>
                    <select className="mt-1 w-full border rounded-lg px-3 py-2" defaultValue=""
                      onChange={(e) => {
                        const t = templates.find((x) => x.id === e.target.value);
                        if (t) applyTemplate(t);
                      }}>
                      <option value="" disabled>Select template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="text-sm text-gray-600">Title ({titleLen}/60)</label>
                  <input maxLength={60} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm text-gray-600">Message ({messageLen}/180)</label>
                  <textarea maxLength={180} rows={4} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">CTA Text ({ctaLen}/20)</label>
                    <input maxLength={20} className="mt-1 w-full border rounded-lg px-3 py-2" value={form.cta_text}
                      onChange={(e) => setForm({ ...form, cta_text: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Deep Link</label>
                    <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.deep_link}
                      onChange={(e) => setForm({ ...form, deep_link: e.target.value })} placeholder="/booking" />
                  </div>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Optional Image URL</label>
                  <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.image_url}
                    onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
                </div>
              </section>

              {/* 6-8 Review & Schedule */}
              <section className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">6–8. Review, Schedule & Send</h2>

                {validationErrors.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    {validationErrors.join(' · ')}
                  </div>
                )}

                {pushDisabled && (
                  <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    {form.target_app} push notifications are currently disabled.
                  </div>
                )}

                {estimate && (
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-gray-900">
                      You are about to send this notification to {estimate.estimatedRecipients.toLocaleString()} recipients.
                    </p>
                    {estimate.estimatedRecipients === 0 && (
                      <p className="text-red-600">No recipients match selected filters.</p>
                    )}
                    {estimate.warnings.map((w) => (
                      <p key={w} className="text-amber-700">{w}</p>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Notifications cannot be recalled once sent.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Schedule (UTC stored)</label>
                    <input type="datetime-local" className="mt-1 w-full border rounded-lg px-3 py-2"
                      value={form.scheduled_at_utc}
                      onChange={(e) => setForm({ ...form, scheduled_at_utc: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Timezone (display)</label>
                    <input className="mt-1 w-full border rounded-lg px-3 py-2" value={form.timezone}
                      onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={startNewCampaign}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700">
                    New campaign
                  </button>
                  {canCreate && (
                    <button type="button" onClick={saveDraft} disabled={saving}
                      className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm">
                      <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Draft'}
                    </button>
                  )}
                  {canSend && (
                    <>
                      <button type="button" onClick={() => sendCampaign(true)} disabled={sending}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">
                        Schedule
                      </button>
                      <button type="button" onClick={() => sendCampaign(false)} disabled={sending}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg text-sm disabled:opacity-50">
                        <Send className="w-4 h-4" /> {sending ? 'Sending…' : 'Send Now'}
                      </button>
                    </>
                  )}
                </div>
              </section>
            </div>

            {/* 4 Live Preview */}
            <div className="space-y-4">
              <section className="bg-white rounded-2xl border border-gray-200 p-6 sticky top-24">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">4. Live Preview</h2>
                <div className="flex flex-wrap gap-2 mb-4">
                  {(['android', 'ios', 'customer', 'vendor'] as PreviewPlatform[]).map((p) => (
                    <button key={p} type="button" onClick={() => setPreviewPlatform(p)}
                      className={`px-3 py-1 rounded-full text-xs capitalize ${previewPlatform === p ? 'bg-orange-500 text-white' : 'bg-gray-100'}`}>
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex justify-center overflow-x-auto pb-2">
                  <CampaignPreview
                    platform={previewPlatform}
                    targetApp={form.target_app}
                    title={form.title}
                    message={form.message}
                    ctaText={form.cta_text}
                    imageUrl={form.image_url || undefined}
                  />
                </div>
              </section>
            </div>
          </div>

          {/* 9 Recent Campaigns */}
          <section className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">9. Recent Campaigns</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-gray-500 border-b">
                    <th className="py-2 pr-4">Campaign</th>
                    <th className="py-2 pr-4">Target App</th>
                    <th className="py-2 pr-4">Audience</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Recipients</th>
                    <th className="py-2 pr-4">Scheduled</th>
                    <th className="py-2 pr-4">Created</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-gray-500">No campaigns yet</td></tr>
                  ) : (
                    campaigns.map((c) => (
                      <tr key={c.id} className="border-b border-gray-100">
                        <td className="py-3 pr-4 font-medium">{c.name}</td>
                        <td className="py-3 pr-4">{c.target_app}</td>
                        <td className="py-3 pr-4">{c.targeting_type}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[c.status] || ''}`}>{c.status}</span>
                        </td>
                        <td className="py-3 pr-4">{c.estimated_recipients?.toLocaleString() ?? 0}</td>
                        <td className="py-3 pr-4">{c.scheduled_at_utc ? new Date(c.scheduled_at_utc).toLocaleString() : '—'}</td>
                        <td className="py-3 pr-4">{new Date(c.created_at).toLocaleString()}</td>
                        <td className="py-3">
                          {canCreate && (
                            <button
                              type="button"
                              className="text-xs text-orange-600 hover:underline"
                              onClick={async () => {
                                try {
                                  const res = await apiClient.post<any>(
                                    `/admin/notifications/campaigns/${c.id}/duplicate`
                                  );
                                  const newId = res.campaign?.id as string;
                                  if (newId) {
                                    setDraftCampaignId(newId);
                                    setSuccess(`Duplicated "${c.name}" — edit and send as a new campaign`);
                                  }
                                  loadInitial();
                                } catch (e: unknown) {
                                  setError(e instanceof Error ? e.message : 'Duplicate failed');
                                }
                              }}
                            >
                              Duplicate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </main>
      </div>
    </AdminLayout>
  );
}

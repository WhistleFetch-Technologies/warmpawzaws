'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  fetchAdminCommerceConfiguration,
  fetchAdminCommerceModels,
  saveAdminCommerceConfiguration,
  clearCommerceSwitchCache,
} from '@/lib/commerce-switch-client';
import type { CommerceModelDescriptor, CommerceModelId } from '@warmpawz/commerce-switch-contracts';

export function CommerceSwitchPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeModelId, setActiveModelId] = useState<CommerceModelId>('marketplace');
  const [registeredModels, setRegisteredModels] = useState<CommerceModelDescriptor[]>([]);
  const [version, setVersion] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [config, models] = await Promise.all([
        fetchAdminCommerceConfiguration(),
        fetchAdminCommerceModels(),
      ]);
      setActiveModelId(config.activeModelId);
      setRegisteredModels(models);
      setVersion(config.version);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load Commerce Switch configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const latest = await fetchAdminCommerceConfiguration();
      setVersion(latest.version);

      const availableModels = registeredModels.map((m) => m.id);
      const saved = await saveAdminCommerceConfiguration({
        activeModelId,
        availableModels,
        expectedVersion: latest.version,
      });
      setVersion(saved.version);
      setActiveModelId(saved.activeModelId);
      toast.success('Commerce Switch updated');
    } catch (err: any) {
      const message = err?.message || 'Failed to save Commerce Switch configuration';
      if (message.includes('CONFIG_VERSION_CONFLICT')) {
        toast.warning('Configuration changed elsewhere. Refreshing latest version…');
        clearCommerceSwitchCache();
        await load();
        return;
      }
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-sm text-slate-500">Loading Commerce Switch…</div>;
  }

  return (
    <div className="bg-white rounded-xl border p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Commerce Switch</h2>
        <p className="text-sm text-slate-500 mt-1">
          Select the active commerce model for new service bookings. Existing bookings keep their frozen mode.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-slate-700">Active commerce model</label>
        <select
          className="w-full border rounded-lg px-3 py-2 text-sm"
          value={activeModelId}
          onChange={(e) => setActiveModelId(e.target.value as CommerceModelId)}
        >
          {registeredModels.map((model) => (
            <option key={model.id} value={model.id}>
              {model.displayName}
              {model.status === 'experimental' ? ' (experimental)' : ''}
            </option>
          ))}
        </select>
        {registeredModels.find((m) => m.id === activeModelId)?.description ? (
          <p className="text-xs text-slate-500">
            {registeredModels.find((m) => m.id === activeModelId)?.description}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">Configuration version: {version}</p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-orange-600 text-white text-sm font-medium disabled:opacity-50"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save & propagate'}
        </button>
        <button
          type="button"
          className="px-4 py-2 rounded-lg border text-sm"
          onClick={() => {
            clearCommerceSwitchCache();
            void load();
          }}
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import {
  createPromoEnginePromotion,
  fetchPromoEngineDetail,
  fetchPromoEngineList,
  patchPromoEngineStatus,
  updatePromoEnginePromotion,
} from '@/lib/promo-engine/api-client';
import { newPromoEngineDraft } from '@/lib/promo-engine/local-store';
import { canTransition } from '@/lib/promo-engine/status';
import type { PromoEngineDraft, PromoEngineListItem, PromoEngineStatus } from '@/lib/promo-engine/types';
import { PromotionEngineList } from './PromotionEngineList';
import { PromotionEngineWizard } from './PromotionEngineWizard';

export function PromotionEngineHub() {
  const [rows, setRows] = useState<PromoEngineListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<PromoEngineDraft | null>(null);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [saving, setSaving] = useState(false);
  const [listFilters, setListFilters] = useState({ query: '', status: 'all', service: 'all' });

  const refresh = useCallback(async (filters = listFilters) => {
    setLoading(true);
    try {
      const list = await fetchPromoEngineList({
        status: filters.status,
        service: filters.service,
        q: filters.query,
      });
      setRows(list);
      setApiAvailable(true);
    } catch (err) {
      console.warn('[promo-engine] list failed', err);
      setApiAvailable(false);
      setRows([]);
      toast.error('Promotion Engine API unavailable — deploy Lambda with Phase 2 endpoints');
    } finally {
      setLoading(false);
    }
  }, [listFilters]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void refresh(listFilters);
    }, listFilters.query ? 350 : 0);
    return () => window.clearTimeout(handle);
  }, [listFilters, refresh]);

  const openCreate = () => {
    setEditing(newPromoEngineDraft());
    setWizardOpen(true);
  };

  const openEdit = async (id: string) => {
    try {
      const detail = await fetchPromoEngineDetail(id);
      setEditing(detail);
      setWizardOpen(true);
    } catch {
      toast.error('Failed to load promotion');
    }
  };

  const persist = async (draft: PromoEngineDraft): Promise<PromoEngineDraft> => {
    if (!apiAvailable) throw new Error('API unavailable');
    const exists = rows.some((r) => r.id === draft.id);
    return exists ? updatePromoEnginePromotion(draft) : createPromoEnginePromotion(draft);
  };

  const handleSave = async (draft: PromoEngineDraft) => {
    setSaving(true);
    try {
      await persist(draft);
      toast.success('Promotion saved');
      setWizardOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (draft: PromoEngineDraft) => {
    setSaving(true);
    try {
      const saved = await persist(draft);
      await patchPromoEngineStatus(saved.id, 'ACTIVE');
      toast.success('Promotion activated');
      setWizardOpen(false);
      setEditing(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Activate failed');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (id: string, status: PromoEngineStatus) => {
    const current = rows.find((d) => d.id === id);
    if (!current || !canTransition(current.status, status)) return;
    try {
      await patchPromoEngineStatus(id, status);
      toast.success(`Status set to ${status}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Promotion Engine</h2>
        <p className="mt-1 text-sm text-gray-500">
          Journey / visit rules, discount + cashback. Persisted via{' '}
          <code>/admin/promo-engine</code>
          {loading ? ' · loading…' : apiAvailable ? '' : ' · API offline'}.
        </p>
      </div>
      <PromotionEngineList
        rows={rows}
        loading={loading}
        onCreate={openCreate}
        onEdit={(id) => void openEdit(id)}
        onStatusChange={(id, status) => void handleStatus(id, status)}
        onFiltersChange={(next) => {
          setListFilters(next);
        }}
      />
      <PromotionEngineWizard
        open={wizardOpen}
        draft={editing}
        saving={saving}
        onClose={() => {
          setWizardOpen(false);
          setEditing(null);
        }}
        onSaveDraft={(d) => void handleSave(d)}
        onActivate={(d) => void handleActivate(d)}
      />
    </div>
  );
}

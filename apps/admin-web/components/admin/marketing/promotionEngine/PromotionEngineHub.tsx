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

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await fetchPromoEngineList();
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
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const handleSave = async (draft: PromoEngineDraft) => {
    try {
      const exists = rows.some((r) => r.id === draft.id);
      if (exists && apiAvailable) {
        await updatePromoEnginePromotion(draft);
      } else if (apiAvailable) {
        // Server assigns UUID — create then refresh
        await createPromoEnginePromotion(draft);
      } else {
        toast.error('API unavailable');
        return;
      }
      toast.success('Promotion saved');
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed');
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
        onCreate={openCreate}
        onEdit={(id) => void openEdit(id)}
        onStatusChange={(id, status) => void handleStatus(id, status)}
      />
      <PromotionEngineWizard
        open={wizardOpen}
        draft={editing}
        onClose={() => {
          setWizardOpen(false);
          setEditing(null);
        }}
        onSaveDraft={(d) => void handleSave(d)}
      />
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  draftsToListItems,
  loadPromoEngineDrafts,
  newPromoEngineDraft,
  upsertPromoEngineDraft,
} from '@/lib/promo-engine/local-store';
import { canTransition } from '@/lib/promo-engine/status';
import type { PromoEngineDraft, PromoEngineStatus } from '@/lib/promo-engine/types';
import { PromotionEngineList } from './PromotionEngineList';
import { PromotionEngineWizard } from './PromotionEngineWizard';

export function PromotionEngineHub() {
  const [drafts, setDrafts] = useState<PromoEngineDraft[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editing, setEditing] = useState<PromoEngineDraft | null>(null);

  useEffect(() => {
    setDrafts(loadPromoEngineDrafts());
  }, []);

  const rows = useMemo(() => draftsToListItems(drafts), [drafts]);

  const openCreate = () => {
    setEditing(newPromoEngineDraft());
    setWizardOpen(true);
  };

  const openEdit = (id: string) => {
    const found = drafts.find((d) => d.id === id) ?? null;
    setEditing(found);
    setWizardOpen(true);
  };

  const handleSave = (draft: PromoEngineDraft) => {
    setDrafts(upsertPromoEngineDraft(draft));
  };

  const handleStatus = (id: string, status: PromoEngineStatus) => {
    const current = drafts.find((d) => d.id === id);
    if (!current || !canTransition(current.status, status)) return;
    const next = { ...current, status, updatedAt: new Date().toISOString() };
    setDrafts(upsertPromoEngineDraft(next));
    toast.success(`Status set to ${status} (local only until Abhi PATCH /status)`);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Promotion Engine</h2>
        <p className="mt-1 text-sm text-gray-500">
          Journey / visit rules, discount + cashback. Phase 1: list + Basics wizard. Persistence is
          local until Abhi ships <code>/admin/promo-engine</code> CRUD.
        </p>
      </div>
      <PromotionEngineList
        rows={rows}
        onCreate={openCreate}
        onEdit={openEdit}
        onStatusChange={handleStatus}
      />
      <PromotionEngineWizard
        open={wizardOpen}
        draft={editing}
        onClose={() => {
          setWizardOpen(false);
          setEditing(null);
        }}
        onSaveDraft={handleSave}
      />
    </div>
  );
}

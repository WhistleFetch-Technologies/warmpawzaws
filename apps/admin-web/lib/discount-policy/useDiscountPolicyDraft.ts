'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clonePolicyBundle,
  CONTRACT_DEFAULT_POLICY,
  DRAFT_STORAGE_KEY,
} from './default-config';
import {
  fetchDraftPolicy,
  fetchPublishedPolicy,
  probePolicyApiCapabilities,
  saveDraftPolicy,
} from './discount-policy-api';
import type { DiscountPolicyBundle, PolicyApiCapabilities } from './types';

function loadLocalDraft(): DiscountPolicyBundle | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DiscountPolicyBundle;
  } catch {
    return null;
  }
}

function saveLocalDraft(bundle: DiscountPolicyBundle) {
  localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(bundle));
}

function clearLocalDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
}

function bundlesEqual(a: DiscountPolicyBundle, b: DiscountPolicyBundle): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function useDiscountPolicyDraft() {
  const [published, setPublished] = useState<DiscountPolicyBundle>(
    clonePolicyBundle(CONTRACT_DEFAULT_POLICY)
  );
  const [draft, setDraft] = useState<DiscountPolicyBundle>(
    clonePolicyBundle(CONTRACT_DEFAULT_POLICY)
  );
  const [capabilities, setCapabilities] = useState<PolicyApiCapabilities | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiDraft, setApiDraft] = useState(false);

  const isDirty = useMemo(() => !bundlesEqual(draft, published), [draft, published]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [caps, pub, remoteDraft] = await Promise.all([
        probePolicyApiCapabilities(),
        fetchPublishedPolicy(),
        fetchDraftPolicy(),
      ]);
      setCapabilities(caps);
      setPublished(pub);

      const local = loadLocalDraft();
      const initial = remoteDraft ?? local ?? pub;
      setDraft(clonePolicyBundle(initial));
      setApiDraft(Boolean(remoteDraft));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const updateDraft = useCallback((updater: (prev: DiscountPolicyBundle) => DiscountPolicyBundle) => {
    setDraft((prev) => updater(clonePolicyBundle(prev)));
  }, []);

  const saveDraft = useCallback(async () => {
    setSaving(true);
    try {
      const remoteOk = await saveDraftPolicy(draft);
      if (!remoteOk) {
        saveLocalDraft(draft);
      } else {
        setApiDraft(true);
        clearLocalDraft();
      }
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const resetDraft = useCallback(() => {
    setDraft(clonePolicyBundle(published));
    clearLocalDraft();
  }, [published]);

  const exportConfiguration = useCallback(() => {
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `discount-policy-draft-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [draft]);

  return {
    published,
    draft,
    capabilities,
    loading,
    saving,
    isDirty,
    apiDraft,
    updateDraft,
    saveDraft,
    resetDraft,
    reload: load,
    exportConfiguration,
  };
}

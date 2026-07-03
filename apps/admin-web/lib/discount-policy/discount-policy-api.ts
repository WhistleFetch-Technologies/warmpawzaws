/**
 * Discount policy API client — thin layer over future Phase 8 endpoints.
 * Falls back to contract defaults when APIs are unavailable.
 */
import { apiClient } from '@/lib/api-client';
import { CONTRACT_DEFAULT_POLICY, clonePolicyBundle } from './default-config';
import type {
  DiscountPolicyBundle,
  PolicyApiCapabilities,
  PolicyHistoryEntry,
  RuntimePolicyDiagnostics,
  ValidationResult,
} from './types';

const BASE = '/admin/discount-policy';

function emptyCapabilities(): PolicyApiCapabilities {
  return {
    runtimeRead: false,
    draftRead: false,
    draftWrite: false,
    validate: false,
    publish: false,
    rollback: false,
    history: false,
    simulate: false,
    audit: false,
  };
}

async function tryGet<T>(path: string): Promise<{ ok: true; data: T } | { ok: false }> {
  try {
    const data = await apiClient.get<T>(path);
    return { ok: true, data };
  } catch {
    return { ok: false };
  }
}

export async function probePolicyApiCapabilities(): Promise<PolicyApiCapabilities> {
  const caps = emptyCapabilities();
  const runtime = await tryGet<{ bundle: DiscountPolicyBundle }>(`${BASE}/runtime`);
  if (runtime.ok) caps.runtimeRead = true;
  const draft = await tryGet<{ bundle: DiscountPolicyBundle }>(`${BASE}/draft`);
  if (draft.ok) caps.draftRead = true;
  const validate = await tryGet<{ mode: string }>(`${BASE}/capabilities`);
  if (validate.ok) {
    const v = validate.data as PolicyApiCapabilities & { mode?: string };
    return { ...caps, ...v };
  }
  return caps;
}

export async function fetchPublishedPolicy(): Promise<DiscountPolicyBundle> {
  const res = await tryGet<{ bundle: DiscountPolicyBundle }>(`${BASE}/runtime`);
  if (res.ok && res.data.bundle) return res.data.bundle;
  return clonePolicyBundle(CONTRACT_DEFAULT_POLICY);
}

export async function fetchDraftPolicy(): Promise<DiscountPolicyBundle | null> {
  const res = await tryGet<{ bundle: DiscountPolicyBundle }>(`${BASE}/draft`);
  if (res.ok && res.data.bundle) return res.data.bundle;
  return null;
}

export async function saveDraftPolicy(bundle: DiscountPolicyBundle): Promise<boolean> {
  try {
    await apiClient.put(`${BASE}/draft`, { bundle });
    return true;
  } catch {
    return false;
  }
}

export async function validatePolicy(
  _bundle: DiscountPolicyBundle
): Promise<ValidationResult | null> {
  try {
    return await apiClient.post<ValidationResult>(`${BASE}/validate`, { bundle: _bundle });
  } catch {
    return null;
  }
}

export async function publishPolicy(_bundle: DiscountPolicyBundle): Promise<boolean> {
  try {
    await apiClient.post(`${BASE}/publish`, { bundle: _bundle });
    return true;
  } catch {
    return false;
  }
}

export async function rollbackPolicy(_publishId: string): Promise<boolean> {
  try {
    await apiClient.post(`${BASE}/rollback`, { publishId: _publishId });
    return true;
  } catch {
    return false;
  }
}

export async function fetchPolicyHistory(): Promise<PolicyHistoryEntry[] | null> {
  const res = await tryGet<{ history: PolicyHistoryEntry[] }>(`${BASE}/history`);
  if (res.ok) return res.data.history ?? [];
  return null;
}

export async function fetchRuntimeDiagnostics(): Promise<Partial<RuntimePolicyDiagnostics>> {
  const flags: Record<string, string> = {};

  const analytics = await tryGet<{ mode: string }>('/admin/analytics/discount-engine/mode');
  if (analytics.ok) flags.DISCOUNT_ENGINE_V2_ANALYTICS_MODE = analytics.data.mode;

  const campaign = await tryGet<{ mode: string }>('/admin/commercial-campaigns/mode');
  if (campaign.ok) flags.DISCOUNT_ENGINE_V2_CAMPAIGN_MODE = campaign.data.mode;

  const runtime = await tryGet<RuntimePolicyDiagnostics>(`${BASE}/runtime/diagnostics`);
  if (runtime.ok) {
    return { ...runtime.data, featureFlags: { ...flags, ...runtime.data.featureFlags } };
  }

  return {
    priorityVersion: CONTRACT_DEFAULT_POLICY.priority.version,
    stackVersion: CONTRACT_DEFAULT_POLICY.stack.version,
    fundingVersion: CONTRACT_DEFAULT_POLICY.funding.version,
    limitsVersion: CONTRACT_DEFAULT_POLICY.limits.version,
    policyFingerprint: null,
    publishId: null,
    publishedBy: null,
    publishedAt: null,
    status: 'unknown',
    featureFlags: flags,
  };
}

export async function simulatePolicy(_input: Record<string, unknown>): Promise<unknown | null> {
  try {
    return await apiClient.post(`${BASE}/simulate`, _input);
  } catch {
    return null;
  }
}

export async function fetchPolicyAudit(_filters?: Record<string, string>): Promise<unknown | null> {
  try {
    return await apiClient.get('/admin/discount-policy/audit');
  } catch {
    return null;
  }
}

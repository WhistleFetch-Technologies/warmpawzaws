import type { PromoEngineStatus } from './types';

export const ENGINE_STATUS_LABELS: Record<PromoEngineStatus, string> = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  EXPIRED: 'Expired',
  ARCHIVED: 'Archived',
};

export const ENGINE_STATUS_COLORS: Record<PromoEngineStatus, string> = {
  DRAFT: 'border-slate-200 bg-slate-50 text-slate-700',
  SCHEDULED: 'border-blue-200 bg-blue-50 text-blue-700',
  ACTIVE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  PAUSED: 'border-amber-200 bg-amber-50 text-amber-800',
  EXPIRED: 'border-gray-200 bg-gray-50 text-gray-600',
  ARCHIVED: 'border-gray-200 bg-gray-100 text-gray-500',
};

export const STATUS_TRANSITIONS: Record<PromoEngineStatus, PromoEngineStatus[]> = {
  DRAFT: ['SCHEDULED', 'ACTIVE', 'ARCHIVED'],
  SCHEDULED: ['ACTIVE', 'PAUSED', 'ARCHIVED'],
  ACTIVE: ['PAUSED', 'ARCHIVED'],
  PAUSED: ['ACTIVE', 'ARCHIVED'],
  EXPIRED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: PromoEngineStatus, to: PromoEngineStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

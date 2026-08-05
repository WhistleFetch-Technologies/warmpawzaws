import { resolveUnknownSpecializationFallback } from './fallback';
import { getSpecializationDetail } from './registry';
import type { SpecializationDetailContent, SpecializationResolveContext } from './types';

export function resolveSpecializationDetail(
  specializationId: string,
  context?: SpecializationResolveContext,
): SpecializationDetailContent {
  const hit = getSpecializationDetail(specializationId);
  if (hit) return hit;
  return resolveUnknownSpecializationFallback(specializationId, context);
}

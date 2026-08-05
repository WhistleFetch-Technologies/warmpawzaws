import {
  normalizeWapptHubCategory,
  WAPPT_HUB_CATEGORIES,
} from '../../../shared/wappt-policy.constants';
import {
  mapDbTierToApi,
  mapWapptRefundTierBodyToDb,
} from '../../../shared/wappt-refund-tier-mapper';
import {
  dbDeleteWapptPolicyTier,
  dbInsertEntityAuditLog,
  dbListWapptPolicyTiers,
  dbReplaceWapptPolicyTiers,
} from '../repos/wappt-policies-admin.repo';

export class WapptPoliciesAdminService {
  async listTiers(filters?: { policyScope?: 'platform' | 'category'; category?: string }) {
    const serviceCategory =
      filters?.category != null ? normalizeWapptHubCategory(filters.category) : undefined;
    const rows = await dbListWapptPolicyTiers({
      policyScope: filters?.policyScope,
      serviceCategory: serviceCategory ?? undefined,
    });
    return rows.map((r) => mapDbTierToApi(r as Record<string, unknown>));
  }

  async getPlatformDefaultTiers() {
    return this.listTiers({ policyScope: 'platform' });
  }

  async replacePlatformDefaultTiers(tiers: Record<string, unknown>[], actorId?: string | null) {
    const mapped = tiers.map((t) =>
      mapWapptRefundTierBodyToDb(t, { policyScope: 'platform' }),
    );
    const inserted = await dbReplaceWapptPolicyTiers('platform', mapped);
    await dbInsertEntityAuditLog({
      entityType: 'warmpawz_appointments_policy',
      entityId: 'platform-default',
      action: 'replace_platform_default',
      actorId,
      metadata: { count: inserted.length },
    });
    return inserted.map((r) => mapDbTierToApi(r as Record<string, unknown>));
  }

  async getCategoryTiers(category: string) {
    const slug = normalizeWapptHubCategory(category);
    if (!slug) throw new Error(`Invalid WAPPT category: ${category}`);
    return this.listTiers({ policyScope: 'category', category: slug });
  }

  async replaceCategoryTiers(
    category: string,
    tiers: Record<string, unknown>[],
    actorId?: string | null,
  ) {
    const slug = normalizeWapptHubCategory(category);
    if (!slug) throw new Error(`Invalid WAPPT category: ${category}`);
    const mapped = tiers.map((t) =>
      mapWapptRefundTierBodyToDb(t, { policyScope: 'category', serviceCategory: slug }),
    );
    const inserted = await dbReplaceWapptPolicyTiers('category', mapped, slug);
    await dbInsertEntityAuditLog({
      entityType: 'warmpawz_appointments_policy',
      entityId: slug,
      action: 'replace_category_override',
      actorId,
      metadata: { category: slug, count: inserted.length },
    });
    return inserted.map((r) => mapDbTierToApi(r as Record<string, unknown>));
  }

  async deleteTier(tierId: string, actorId?: string | null) {
    const deleted = await dbDeleteWapptPolicyTier(tierId);
    if (!deleted) return null;
    await dbInsertEntityAuditLog({
      entityType: 'warmpawz_appointments_policy',
      entityId: tierId,
      action: 'delete_tier',
      actorId,
    });
    return deleted;
  }

  listCategories() {
    return [...WAPPT_HUB_CATEGORIES];
  }
}

export const wapptPoliciesAdminService = new WapptPoliciesAdminService();

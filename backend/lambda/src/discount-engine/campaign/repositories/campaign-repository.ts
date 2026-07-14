import { insert, query, select } from '../../../database/rds-connection';
import {
  enrichAiReadyCampaignMetadata,
  resolveCampaignDiscountDomain,
  resolveCampaignSurface,
} from '../campaign-domain';
import type {
  CampaignAudit,
  CampaignDiscountDomain,
  CampaignPromotionLink,
  CommercialCampaignRecord,
} from '../types';

function mapRow(row: Record<string, unknown>): CommercialCampaignRecord {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const discountDomain = resolveCampaignDiscountDomain({
    discountDomain: row.discount_domain,
    surface: row.surface,
    metadata,
  });
  const surface = resolveCampaignSurface({
    surface: row.surface,
    discountDomain,
    metadata,
  });

  return {
    id: String(row.id),
    name: String(row.name),
    slug: row.slug != null ? String(row.slug) : null,
    campaignType: String(row.campaign_type),
    templateId: row.template_id != null ? String(row.template_id) : null,
    status: String(row.status) as CommercialCampaignRecord['status'],
    funding: {
      type: String(row.funding_type) as CommercialCampaignRecord['funding']['type'],
      split: row.funding_split as CommercialCampaignRecord['funding']['split'],
    },
    scheduleType: String(row.schedule_type) as CommercialCampaignRecord['scheduleType'],
    startAt: row.start_at ? new Date(String(row.start_at)).toISOString() : null,
    endAt: row.end_at ? new Date(String(row.end_at)).toISOString() : null,
    recurringRule: row.recurring_rule as CommercialCampaignRecord['recurringRule'],
    audience: (row.audience ?? {}) as CommercialCampaignRecord['audience'],
    notificationMode: String(row.notification_mode) as CommercialCampaignRecord['notificationMode'],
    notificationCampaignId:
      row.notification_campaign_id != null ? String(row.notification_campaign_id) : null,
    vendorId: row.vendor_id != null ? String(row.vendor_id) : null,
    version: Number(row.version ?? 1),
    discountDomain,
    surface,
    budgetCap: row.budget_cap != null ? Number(row.budget_cap) : null,
    budgetSpent: Number(row.budget_spent ?? 0),
    goal: row.goal != null ? String(row.goal) : null,
    objective: row.objective != null ? String(row.objective) : null,
    metadata,
    policyFingerprint: row.policy_fingerprint != null ? String(row.policy_fingerprint) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toDbRow(
  record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Record<string, unknown> {
  const metadata = enrichAiReadyCampaignMetadata(record);
  return {
    ...(record.id ? { id: record.id } : {}),
    name: record.name,
    slug: record.slug,
    campaign_type: record.campaignType,
    template_id: record.templateId,
    status: record.status,
    funding_type: record.funding.type,
    funding_split: record.funding.split ?? null,
    schedule_type: record.scheduleType,
    start_at: record.startAt,
    end_at: record.endAt,
    recurring_rule: record.recurringRule ?? null,
    audience: record.audience,
    notification_mode: record.notificationMode,
    notification_campaign_id: record.notificationCampaignId,
    vendor_id: record.vendorId,
    version: record.version,
    discount_domain: record.discountDomain,
    surface: record.surface,
    budget_cap: record.budgetCap ?? null,
    budget_spent: record.budgetSpent ?? 0,
    goal: record.goal ?? null,
    objective: record.objective ?? null,
    metadata,
    policy_fingerprint: record.policyFingerprint,
    updated_at: new Date().toISOString(),
  };
}

export interface CampaignListFilters {
  status?: string;
  vendorId?: string;
  discountDomain?: CampaignDiscountDomain;
  surface?: string;
}

export interface CampaignRepository {
  create(
    record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommercialCampaignRecord>;
  update(id: string, patch: Partial<CommercialCampaignRecord>): Promise<CommercialCampaignRecord | null>;
  findById(id: string): Promise<CommercialCampaignRecord | null>;
  list(filters?: CampaignListFilters): Promise<CommercialCampaignRecord[]>;
  addLink(link: Omit<CampaignPromotionLink, 'id'>): Promise<CampaignPromotionLink>;
  detachLink(campaignId: string, opts: { promotionId?: string; couponId?: string }): Promise<boolean>;
  getLinks(campaignId: string, opts?: { includeInactive?: boolean }): Promise<CampaignPromotionLink[]>;
  saveAudit(campaignId: string, audit: CampaignAudit): Promise<void>;
}

function mapLink(row: Record<string, unknown>): CampaignPromotionLink {
  return {
    id: String(row.id),
    campaignId: String(row.campaign_id),
    promotionId: row.promotion_id != null ? String(row.promotion_id) : null,
    couponId: row.coupon_id != null ? String(row.coupon_id) : null,
    linkType: String(row.link_type) as CampaignPromotionLink['linkType'],
    isActive: row.is_active === undefined ? true : Boolean(row.is_active),
  };
}

export class RdsCampaignRepository implements CampaignRepository {
  async create(
    record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommercialCampaignRecord> {
    const payload = toDbRow(record);
    try {
      const rows = await insert('commercial_discount_campaigns', payload);
      return mapRow(rows[0] as Record<string, unknown>);
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes('discount_domain') || msg.includes('budget_cap') || msg.includes('surface')) {
        // Pre-migration fallback — keep metadata only
        delete payload.discount_domain;
        delete payload.surface;
        delete payload.budget_cap;
        delete payload.budget_spent;
        delete payload.goal;
        delete payload.objective;
        const rows = await insert('commercial_discount_campaigns', payload);
        return mapRow(rows[0] as Record<string, unknown>);
      }
      throw err;
    }
  }

  async update(
    id: string,
    patch: Partial<CommercialCampaignRecord>
  ): Promise<CommercialCampaignRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, id: existing.id };
    const metadata = enrichAiReadyCampaignMetadata(merged);
    try {
      const result = await query(
        `UPDATE commercial_discount_campaigns SET
          name = $2, slug = $3, campaign_type = $4, template_id = $5, status = $6,
          funding_type = $7, funding_split = $8, schedule_type = $9,
          start_at = $10, end_at = $11, recurring_rule = $12, audience = $13,
          notification_mode = $14, notification_campaign_id = $15, vendor_id = $16,
          version = $17, metadata = $18, policy_fingerprint = $19,
          discount_domain = $20, surface = $21, budget_cap = $22, budget_spent = $23,
          goal = $24, objective = $25, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
        [
          id,
          merged.name,
          merged.slug,
          merged.campaignType,
          merged.templateId,
          merged.status,
          merged.funding.type,
          merged.funding.split ?? null,
          merged.scheduleType,
          merged.startAt,
          merged.endAt,
          merged.recurringRule ?? null,
          JSON.stringify(merged.audience),
          merged.notificationMode,
          merged.notificationCampaignId,
          merged.vendorId,
          merged.version,
          JSON.stringify(metadata),
          merged.policyFingerprint,
          merged.discountDomain,
          merged.surface,
          merged.budgetCap ?? null,
          merged.budgetSpent ?? 0,
          merged.goal ?? null,
          merged.objective ?? null,
        ]
      );
      const rows = Array.isArray(result) ? result : result.rows ?? [];
      if (!rows.length) return null;
      return mapRow(rows[0] as Record<string, unknown>);
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes('discount_domain') || msg.includes('budget_cap') || msg.includes('column')) {
        const result = await query(
          `UPDATE commercial_discount_campaigns SET
            name = $2, slug = $3, campaign_type = $4, template_id = $5, status = $6,
            funding_type = $7, funding_split = $8, schedule_type = $9,
            start_at = $10, end_at = $11, recurring_rule = $12, audience = $13,
            notification_mode = $14, notification_campaign_id = $15, vendor_id = $16,
            version = $17, metadata = $18, policy_fingerprint = $19, updated_at = NOW()
          WHERE id = $1 RETURNING *`,
          [
            id,
            merged.name,
            merged.slug,
            merged.campaignType,
            merged.templateId,
            merged.status,
            merged.funding.type,
            merged.funding.split ?? null,
            merged.scheduleType,
            merged.startAt,
            merged.endAt,
            merged.recurringRule ?? null,
            JSON.stringify(merged.audience),
            merged.notificationMode,
            merged.notificationCampaignId,
            merged.vendorId,
            merged.version,
            JSON.stringify(metadata),
            merged.policyFingerprint,
          ]
        );
        const rows = Array.isArray(result) ? result : result.rows ?? [];
        if (!rows.length) return null;
        return mapRow(rows[0] as Record<string, unknown>);
      }
      throw err;
    }
  }

  async findById(id: string): Promise<CommercialCampaignRecord | null> {
    const rows = await select('commercial_discount_campaigns', { id });
    if (!rows.length) return null;
    return mapRow(rows[0] as Record<string, unknown>);
  }

  async list(filters: CampaignListFilters = {}): Promise<CommercialCampaignRecord[]> {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filters.status) {
      params.push(filters.status);
      clauses.push(`status = $${params.length}`);
    }
    if (filters.vendorId) {
      params.push(filters.vendorId);
      clauses.push(`vendor_id = $${params.length}`);
    }
    if (filters.discountDomain) {
      params.push(filters.discountDomain);
      const i = params.length;
      // Column match OR legacy metadata (nullable column before/during backfill)
      clauses.push(`(
        UPPER(COALESCE(discount_domain, '')) = $${i}
        OR (
          (discount_domain IS NULL OR TRIM(COALESCE(discount_domain, '')) = '')
          AND (
            UPPER(COALESCE(metadata->>'discount_domain', '')) = $${i}
            OR UPPER(COALESCE(metadata->>'domain', '')) IN ($${i}, CASE WHEN $${i} = 'ECOMMERCE' THEN 'PRODUCT' ELSE 'SERVICE' END)
            OR LOWER(COALESCE(metadata->>'surface', '')) = CASE WHEN $${i} = 'ECOMMERCE' THEN 'ecommerce' ELSE 'marketing' END
          )
        )
      )`);
    }
    if (filters.surface) {
      params.push(String(filters.surface).toLowerCase());
      clauses.push(`(
        LOWER(COALESCE(surface, '')) = $${params.length}
        OR (
          (surface IS NULL OR TRIM(COALESCE(surface, '')) = '')
          AND LOWER(COALESCE(metadata->>'surface', '')) = $${params.length}
        )
      )`);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM commercial_discount_campaigns ${where} ORDER BY created_at DESC`,
      params
    );
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    let mapped = rows.map((r: unknown) => mapRow(r as Record<string, unknown>));
    if (filters.discountDomain) {
      mapped = mapped.filter((c) => c.discountDomain === filters.discountDomain);
    }
    return mapped;
  }

  async addLink(link: Omit<CampaignPromotionLink, 'id'>): Promise<CampaignPromotionLink> {
    const payload: Record<string, unknown> = {
      campaign_id: link.campaignId,
      promotion_id: link.promotionId ?? null,
      coupon_id: link.couponId ?? null,
      link_type: link.linkType,
      is_active: link.isActive !== false,
    };
    try {
      const rows = await insert('commercial_campaign_promotion_links', payload);
      return mapLink(rows[0] as Record<string, unknown>);
    } catch (err: unknown) {
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes('is_active')) {
        delete payload.is_active;
        const rows = await insert('commercial_campaign_promotion_links', payload);
        return mapLink(rows[0] as Record<string, unknown>);
      }
      throw err;
    }
  }

  async detachLink(
    campaignId: string,
    opts: { promotionId?: string; couponId?: string }
  ): Promise<boolean> {
    if (opts.promotionId) {
      try {
        const result = await query(
          `UPDATE commercial_campaign_promotion_links
           SET is_active = false
           WHERE campaign_id = $1 AND promotion_id = $2
           RETURNING id`,
          [campaignId, opts.promotionId]
        );
        const rows = Array.isArray(result) ? result : result.rows ?? [];
        if (rows.length) return true;
      } catch {
        /* fall through to delete */
      }
      const del = await query(
        `DELETE FROM commercial_campaign_promotion_links
         WHERE campaign_id = $1 AND promotion_id = $2 RETURNING id`,
        [campaignId, opts.promotionId]
      );
      const rows = Array.isArray(del) ? del : del.rows ?? [];
      return rows.length > 0;
    }
    if (opts.couponId) {
      try {
        const result = await query(
          `UPDATE commercial_campaign_promotion_links
           SET is_active = false
           WHERE campaign_id = $1 AND coupon_id = $2
           RETURNING id`,
          [campaignId, opts.couponId]
        );
        const rows = Array.isArray(result) ? result : result.rows ?? [];
        if (rows.length) return true;
      } catch {
        /* fall through */
      }
      const del = await query(
        `DELETE FROM commercial_campaign_promotion_links
         WHERE campaign_id = $1 AND coupon_id = $2 RETURNING id`,
        [campaignId, opts.couponId]
      );
      const rows = Array.isArray(del) ? del : del.rows ?? [];
      return rows.length > 0;
    }
    return false;
  }

  async getLinks(
    campaignId: string,
    opts: { includeInactive?: boolean } = {}
  ): Promise<CampaignPromotionLink[]> {
    const rows = await select('commercial_campaign_promotion_links', { campaign_id: campaignId });
    let links = rows.map((row: unknown) => mapLink(row as Record<string, unknown>));
    if (!opts.includeInactive) {
      links = links.filter((l) => l.isActive !== false);
    }
    return links;
  }

  async saveAudit(campaignId: string, audit: CampaignAudit): Promise<void> {
    await insert('commercial_campaign_audit_log', {
      campaign_id: campaignId,
      audit: audit as unknown as Record<string, unknown>,
    });
  }
}

/** In-memory repository for unit tests. */
export class InMemoryCampaignRepository implements CampaignRepository {
  private campaigns = new Map<string, CommercialCampaignRecord>();
  private links = new Map<string, CampaignPromotionLink[]>();
  private audits: Array<{ campaignId: string; audit: CampaignAudit }> = [];
  private seq = 1;

  async create(
    record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommercialCampaignRecord> {
    const id = `camp-${this.seq++}`;
    const now = new Date().toISOString();
    const full: CommercialCampaignRecord = { ...record, id, createdAt: now, updatedAt: now };
    this.campaigns.set(id, full);
    this.links.set(id, []);
    return full;
  }

  async update(
    id: string,
    patch: Partial<CommercialCampaignRecord>
  ): Promise<CommercialCampaignRecord | null> {
    const existing = this.campaigns.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.campaigns.set(id, updated);
    return updated;
  }

  async findById(id: string): Promise<CommercialCampaignRecord | null> {
    return this.campaigns.get(id) ?? null;
  }

  async list(filters: CampaignListFilters = {}): Promise<CommercialCampaignRecord[]> {
    return Array.from(this.campaigns.values()).filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.vendorId && c.vendorId !== filters.vendorId) return false;
      if (filters.discountDomain && c.discountDomain !== filters.discountDomain) return false;
      if (filters.surface && c.surface !== filters.surface) return false;
      return true;
    });
  }

  async addLink(link: Omit<CampaignPromotionLink, 'id'>): Promise<CampaignPromotionLink> {
    const full: CampaignPromotionLink = {
      ...link,
      id: `link-${this.seq++}`,
      isActive: link.isActive !== false,
    };
    const list = this.links.get(link.campaignId) ?? [];
    list.push(full);
    this.links.set(link.campaignId, list);
    return full;
  }

  async detachLink(
    campaignId: string,
    opts: { promotionId?: string; couponId?: string }
  ): Promise<boolean> {
    const list = this.links.get(campaignId) ?? [];
    let changed = false;
    for (const link of list) {
      if (opts.promotionId && link.promotionId === opts.promotionId) {
        link.isActive = false;
        changed = true;
      }
      if (opts.couponId && link.couponId === opts.couponId) {
        link.isActive = false;
        changed = true;
      }
    }
    return changed;
  }

  async getLinks(
    campaignId: string,
    opts: { includeInactive?: boolean } = {}
  ): Promise<CampaignPromotionLink[]> {
    const list = this.links.get(campaignId) ?? [];
    if (opts.includeInactive) return list;
    return list.filter((l) => l.isActive !== false);
  }

  async saveAudit(campaignId: string, audit: CampaignAudit): Promise<void> {
    this.audits.push({ campaignId, audit });
  }

  getAudits(): Array<{ campaignId: string; audit: CampaignAudit }> {
    return this.audits;
  }
}

let defaultRepo: CampaignRepository | null = null;

export function getCampaignRepository(): CampaignRepository {
  if (!defaultRepo) defaultRepo = new RdsCampaignRepository();
  return defaultRepo;
}

export function setCampaignRepository(repo: CampaignRepository): void {
  defaultRepo = repo;
}

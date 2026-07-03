import { insert, query, select } from '../../../database/rds-connection';
import type {
  CampaignAudit,
  CampaignPromotionLink,
  CommercialCampaignRecord,
} from '../types';

function mapRow(row: Record<string, unknown>): CommercialCampaignRecord {
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
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    policyFingerprint: row.policy_fingerprint != null ? String(row.policy_fingerprint) : null,
    createdAt: new Date(String(row.created_at)).toISOString(),
    updatedAt: new Date(String(row.updated_at)).toISOString(),
  };
}

function toDbRow(
  record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
): Record<string, unknown> {
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
    metadata: record.metadata,
    policy_fingerprint: record.policyFingerprint,
    updated_at: new Date().toISOString(),
  };
}

export interface CampaignRepository {
  create(
    record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommercialCampaignRecord>;
  update(id: string, patch: Partial<CommercialCampaignRecord>): Promise<CommercialCampaignRecord | null>;
  findById(id: string): Promise<CommercialCampaignRecord | null>;
  list(filters?: { status?: string; vendorId?: string }): Promise<CommercialCampaignRecord[]>;
  addLink(link: Omit<CampaignPromotionLink, 'id'>): Promise<CampaignPromotionLink>;
  getLinks(campaignId: string): Promise<CampaignPromotionLink[]>;
  saveAudit(campaignId: string, audit: CampaignAudit): Promise<void>;
}

export class RdsCampaignRepository implements CampaignRepository {
  async create(
    record: Omit<CommercialCampaignRecord, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CommercialCampaignRecord> {
    const rows = await insert('commercial_discount_campaigns', toDbRow(record));
    return mapRow(rows[0] as Record<string, unknown>);
  }

  async update(
    id: string,
    patch: Partial<CommercialCampaignRecord>
  ): Promise<CommercialCampaignRecord | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    const merged = { ...existing, ...patch, id: existing.id };
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
        JSON.stringify(merged.metadata),
        merged.policyFingerprint,
      ]
    );
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    if (!rows.length) return null;
    return mapRow(rows[0] as Record<string, unknown>);
  }

  async findById(id: string): Promise<CommercialCampaignRecord | null> {
    const rows = await select('commercial_discount_campaigns', { id });
    if (!rows.length) return null;
    return mapRow(rows[0] as Record<string, unknown>);
  }

  async list(filters: { status?: string; vendorId?: string } = {}): Promise<CommercialCampaignRecord[]> {
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
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const result = await query(
      `SELECT * FROM commercial_discount_campaigns ${where} ORDER BY created_at DESC`,
      params
    );
    const rows = Array.isArray(result) ? result : result.rows ?? [];
    return rows.map((r: unknown) => mapRow(r as Record<string, unknown>));
  }

  async addLink(link: Omit<CampaignPromotionLink, 'id'>): Promise<CampaignPromotionLink> {
    const rows = await insert('commercial_campaign_promotion_links', {
      campaign_id: link.campaignId,
      promotion_id: link.promotionId ?? null,
      coupon_id: link.couponId ?? null,
      link_type: link.linkType,
    });
    const row = rows[0] as Record<string, unknown>;
    return {
      id: String(row.id),
      campaignId: String(row.campaign_id),
      promotionId: row.promotion_id != null ? String(row.promotion_id) : null,
      couponId: row.coupon_id != null ? String(row.coupon_id) : null,
      linkType: String(row.link_type) as CampaignPromotionLink['linkType'],
    };
  }

  async getLinks(campaignId: string): Promise<CampaignPromotionLink[]> {
    const rows = await select('commercial_campaign_promotion_links', { campaign_id: campaignId });
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        campaignId: String(r.campaign_id),
        promotionId: r.promotion_id != null ? String(r.promotion_id) : null,
        couponId: r.coupon_id != null ? String(r.coupon_id) : null,
        linkType: String(r.link_type) as CampaignPromotionLink['linkType'],
      };
    });
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

  async list(filters: { status?: string; vendorId?: string } = {}): Promise<CommercialCampaignRecord[]> {
    return Array.from(this.campaigns.values()).filter((c) => {
      if (filters.status && c.status !== filters.status) return false;
      if (filters.vendorId && c.vendorId !== filters.vendorId) return false;
      return true;
    });
  }

  async addLink(link: Omit<CampaignPromotionLink, 'id'>): Promise<CampaignPromotionLink> {
    const full: CampaignPromotionLink = { ...link, id: `link-${this.seq++}` };
    const list = this.links.get(link.campaignId) ?? [];
    list.push(full);
    this.links.set(link.campaignId, list);
    return full;
  }

  async getLinks(campaignId: string): Promise<CampaignPromotionLink[]> {
    return this.links.get(campaignId) ?? [];
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

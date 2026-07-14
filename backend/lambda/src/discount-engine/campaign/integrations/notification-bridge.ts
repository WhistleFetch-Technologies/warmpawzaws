import type { CommercialCampaignRecord } from '../types';

export interface NotificationBridgeResult {
  linked: boolean;
  notificationCampaignId?: string | null;
  mode: 'skip' | 'create' | 'link';
  message: string;
  created?: boolean;
}

/**
 * Integrates with existing Notification Campaign Engine — no duplicate engine.
 * - skip: no-op
 * - link: require existing notification_campaign_id
 * - create: inserts a draft row into notification_campaigns when table exists
 */
export async function linkNotificationCampaign(
  campaign: CommercialCampaignRecord
): Promise<NotificationBridgeResult> {
  if (campaign.notificationMode === 'skip') {
    return { linked: false, mode: 'skip', message: 'Notification skipped by campaign policy' };
  }

  if (campaign.notificationMode === 'link') {
    if (!campaign.notificationCampaignId) {
      return {
        linked: false,
        mode: 'link',
        message: 'notification_campaign_id required for link mode',
      };
    }
    return {
      linked: true,
      notificationCampaignId: campaign.notificationCampaignId,
      mode: 'link',
      message: 'Linked to existing notification campaign',
    };
  }

  // create mode — attempt Notification Engine table insert (best-effort)
  try {
    const { insert } = await import('../../../database/rds-connection');
    const rows = await insert('notification_campaigns', {
      name: `${campaign.name} — push`,
      status: 'draft',
      channel: 'push',
      audience: campaign.audience,
      metadata: {
        commercialCampaignId: campaign.id,
        discount_domain: campaign.discountDomain,
        surface: campaign.surface,
        source: 'commercial_campaign_engine',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    const created = rows[0] as Record<string, unknown>;
    const id = created?.id != null ? String(created.id) : null;
    if (!id) {
      return {
        linked: false,
        mode: 'create',
        created: false,
        message: 'Notification campaign insert returned no id',
      };
    }
    return {
      linked: true,
      notificationCampaignId: id,
      mode: 'create',
      created: true,
      message: 'Created draft notification campaign linked to commercial campaign',
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      linked: false,
      mode: 'create',
      created: false,
      message: `Notification create deferred — ${message}`,
    };
  }
}

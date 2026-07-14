import { query } from '../../database/rds-connection';
import type { CommercialCampaignRecord } from './types';

/**
 * Resolves vendor/seller IDs that should be notified when enrolled in a campaign.
 */
export function resolveParticipantVendorIds(
  campaign: CommercialCampaignRecord,
  extraVendorIds: string[] = []
): string[] {
  const ids = new Set<string>();
  if (campaign.vendorId) ids.add(String(campaign.vendorId));
  if (campaign.audience?.vendorId) ids.add(String(campaign.audience.vendorId));

  const meta = campaign.metadata ?? {};
  const fromMeta = meta.participantVendorIds ?? meta.vendorIds ?? meta.sellerIds;
  if (Array.isArray(fromMeta)) {
    for (const id of fromMeta) {
      if (id != null && String(id).trim()) ids.add(String(id));
    }
  }
  const audienceVendorIds = campaign.audience?.metadata?.vendorIds;
  if (Array.isArray(audienceVendorIds)) {
    for (const id of audienceVendorIds) {
      if (id != null && String(id).trim()) ids.add(String(id));
    }
  }

  for (const id of extraVendorIds) {
    if (id != null && String(id).trim()) ids.add(String(id));
  }

  return [...ids];
}

function enrollmentMessage(campaign: CommercialCampaignRecord): { title: string; message: string } {
  const name = campaign.name || 'a campaign';
  if (campaign.discountDomain === 'ECOMMERCE') {
    return {
      title: 'Products enrolled in campaign',
      message: `Your products are now part of the ${name}.`,
    };
  }
  return {
    title: 'Enrolled in campaign',
    message: `You've been enrolled in the ${name}.`,
  };
}

/**
 * In-app vendor notification via existing `notifications` table.
 * Reuses Notification Engine inbox — does not create a parallel system.
 */
export async function notifyCampaignEnrollment(
  campaign: CommercialCampaignRecord,
  extraVendorIds: string[] = []
): Promise<{ notified: string[]; skipped: boolean }> {
  const vendorIds = resolveParticipantVendorIds(campaign, extraVendorIds);
  if (!vendorIds.length) return { notified: [], skipped: true };

  const { title, message } = enrollmentMessage(campaign);
  const notified: string[] = [];

  for (const vendorId of vendorIds) {
    try {
      await query(
        `INSERT INTO notifications (recipient_id, recipient_type, notification_type, title, message, channels, is_read, metadata)
         VALUES ($1, 'vendor', 'campaign_enrollment', $2, $3, $4, false, $5)`,
        [
          vendorId,
          title,
          message,
          JSON.stringify({ email: false, sms: false, inApp: true, push: false }),
          JSON.stringify({
            commercialCampaignId: campaign.id,
            campaignName: campaign.name,
            discount_domain: campaign.discountDomain,
            surface: campaign.surface,
            source: 'commercial_campaign_engine',
          }),
        ]
      );
      notified.push(vendorId);
    } catch (err) {
      // metadata column may not exist on older schemas — retry without it
      try {
        await query(
          `INSERT INTO notifications (recipient_id, recipient_type, notification_type, title, message, channels, is_read)
           VALUES ($1, 'vendor', 'campaign_enrollment', $2, $3, $4, false)`,
          [
            vendorId,
            title,
            message,
            JSON.stringify({ email: false, sms: false, inApp: true, push: false }),
          ]
        );
        notified.push(vendorId);
      } catch (inner) {
        console.warn(
          '[campaign-enrollment-notify] failed for',
          vendorId,
          inner instanceof Error ? inner.message : inner
        );
      }
    }
  }

  return { notified, skipped: false };
}

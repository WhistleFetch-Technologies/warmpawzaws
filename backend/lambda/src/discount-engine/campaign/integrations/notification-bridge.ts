import type { CommercialCampaignRecord } from '../types';

export interface NotificationBridgeResult {
  linked: boolean;
  notificationCampaignId?: string | null;
  mode: 'skip' | 'create' | 'link';
  message: string;
}

/**
 * Links to existing Notification Campaign Engine — does not create push campaigns in Phase 10.
 * AUTHORITATIVE mode stores notification_campaign_id when provided.
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

  // create mode — deferred to Notification Engine API; metadata only in Phase 10
  return {
    linked: false,
    mode: 'create',
    message: 'Push campaign creation delegated to Notification Engine (not invoked in orchestration stub)',
  };
}

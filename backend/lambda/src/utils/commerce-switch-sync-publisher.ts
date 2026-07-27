/**
 * Publishes a silent FCM data message when Commerce Switch configuration changes.
 * Non-fatal — admin save succeeds even if Firebase is unavailable.
 */
import { sendSilentDataPushToTopic } from '../utils/firebase-client';

/** Keep in sync with packages/commerce-switch-contracts/src/sync.ts */
export const COMMERCE_SWITCH_FCM_TOPIC = 'all_customers';
export const COMMERCE_SWITCH_SYNC_EVENT_TYPE = 'commerce_switch_updated';

export type CommerceSwitchPublishInput = {
  version: number;
  activeModelId: string;
  updatedAt: string;
};

export async function publishCommerceSwitchConfigurationUpdate(
  config: CommerceSwitchPublishInput
): Promise<void> {
  const data: Record<string, string> = {
    type: COMMERCE_SWITCH_SYNC_EVENT_TYPE,
    configurationVersion: String(config.version),
    activeModelId: config.activeModelId,
    updatedAt: config.updatedAt,
  };

  const result = await sendSilentDataPushToTopic(COMMERCE_SWITCH_FCM_TOPIC, data);
  if (!result.success) {
    console.warn('[CommerceSwitch] silent FCM publish failed (non-fatal):', result.error);
    return;
  }

  console.log(
    JSON.stringify({
      event: 'commerce_switch_sync_published',
      topic: COMMERCE_SWITCH_FCM_TOPIC,
      version: config.version,
      activeModelId: config.activeModelId,
      messageId: result.messageId,
    })
  );
}

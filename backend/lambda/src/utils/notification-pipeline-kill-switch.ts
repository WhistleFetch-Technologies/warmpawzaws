/**
 * Emergency master kill switch for the notification pipeline.
 * Set NOTIFICATION_PIPELINE_MASTER_DISABLED = false and redeploy to restore delivery.
 */

/** EMERGENCY: true halts all notification spend (cron + event-triggered + campaigns). */
export const NOTIFICATION_PIPELINE_MASTER_DISABLED = true;

export function isNotificationPipelineEnabled(): boolean {
  return !NOTIFICATION_PIPELINE_MASTER_DISABLED;
}

export function cronPipelineSkippedPayload() {
  return {
    success: true,
    skipped: true,
    reason: 'notification_pipeline_disabled',
    processed: 0,
    sent: 0,
    failed: 0,
    errors: [] as string[],
  };
}

export function campaignPipelineDisabledResult(): {
  status: 'FAILED';
  estimatedRecipients: number;
  sentRecipients: number;
  failedRecipients: number;
  pushSuccessCount: number;
  pushFailureCount: number;
  errors: string[];
} {
  return {
    status: 'FAILED',
    estimatedRecipients: 0,
    sentRecipients: 0,
    failedRecipients: 0,
    pushSuccessCount: 0,
    pushFailureCount: 0,
    errors: ['pipeline_disabled'],
  };
}

export function dispatchPipelineDisabledResult() {
  return {
    inboxOk: false,
    skippedDuplicate: false,
    pushSent: 0,
    pushFailed: 0,
    tokensDeactivated: 0,
    pushSkippedReason: 'pipeline_disabled',
  };
}

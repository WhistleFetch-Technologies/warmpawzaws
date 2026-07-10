/**
 * Notification pipeline controls.
 * - NOTIFICATION_PIPELINE_MASTER_DISABLED: emergency halt for all delivery (event + cron).
 * - NOTIFICATION_CRON_ENDPOINTS_DISABLED: permanent off for polled cron HTTP endpoints.
 */

/** Set true only for emergency full halt. Event-only surface keeps this false. */
export const NOTIFICATION_PIPELINE_MASTER_DISABLED = false;

/** Polled notification crons stay off; triggered events use dispatchNotification. */
export const NOTIFICATION_CRON_ENDPOINTS_DISABLED = true;

export function isNotificationPipelineEnabled(): boolean {
  return !NOTIFICATION_PIPELINE_MASTER_DISABLED;
}

export function isNotificationCronEnabled(): boolean {
  return !NOTIFICATION_CRON_ENDPOINTS_DISABLED;
}

export function cronPipelineSkippedPayload(reason = 'notification_cron_disabled') {
  return {
    success: true,
    skipped: true,
    reason,
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

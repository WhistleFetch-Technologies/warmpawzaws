import {
  NOTIFICATION_CRON_ENDPOINTS_DISABLED,
  NOTIFICATION_PIPELINE_MASTER_DISABLED,
  campaignPipelineDisabledResult,
  cronPipelineSkippedPayload,
  dispatchPipelineDisabledResult,
  isNotificationCronEnabled,
  isNotificationPipelineEnabled,
} from '../notification-pipeline-kill-switch';

jest.mock('../../database/rds-connection', () => ({
  insert: jest.fn().mockResolvedValue([{ id: 'notif-1' }]),
  query: jest.fn().mockResolvedValue({ rows: [] }),
  update: jest.fn(),
}));

jest.mock('../firebase-client', () => ({
  classifyFcmError: jest.fn(),
  deactivateDeviceTokens: jest.fn(),
  sendPushToMultipleDevices: jest.fn().mockResolvedValue({ successCount: 1, failureCount: 0 }),
}));

jest.mock('../notification-delivery', () => ({
  ensureDeliveryLogEntries: jest.fn().mockResolvedValue(undefined),
  finalizeInAppDelivery: jest.fn().mockResolvedValue(undefined),
  markChannelDeliveryFailed: jest.fn().mockResolvedValue(undefined),
  resolveChannelsFromRequest: jest.fn().mockResolvedValue(['in_app', 'push']),
  transitionNotificationDelivery: jest.fn(),
}));

jest.mock('../notification-deep-links', () => ({
  resolveNotificationDeepLink: jest.fn(() => 'warmpawz://home'),
}));

jest.mock('../customer-notification-settings', () => ({
  fetchCustomerNotificationSettings: jest.fn(),
}));

jest.mock('../notification-campaign-audience', () => ({
  buildAudienceFiltersPayload: jest.fn(),
  resolveCampaignRecipientIds: jest.fn(),
}));

jest.mock('../notification-campaign-targeting', () => ({
  loadCampaignTargeting: jest.fn(),
}));

describe('notification-pipeline-kill-switch', () => {
  it('keeps master pipeline enabled for triggered events', () => {
    expect(NOTIFICATION_PIPELINE_MASTER_DISABLED).toBe(false);
    expect(isNotificationPipelineEnabled()).toBe(true);
  });

  it('keeps notification crons permanently disabled', () => {
    expect(NOTIFICATION_CRON_ENDPOINTS_DISABLED).toBe(true);
    expect(isNotificationCronEnabled()).toBe(false);
  });

  it('returns cron skip payload shape', () => {
    expect(cronPipelineSkippedPayload()).toEqual({
      success: true,
      skipped: true,
      reason: 'notification_cron_disabled',
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
    });
  });

  it('returns campaign disabled result shape', () => {
    expect(campaignPipelineDisabledResult()).toMatchObject({
      status: 'FAILED',
      sentRecipients: 0,
      errors: ['pipeline_disabled'],
    });
  });

  it('returns dispatch disabled result shape', () => {
    expect(dispatchPipelineDisabledResult()).toMatchObject({
      inboxOk: false,
      pushSkippedReason: 'pipeline_disabled',
    });
  });
});

describe('dispatchNotification when pipeline enabled', () => {
  it('attempts delivery for triggered events', async () => {
    const { insert } = await import('../../database/rds-connection');
    const { dispatchNotification } = await import('../notification-dispatch');

    const result = await dispatchNotification({
      recipientId: 'user-1',
      recipientType: 'customer',
      notificationType: 'booking_confirmed',
      title: 'Test',
      message: 'Body',
      channels: { inApp: true, push: false },
    });

    expect(result.pushSkippedReason).not.toBe('pipeline_disabled');
    expect(insert).toHaveBeenCalled();
  });
});

describe('scheduled-notification-drain when crons disabled at HTTP layer', () => {
  it('processDueScheduledNotifications can run when pipeline enabled', async () => {
    const { query } = await import('../../database/rds-connection');
    const { processDueScheduledNotifications } = await import('../scheduled-notification-drain');

    (query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const scheduled = await processDueScheduledNotifications();

    expect(scheduled).toMatchObject({ processed: 0, sent: 0, failed: 0 });
    expect(query).toHaveBeenCalled();
  });
});

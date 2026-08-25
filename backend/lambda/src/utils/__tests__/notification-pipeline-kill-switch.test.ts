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
  transitionNotificationDelivery: jest.fn().mockResolvedValue(undefined),
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
  beforeEach(() => {
    jest.resetModules();
  });

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

  it('retries push when duplicate inbox exists but push never sent', async () => {
    const { query } = await import('../../database/rds-connection');
    const { sendPushToMultipleDevices } = await import('../firebase-client');
    const { fetchCustomerNotificationSettings } = await import('../customer-notification-settings');
    const { dispatchNotification } = await import('../notification-dispatch');

    (fetchCustomerNotificationSettings as jest.Mock).mockResolvedValue({
      push: true,
      bookingUpdates: true,
      promotions: true,
    });

    (query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes('FROM notifications')) {
        return { rows: [{ id: 'existing-notif-1' }] };
      }
      if (sql.includes('notification_delivery_log')) {
        return { rows: [{ status: 'failed' }] };
      }
      if (sql.includes('device_tokens')) {
        return { rows: [{ fcm_token: 'token-a' }] };
      }
      if (sql.includes('notification_channel_settings')) {
        return { rows: [{ push_enabled: true }] };
      }
      if (sql.includes('preferences FROM customers')) {
        return { rows: [{ preferences: {} }] };
      }
      return { rows: [] };
    });

    (sendPushToMultipleDevices as jest.Mock).mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      results: [{ success: true }],
    });

    const result = await dispatchNotification({
      recipientId: '11111111-1111-4111-8111-111111111111',
      recipientType: 'customer',
      notificationType: 'booking_created',
      title: 'Booking confirmed',
      message: 'Your appointment is confirmed',
      channels: { inApp: true, push: true },
      data: { dedupeKey: 'booking-x-created-customer', bookingId: 'booking-x' },
    });

    expect(result.skippedDuplicate).toBe(true);
    expect(result.pushSent).toBeGreaterThan(0);
    expect(sendPushToMultipleDevices).toHaveBeenCalled();
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

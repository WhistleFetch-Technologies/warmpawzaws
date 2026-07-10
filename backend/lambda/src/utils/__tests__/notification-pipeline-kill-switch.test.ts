import {
  NOTIFICATION_PIPELINE_MASTER_DISABLED,
  campaignPipelineDisabledResult,
  cronPipelineSkippedPayload,
  dispatchPipelineDisabledResult,
  isNotificationPipelineEnabled,
} from '../notification-pipeline-kill-switch';

jest.mock('../../database/rds-connection', () => ({
  insert: jest.fn(),
  query: jest.fn(),
  update: jest.fn(),
}));

jest.mock('../firebase-client', () => ({
  classifyFcmError: jest.fn(),
  deactivateDeviceTokens: jest.fn(),
  sendPushToMultipleDevices: jest.fn(),
}));

jest.mock('../notification-delivery', () => ({
  ensureDeliveryLogEntries: jest.fn(),
  finalizeInAppDelivery: jest.fn(),
  markChannelDeliveryFailed: jest.fn(),
  resolveChannelsFromRequest: jest.fn(),
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
  it('exposes master disabled flag as true for emergency halt', () => {
    expect(NOTIFICATION_PIPELINE_MASTER_DISABLED).toBe(true);
    expect(isNotificationPipelineEnabled()).toBe(false);
  });

  it('returns cron skip payload shape', () => {
    expect(cronPipelineSkippedPayload()).toEqual({
      success: true,
      skipped: true,
      reason: 'notification_pipeline_disabled',
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

describe('dispatchNotification when pipeline disabled', () => {
  it('short-circuits without database access', async () => {
    const { insert, query } = await import('../../database/rds-connection');
    const { dispatchNotification } = await import('../notification-dispatch');

    const result = await dispatchNotification({
      recipientId: 'user-1',
      recipientType: 'customer',
      notificationType: 'booking_confirmed',
      title: 'Test',
      message: 'Body',
    });

    expect(result.pushSkippedReason).toBe('pipeline_disabled');
    expect(result.inboxOk).toBe(false);
    expect(insert).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('scheduled-notification-drain when pipeline disabled', () => {
  it('processDueScheduledNotifications returns skip payload', async () => {
    const { query } = await import('../../database/rds-connection');
    const { processDueScheduledNotifications, processDueScheduledCampaigns } = await import(
      '../scheduled-notification-drain'
    );

    const scheduled = await processDueScheduledNotifications();
    const campaigns = await processDueScheduledCampaigns();

    expect(scheduled).toMatchObject({ skipped: true, reason: 'notification_pipeline_disabled' });
    expect(campaigns).toMatchObject({ skipped: true, reason: 'notification_pipeline_disabled' });
    expect(query).not.toHaveBeenCalled();
  });
});

describe('executeCampaignDelivery when pipeline disabled', () => {
  it('returns failed result without audience resolution', async () => {
    const { query } = await import('../../database/rds-connection');
    const { executeCampaignDelivery } = await import('../notification-campaign-processor');

    const result = await executeCampaignDelivery(
      {
        id: 'camp-1',
        title: 'T',
        message: 'M',
        channel: 'PUSH',
        target_app: 'CUSTOMER',
        targeting_type: 'ALL',
      },
      { region_ids: [], city_names: [], user_ids: [], segment_ids: [] },
      null
    );

    expect(result.status).toBe('FAILED');
    expect(result.errors).toContain('pipeline_disabled');
    expect(query).not.toHaveBeenCalled();
  });
});

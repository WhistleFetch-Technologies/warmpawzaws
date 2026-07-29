import { describe, expect, test } from '@jest/globals';
import { buildUnifiedPushMessage, buildSilentDataFcmMessage } from '../firebase-client';

describe('buildUnifiedPushMessage', () => {
  test('includes Android channel config unchanged for scalable Android delivery', () => {
    const message = buildUnifiedPushMessage(
      { title: 'Booking', body: 'Confirmed', data: { type: 'booking_created' } },
      'token',
      'android-token'
    );
    const android = message.android as { notification?: { channelId?: string } };
    expect(android?.notification?.channelId).toBe('warmpawz_push_alerts');
  });

  test('includes APNs payload with alert + custom data for iOS tray + deep links', () => {
    const message = buildUnifiedPushMessage(
      {
        title: 'Booking',
        body: 'Confirmed',
        data: { type: 'booking_created', deep_link: '/bookings', booking_id: 'abc-123' },
      },
      'token',
      'ios-apns-token-via-fcm'
    );
    const apns = message.apns as {
      headers?: { 'apns-push-type'?: string };
      payload?: {
        aps?: { sound?: string; alert?: { title?: string; body?: string } };
        deep_link?: string;
        booking_id?: string;
      };
    };
    expect(apns?.headers?.['apns-push-type']).toBe('alert');
    expect(apns?.payload?.aps?.alert).toEqual({ title: 'Booking', body: 'Confirmed' });
    expect(apns?.payload?.aps?.sound).toBe('default');
    expect(apns?.payload?.deep_link).toBe('/bookings');
    expect(apns?.payload?.booking_id).toBe('abc-123');
  });

  test('multicast tokens shape supports iOS + Android in one Firebase send', () => {
    const message = buildUnifiedPushMessage(
      { title: 'Hi', body: 'There', data: { type: 'test' } },
      'tokens',
      ['android-tok', 'ios-tok']
    );
    expect(message.tokens).toEqual(['android-tok', 'ios-tok']);
    expect(message.android).toBeDefined();
    expect(message.apns).toBeDefined();
  });

  test('silent data message has no notification block and uses background APNs', () => {
    const message = buildSilentDataFcmMessage(
      {
        data: {
          type: 'commerce_switch_updated',
          configurationVersion: '12',
          activeModelId: 'warmpawz_pay',
        },
      },
      'topic',
      'all_customers'
    );

    expect(message.notification).toBeUndefined();
    expect(message.topic).toBe('all_customers');
    expect(message.data).toEqual({
      type: 'commerce_switch_updated',
      configurationVersion: '12',
      activeModelId: 'warmpawz_pay',
    });

    const apns = message.apns as {
      headers?: { 'apns-push-type'?: string };
      payload?: { aps?: { 'content-available'?: number } };
    };
    expect(apns?.headers?.['apns-push-type']).toBe('background');
    expect(apns?.payload?.aps?.['content-available']).toBe(1);
  });
});

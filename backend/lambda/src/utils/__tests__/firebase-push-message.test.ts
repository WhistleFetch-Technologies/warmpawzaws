import { describe, expect, test } from '@jest/globals';
import { buildAppIconBadgeOnlyMessage, buildUnifiedPushMessage } from '../firebase-client';

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
        aps?: { sound?: string; badge?: number; alert?: { title?: string; body?: string } };
        deep_link?: string;
        booking_id?: string;
      };
    };
    expect(apns?.headers?.['apns-push-type']).toBe('alert');
    expect(apns?.payload?.aps?.alert).toEqual({ title: 'Booking', body: 'Confirmed' });
    expect(apns?.payload?.aps?.sound).toBe('default');
    expect(apns?.payload?.aps?.badge).toBe(1);
    expect(apns?.payload?.deep_link).toBe('/bookings');
    expect(apns?.payload?.booking_id).toBe('abc-123');
  });

  test('respects explicit badge on alert pushes', () => {
    const message = buildUnifiedPushMessage(
      { title: 'Hi', body: 'There', badge: 3, data: { type: 'test' } },
      'token',
      'tok'
    );
    const apns = message.apns as { payload?: { aps?: { badge?: number } } };
    expect(apns?.payload?.aps?.badge).toBe(3);
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
});

describe('buildAppIconBadgeOnlyMessage', () => {
  test('clears iOS icon badge without tray alert/sound', () => {
    const message = buildAppIconBadgeOnlyMessage(0, 'tokens', ['ios-tok']);
    const apns = message.apns as {
      headers?: { 'apns-push-type'?: string };
      payload?: { aps?: { badge?: number; alert?: unknown; sound?: unknown } };
    };
    expect(message.tokens).toEqual(['ios-tok']);
    expect(message.notification).toBeUndefined();
    expect(apns?.headers?.['apns-push-type']).toBe('alert');
    expect(apns?.payload?.aps?.badge).toBe(0);
    expect(apns?.payload?.aps?.alert).toBeUndefined();
    expect(apns?.payload?.aps?.sound).toBeUndefined();
    expect((message.data as { type?: string })?.type).toBe('app_icon_badge_sync');
  });
});

import { describe, expect, test } from '@jest/globals';
import { buildUnifiedPushMessage } from '../firebase-client';

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

  test('includes APNs payload with custom data for iOS deep links (same dispatch path)', () => {
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
      payload?: { aps?: { sound?: string }; deep_link?: string; booking_id?: string };
    };
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
});

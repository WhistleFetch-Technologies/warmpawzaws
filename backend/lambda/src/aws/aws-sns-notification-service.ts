/**
 * ============================================================================
 * PUSH NOTIFICATION SERVICE - COMPLETE IMPLEMENTATION
 * ============================================================================
 * 
 * Comprehensive push notification service supporting:
 * - FCM (Firebase Cloud Messaging) for Android
 * - APNs (Apple Push Notification service) for iOS
 * - SNS for SMS fallback
 * - In-app notifications with real-time WebSocket (future)
 */

import { SNSClient, PublishCommand, CreatePlatformEndpointCommand } from '@aws-sdk/client-sns';
import { query, insert, update } from '../database/rds-connection';
import { NOTIFICATION_TEMPLATES, NotificationEvent, NotificationRecipient, PushNotificationPayload } from './constatns/interface';
import { dispatchNotification } from '../utils/notification-dispatch';



const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';

const PLATFORM_APP_ARNS = {
  android: process.env.SNS_PLATFORM_APP_ANDROID_ARN || '',
  ios: process.env.SNS_PLATFORM_APP_IOS_ARN || '',
};

const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || '';

const snsClient = new SNSClient({ region: AWS_REGION });



class PushNotificationServiceImpl {

 
  /**
   * Send notification based on event type
   */
  async sendEventNotification(event: NotificationEvent): Promise<boolean> {
    try {
      const template = NOTIFICATION_TEMPLATES[event.eventType];
      if (!template) {
        console.warn(`No template found for event type: ${event.eventType}`);
        return false;
      }

      const payload = this.buildPayloadFromTemplate(template, event.data || {});
      const bookingId = event.data?.bookingId || event.data?.booking_id || event.relatedId;
      const orderId = event.data?.orderId || event.data?.order_id;

      const result = await dispatchNotification({
        recipientId: event.recipientId,
        recipientType: event.recipientType,
        notificationType: event.eventType,
        title: payload.title,
        message: payload.body,
        channels: { inApp: true, push: true, sms: false },
        priority: payload.priority === 'high' ? 'high' : 'normal',
        imageUrl: payload.imageUrl,
        data: {
          ...(event.data || {}),
          eventType: event.eventType,
          relatedId: event.relatedId,
          bookingId,
          orderId,
          dedupeKey:
            event.data?.dedupeKey ||
            `${event.eventType}-${event.recipientId}-${event.relatedId || bookingId || orderId || 'none'}`,
        },
      });

      return result.inboxOk || result.skippedDuplicate;
    } catch (error) {
      console.error(`Error sending event notification:`, error);
      return false;
    }
  }

  /**
   * Send notification to a specific user
   */
  async sendToUser(
    recipient: NotificationRecipient,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    try {
      const eventType = String(payload.data?.eventType || payload.data?.type || 'general');
      const bookingId = payload.data?.bookingId || payload.data?.booking_id;
      const orderId = payload.data?.orderId || payload.data?.order_id;

      const result = await dispatchNotification({
        recipientId: recipient.userId,
        recipientType: recipient.userType,
        notificationType: eventType,
        title: payload.title,
        message: payload.body,
        channels: { inApp: true, push: true, sms: false },
        priority: payload.priority === 'high' ? 'high' : 'normal',
        imageUrl: payload.imageUrl,
        data: {
          ...(payload.data || {}),
          bookingId,
          orderId,
          dedupeKey:
            payload.data?.dedupeKey ||
            `${eventType}-${recipient.userId}-${bookingId || orderId || payload.collapseKey || Date.now()}`,
        },
      });

      if (
        result.pushSent === 0 &&
        result.pushFailed === 0 &&
        !result.pushSkippedReason &&
        recipient.phone
      ) {
        const devices = await this.getUserDevices(recipient.userId, recipient.userType);
        if (devices.length === 0) {
          await this.sendSMS(recipient.phone, payload.title, payload.body);
        }
      }

      return result.inboxOk || result.skippedDuplicate;
    } catch (error) {
      console.error(`Error sending notification to user:`, error);
      return false;
    }
  }

  /**
   * Send notification to multiple users
   */
  async sendToUsers(
    recipients: NotificationRecipient[],
    payload: PushNotificationPayload
  ): Promise<{ success: number; failed: number }> {
    const results = await Promise.all(
      recipients.map(r => this.sendToUser(r, payload))
    );

    return {
      success: results.filter(r => r).length,
      failed: results.filter(r => !r).length,
    };
  }

  /**
   * Send high-priority notification (for urgent events like pharmacy broadcasts)
   */
  async sendUrgentNotification(
    recipient: NotificationRecipient,
    payload: PushNotificationPayload
  ): Promise<boolean> {
    payload.priority = 'high';
    payload.sound = 'urgent';
    payload.ttl = 120; // 2 minutes for urgent notifications

    return await this.sendToUser(recipient, payload);
  }

  /**
   * Schedule a notification for future delivery
   */
  async scheduleNotification(
    recipient: NotificationRecipient,
    payload: PushNotificationPayload,
    scheduledAt: Date,
    relatedId?: string
  ): Promise<string> {
    try {
      const result = await insert('scheduled_notifications', {
        recipient_id: recipient.userId,
        recipient_type: recipient.userType,
        recipient_phone: recipient.phone,
        title: payload.title,
        body: payload.body,
        data: JSON.stringify(payload.data || {}),
        priority: payload.priority || 'normal',
        sound: payload.sound || 'default',
        scheduled_at: scheduledAt.toISOString(),
        related_id: relatedId,
        status: 'pending',
        created_at: new Date().toISOString(),
      });

      console.log(`Scheduled notification for ${scheduledAt.toISOString()}`);
      return result[0]?.id || '';

    } catch (error) {
      console.error('Error scheduling notification:', error);
      throw error;
    }
  }

  /**
   * Cancel a scheduled notification
   */
  async cancelScheduledNotification(notificationId: string): Promise<boolean> {
    try {
      await update('scheduled_notifications',
        { id: notificationId },
        { status: 'cancelled' }
      );
      return true;
    } catch (error) {
      console.error('Error cancelling scheduled notification:', error);
      return false;
    }
  }

  // ============================================================================
  // SPECIFIC NOTIFICATION SENDERS
  // ============================================================================

  /**
   * Send 5-minute video call reminder
   * Fixes GAP: TV-1
   */
  async sendVideoCallReminder(
    bookingId: string,
    recipientId: string,
    recipientType: 'customer' | 'vendor',
    vendorName: string
  ): Promise<boolean> {
    return await this.sendEventNotification({
      eventType: 'video_call_reminder_5min',
      recipientId,
      recipientType,
      relatedId: bookingId,
      data: { vendorName, bookingId },
    });
  }

  /**
   * Send pharmacy order broadcast to pharmacies
   * Fixes GAP: PH-1
   */
  async sendPharmacyBroadcast(
    pharmacyIds: string[],
    orderId: string,
    customerName: string,
    itemCount: number
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const pharmacyId of pharmacyIds) {
      const ok = await this.sendToUser(
        { userId: pharmacyId, userType: 'vendor' },
        {
          title: 'New pharmacy order',
          body: `New order from ${customerName}. ${itemCount} items. Accept within 2 minutes.`,
          sound: 'urgent',
          priority: 'high',
          data: {
            orderId,
            customerName,
            itemCount,
            eventType: 'pharmacy_order',
            dedupeKey: `pharmacy-broadcast-${orderId}-${pharmacyId}`,
          },
        }
      );
      if (ok) success += 1;
      else failed += 1;
    }

    return { success, failed };
  }

  /**
   * Send vendor on-way notification with ETA
   * Fixes GAP: HS-1, HS-4
   */
  async sendVendorOnWay(
    customerId: string,
    bookingId: string,
    vendorName: string,
    etaMinutes: number,
    trackingUrl?: string
  ): Promise<boolean> {
    return await this.sendEventNotification({
      eventType: 'vendor_on_way',
      recipientId: customerId,
      recipientType: 'customer',
      relatedId: bookingId,
      data: { vendorName, eta: etaMinutes, trackingUrl, bookingId },
    });
  }

  /**
   * Send rating request after service completion
   * Fixes GAP: CC-4
   */
  async sendRatingRequest(
    customerId: string,
    bookingId: string,
    vendorName: string,
    serviceName: string
  ): Promise<boolean> {
    return await this.sendEventNotification({
      eventType: 'rating_request',
      recipientId: customerId,
      recipientType: 'customer',
      relatedId: bookingId,
      data: { vendorName, serviceName, bookingId },
    });
  }

  /**
   * Send clarification request to vendor
   * Fixes GAP: VO-1, VO-2
   */
  async sendClarificationRequest(
    vendorId: string,
    applicationId: string,
    comment: string
  ): Promise<boolean> {
    return await this.sendEventNotification({
      eventType: 'vendor_application_clarification',
      recipientId: vendorId,
      recipientType: 'vendor',
      relatedId: applicationId,
      data: { comment, applicationId },
    });
  }

  // ============================================================================
  // INTERNAL METHODS
  // ============================================================================

  private buildPayloadFromTemplate(
    template: { title: string; body: string; sound?: string },
    data: Record<string, any>
  ): PushNotificationPayload {
    let title = template.title;
    let body = template.body;

    // Replace placeholders with actual data
    Object.entries(data).forEach(([key, value]) => {
      const placeholder = `{${key}}`;
      title = title.replace(placeholder, String(value));
      body = body.replace(placeholder, String(value));
    });

    return {
      title,
      body,
      sound: template.sound as any || 'default',
      priority: 'normal',
      data,
    };
  }

  private async getUserDevices(userId: string, userType: string): Promise<any[]> {
    try {
      // Check device_tokens table first (where devices are actually registered)
      const deviceTokensResult = await query(
        `SELECT id, fcm_token as device_token, platform, app_version, is_active 
         FROM device_tokens 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );
      
      if (deviceTokensResult.rows && deviceTokensResult.rows.length > 0) {
        console.log(`📱 [NOTIFICATION] Found ${deviceTokensResult.rows.length} device(s) in device_tokens for ${userType} ${userId}`);
        return deviceTokensResult.rows;
      }

      // Fallback to user_devices table (legacy support)
      const userDevicesResult = await query(
        `SELECT id, device_token, platform, app_version, is_active 
         FROM user_devices 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );
      
      if (userDevicesResult.rows && userDevicesResult.rows.length > 0) {
        console.log(`📱 [NOTIFICATION] Found ${userDevicesResult.rows.length} device(s) in user_devices for ${userType} ${userId}`);
        return userDevicesResult.rows;
      }

      console.log(`📱 [NOTIFICATION] No registered devices found for ${userType} ${userId}`);
      return [];
    } catch (error) {
      console.error(`❌ [NOTIFICATION] Error fetching user devices for ${userType} ${userId}:`, error);
      return [];
    }
  }

  private async sendToDevice(device: any, payload: PushNotificationPayload): Promise<boolean> {
    try {
      const { device_token, platform } = device;

      if (platform === 'android' || platform === 'fcm') {
        return await this.sendFCM(device_token, payload);
      } else if (platform === 'ios' || platform === 'apns') {
        return await this.sendAPNs(device_token, payload);
      } else {
        console.warn(`Unknown platform: ${platform}`);
        return false;
      }

    } catch (error) {
      console.error('Error sending to device:', error);
      return false;
    }
  }

  private async sendFCM(token: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      // Use SNS platform application for FCM
      if (PLATFORM_APP_ARNS.android) {
        const endpointArn = await this.getOrCreateEndpoint(token, 'android');

        const message = {
          GCM: JSON.stringify({
            notification: {
              title: payload.title,
              body: payload.body,
              image: payload.imageUrl,
              sound: payload.sound === 'urgent' ? 'urgent.mp3' : 'default',
              priority: payload.priority === 'high' ? 'high' : 'normal',
            },
            data: payload.data,
          }),
        };

        await snsClient.send(new PublishCommand({
          TargetArn: endpointArn,
          Message: JSON.stringify(message),
          MessageStructure: 'json',
        }));

        console.log(`FCM push sent to ${token.substring(0, 20)}...`);
        return true;
      }

      // Fallback: Direct FCM HTTP API
      if (FCM_SERVER_KEY) {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `key=${FCM_SERVER_KEY}`,
          },
          body: JSON.stringify({
            to: token,
            notification: {
              title: payload.title,
              body: payload.body,
              image: payload.imageUrl,
              sound: payload.sound === 'urgent' ? 'urgent' : 'default',
            },
            data: payload.data,
            priority: payload.priority === 'high' ? 'high' : 'normal',
            time_to_live: payload.ttl || 86400,
          }),
        });

        if (!response.ok) {
          console.error('FCM API error:', await response.text());
          return false;
        }

        console.log(`FCM push sent via HTTP API to ${token.substring(0, 20)}...`);
        return true;
      }

      console.log(`[FCM Mock] Would send: ${payload.title}`);
      return true;

    } catch (error) {
      console.error('Error sending FCM:', error);
      return false;
    }
  }

  private async sendAPNs(token: string, payload: PushNotificationPayload): Promise<boolean> {
    try {
      if (PLATFORM_APP_ARNS.ios) {
        const endpointArn = await this.getOrCreateEndpoint(token, 'ios');

        const message = {
          APNS: JSON.stringify({
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: payload.sound === 'urgent' ? 'urgent.aiff' : 'default',
              badge: 1,
              'mutable-content': 1,
            },
            ...payload.data,
          }),
        };

        await snsClient.send(new PublishCommand({
          TargetArn: endpointArn,
          Message: JSON.stringify(message),
          MessageStructure: 'json',
        }));

        console.log(`APNs push sent to ${token.substring(0, 20)}...`);
        return true;
      }

      console.log(`[APNs Mock] Would send: ${payload.title}`);
      return true;

    } catch (error) {
      console.error('Error sending APNs:', error);
      return false;
    }
  }

  private async getOrCreateEndpoint(token: string, platform: 'android' | 'ios'): Promise<string> {
    const platformArn = PLATFORM_APP_ARNS[platform];

    try {
      const response = await snsClient.send(new CreatePlatformEndpointCommand({
        PlatformApplicationArn: platformArn,
        Token: token,
      }));

      return response.EndpointArn || '';
    } catch (error: any) {
      // If endpoint already exists, extract ARN from error
      if (error.message?.includes('already exists')) {
        const match = error.message.match(/Endpoint (arn:aws:sns:[^\\s]+)/);
        if (match) return match[1];
      }
      throw error;
    }
  }

  private async sendSMS(phone: string, title: string, body: string): Promise<boolean> {
    try {
      await snsClient.send(new PublishCommand({
        PhoneNumber: phone.startsWith('+') ? phone : `+91${phone}`,
        Message: `${title}: ${body}`,
        MessageAttributes: {
          'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' },
        },
      }));
      console.log(`SMS sent to ${phone}`);
      return true;
    } catch (error) {
      console.error('Error sending SMS:', error);
      return false;
    }
  }

  private async storeNotification(
    recipient: NotificationRecipient,
    payload: PushNotificationPayload
  ): Promise<void> {
    try {
      // Columns must match the actual `notifications` table schema:
      //   recipient_id, recipient_type, notification_type, title, message,
      //   channels (JSONB NOT NULL), is_read, data (JSONB), created_at
      await insert('notifications', {
        recipient_id: recipient.userId,
        recipient_type: recipient.userType,
        notification_type: payload.data?.eventType || 'general',
        title: payload.title,
        message: payload.body,
        channels: { email: false, sms: false, inApp: true, push: true },
        is_read: false,
        data: payload.data || {},
        created_at: new Date().toISOString(),
      });

      console.log(`✅ [NOTIFICATION] Stored notification for ${recipient.userType} ${recipient.userId}: "${payload.title}"`);
    } catch (error) {
      console.error(`❌ [NOTIFICATION] Failed to store notification for ${recipient.userType} ${recipient.userId}:`, error);
      if (error instanceof Error) {
        console.error(`   Error: ${error.message}`);
      }
    }
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationServiceImpl();

// Export convenience functions
export const sendEventNotification = (event: NotificationEvent) =>
  pushNotificationService.sendEventNotification(event);

export const sendVideoCallReminder = (
  bookingId: string,
  recipientId: string,
  recipientType: 'customer' | 'vendor',
  vendorName: string
) => pushNotificationService.sendVideoCallReminder(bookingId, recipientId, recipientType, vendorName);

export const sendPharmacyBroadcast = (
  pharmacyIds: string[],
  orderId: string,
  customerName: string,
  itemCount: number
) => pushNotificationService.sendPharmacyBroadcast(pharmacyIds, orderId, customerName, itemCount);

export const sendVendorOnWay = (
  customerId: string,
  bookingId: string,
  vendorName: string,
  etaMinutes: number,
  trackingUrl?: string
) => pushNotificationService.sendVendorOnWay(customerId, bookingId, vendorName, etaMinutes, trackingUrl);

export const sendRatingRequest = (
  customerId: string,
  bookingId: string,
  vendorName: string,
  serviceName: string
) => pushNotificationService.sendRatingRequest(customerId, bookingId, vendorName, serviceName);

export const scheduleNotification = (
  recipient: NotificationRecipient,
  payload: PushNotificationPayload,
  scheduledAt: Date,
  relatedId?: string
) => pushNotificationService.scheduleNotification(recipient, payload, scheduledAt, relatedId);

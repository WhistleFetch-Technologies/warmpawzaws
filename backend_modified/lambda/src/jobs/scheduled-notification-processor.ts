/**
 * ============================================================================
 * SCHEDULED NOTIFICATION PROCESSOR
 * ============================================================================
 * 
 * Lambda function triggered by CloudWatch Events/EventBridge Scheduler
 * Processes scheduled notifications (5-minute reminders, etc.)
 * 
 * Fixes GAP: TV-1 (5-minute video call reminder)
 * 
 * Runs every minute to check for pending scheduled notifications
 * 
 * Date: 2026-01-21
 * ============================================================================
 */

import { ScheduledEvent, Context } from 'aws-lambda';
import { query, update, select } from '../database/rds-connection';
import { pushNotificationService, sendVideoCallReminder } from '../lib/services/push-notification-service';

// ============================================================================
// CONFIGURATION
// ============================================================================

const VIDEO_CALL_REMINDER_MINUTES = 5;
const BATCH_SIZE = 100;

// ============================================================================
// MAIN HANDLER
// ============================================================================

export async function handler(event: ScheduledEvent, context: Context) {
  console.log('Scheduled notification processor triggered', {
    time: event.time,
    requestId: context.awsRequestId,
  });

  const results = {
    processedCount: 0,
    sentCount: 0,
    failedCount: 0,
    videoCallReminders: 0,
    generalNotifications: 0,
  };

  try {
    // Process scheduled notifications
    await processScheduledNotifications(results);
    
    // Process video call reminders (5 minutes before)
    await processVideoCallReminders(results);
    
    // Process booking reminders
    await processBookingReminders(results);

    console.log('Scheduled notification processing complete', results);
    
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };

  } catch (error) {
    console.error('Error in scheduled notification processor:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}

// ============================================================================
// NOTIFICATION PROCESSORS
// ============================================================================

/**
 * Process general scheduled notifications from the scheduled_notifications table
 */
async function processScheduledNotifications(results: any) {
  try {
    // Get pending notifications that are due
    const pending = await query(
      `SELECT * FROM scheduled_notifications 
       WHERE status = 'pending' 
       AND scheduled_at <= NOW()
       ORDER BY scheduled_at ASC
       LIMIT $1`,
      [BATCH_SIZE]
    );

    const notifications = (pending as any).rows || [];
    console.log(`Found ${notifications.length} pending scheduled notifications`);

    for (const notification of notifications) {
      try {
        // Send the notification
        const success = await pushNotificationService.sendToUser(
          {
            userId: notification.recipient_id,
            userType: notification.recipient_type,
            phone: notification.recipient_phone,
          },
          {
            title: notification.title,
            body: notification.body,
            data: notification.data ? JSON.parse(notification.data) : {},
            priority: notification.priority || 'normal',
            sound: notification.sound || 'default',
          }
        );

        // Update status
        await update('scheduled_notifications', { id: notification.id }, {
          status: success ? 'sent' : 'failed',
          sent_at: success ? new Date().toISOString() : null,
          error_message: success ? null : 'Failed to deliver',
        });

        if (success) {
          results.sentCount++;
          results.generalNotifications++;
        } else {
          results.failedCount++;
        }
        results.processedCount++;

      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error);
        await update('scheduled_notifications', { id: notification.id }, {
          status: 'failed',
          error_message: (error as Error).message,
        });
        results.failedCount++;
        results.processedCount++;
      }
    }

  } catch (error) {
    console.error('Error processing scheduled notifications:', error);
  }
}

/**
 * Process video call reminders - send 5 minutes before scheduled time
 * Fixes GAP: TV-1
 */
async function processVideoCallReminders(results: any) {
  try {
    // Find video call bookings starting in the next 5-6 minutes
    // that haven't had a reminder sent
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + (VIDEO_CALL_REMINDER_MINUTES * 60 * 1000));
    const reminderWindowEnd = new Date(now.getTime() + ((VIDEO_CALL_REMINDER_MINUTES + 1) * 60 * 1000));

    const bookings = await query(
      `SELECT b.*, 
              b.customer_id,
              b.vendor_id,
              b.staff_id,
              COALESCE(v.business_name, s.name, 'Your doctor') as vendor_name,
              COALESCE(c.name, 'Customer') as customer_name
       FROM bookings b
       LEFT JOIN vendors v ON b.vendor_id = v.id
       LEFT JOIN staff s ON b.staff_id = s.id
       LEFT JOIN customers c ON b.customer_id = c.id
       WHERE b.service_type = 'tele'
       AND b.status IN ('confirmed', 'pending')
       AND b.video_call_reminder_sent IS NOT TRUE
       AND (b.booking_date || ' ' || b.booking_time)::timestamp 
           BETWEEN $1 AND $2`,
      [reminderWindowStart.toISOString(), reminderWindowEnd.toISOString()]
    );

    const rows = (bookings as any).rows || [];
    console.log(`Found ${rows.length} video call bookings needing reminders`);

    for (const booking of rows) {
      try {
        // Send reminder to customer
        await sendVideoCallReminder(
          booking.id,
          booking.customer_id,
          'customer',
          booking.vendor_name
        );

        // Send reminder to vendor/staff
        const vendorRecipient = booking.staff_id || booking.vendor_id;
        const vendorType = booking.staff_id ? 'staff' : 'vendor';
        await sendVideoCallReminder(
          booking.id,
          vendorRecipient,
          vendorType as any,
          booking.customer_name
        );

        // Mark reminder as sent
        await update('bookings', { id: booking.id }, {
          video_call_reminder_sent: true,
          video_call_reminder_sent_at: new Date().toISOString(),
        });

        results.videoCallReminders++;
        results.sentCount += 2; // Both customer and vendor
        results.processedCount += 2;

        console.log(`✅ Video call reminder sent for booking ${booking.id}`);

      } catch (error) {
        console.error(`Error sending video call reminder for booking ${booking.id}:`, error);
        results.failedCount++;
      }
    }

  } catch (error) {
    console.error('Error processing video call reminders:', error);
  }
}

/**
 * Process general booking reminders (1 hour before, etc.)
 */
async function processBookingReminders(results: any) {
  try {
    // Find bookings starting in the next hour that haven't had a reminder sent
    const now = new Date();
    const reminderWindowStart = new Date(now.getTime() + (55 * 60 * 1000)); // 55 min
    const reminderWindowEnd = new Date(now.getTime() + (65 * 60 * 1000)); // 65 min

    const bookings = await query(
      `SELECT b.*, 
              COALESCE(v.business_name, s.name, 'Service Provider') as vendor_name,
              b.otp_code
       FROM bookings b
       LEFT JOIN vendors v ON b.vendor_id = v.id
       LEFT JOIN staff s ON b.staff_id = s.id
       WHERE b.status IN ('confirmed', 'pending')
       AND b.reminder_sent IS NOT TRUE
       AND (b.booking_date || ' ' || b.booking_time)::timestamp 
           BETWEEN $1 AND $2`,
      [reminderWindowStart.toISOString(), reminderWindowEnd.toISOString()]
    );

    const rows = (bookings as any).rows || [];
    console.log(`Found ${rows.length} bookings needing reminders`);

    for (const booking of rows) {
      try {
        // Calculate time remaining
        const bookingTime = new Date(`${booking.booking_date}T${booking.booking_time}`);
        const timeLeftMinutes = Math.round((bookingTime.getTime() - now.getTime()) / (60 * 1000));
        const timeLeft = timeLeftMinutes >= 60 ? '1 hour' : `${timeLeftMinutes} minutes`;

        await pushNotificationService.sendEventNotification({
          eventType: 'booking_reminder',
          recipientId: booking.customer_id,
          recipientType: 'customer',
          relatedId: booking.id,
          data: {
            vendorName: booking.vendor_name,
            timeLeft,
            otp: booking.otp_code,
            bookingId: booking.id,
          },
        });

        // Mark reminder as sent
        await update('bookings', { id: booking.id }, {
          reminder_sent: true,
          reminder_sent_at: new Date().toISOString(),
        });

        results.sentCount++;
        results.processedCount++;

      } catch (error) {
        console.error(`Error sending booking reminder for ${booking.id}:`, error);
        results.failedCount++;
      }
    }

  } catch (error) {
    console.error('Error processing booking reminders:', error);
  }
}

// ============================================================================
// ADDITIONAL SCHEDULED TASKS
// ============================================================================

/**
 * Clean up old scheduled notifications
 */
export async function cleanupOldNotifications(): Promise<number> {
  try {
    const result = await query(
      `DELETE FROM scheduled_notifications 
       WHERE (status = 'sent' AND sent_at < NOW() - INTERVAL '7 days')
       OR (status = 'failed' AND created_at < NOW() - INTERVAL '30 days')
       OR (status = 'cancelled' AND created_at < NOW() - INTERVAL '7 days')`,
      []
    );
    return (result as any).rowCount || 0;
  } catch (error) {
    console.error('Error cleaning up notifications:', error);
    return 0;
  }
}

/**
 * Process pharmacy broadcast expiration
 * Escalate to next radius tier or cancel
 */
export async function processPharmacyBroadcastExpiration(): Promise<void> {
  try {
    const expiredBroadcasts = await query(
      `SELECT pb.*, po.id as order_id, po.customer_id
       FROM pharmacy_broadcasts pb
       JOIN pharmacy_orders po ON pb.order_id = po.id
       WHERE pb.status = 'pending'
       AND pb.expires_at < NOW()
       AND po.status = 'broadcasting'`,
      []
    );

    const rows = (expiredBroadcasts as any).rows || [];
    
    for (const broadcast of rows) {
      // This would trigger the expand-broadcast endpoint
      console.log(`Broadcast ${broadcast.id} expired, needs escalation`);
    }
  } catch (error) {
    console.error('Error processing broadcast expiration:', error);
  }
}

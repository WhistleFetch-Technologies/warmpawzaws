/**
 * ============================================================================
 * ANALYTICS QUEUE PROCESSOR
 * ============================================================================
 * 
 * Lambda function that processes analytics events from SQS queue
 * Triggered by: SQS event source mapping from analytics queue
 * 
 * Handles:
 * - Event aggregation
 * - Analytics data storage
 * - Real-time metrics calculation
 * 
 * Date: 2026-01-28
 * ============================================================================
 */

import { SQSEvent, Context } from 'aws-lambda';
import { insert, query } from '../database/rds-connection';

interface AnalyticsEvent {
  eventType: string;
  entityType: 'booking' | 'payment' | 'vendor' | 'customer' | 'service';
  entityId: string;
  properties?: Record<string, any>;
  userId?: string;
  userType?: 'customer' | 'vendor' | 'admin';
  timestamp?: string;
  sessionId?: string;
}

export async function handler(event: SQSEvent, context: Context) {
  console.log('Analytics processor triggered', { recordCount: event.Records.length });

  const results = [];

  for (const record of event.Records) {
    try {
      // Parse SNS message if it came from SNS → SQS
      let messageBody = record.body;
      if (record.body.startsWith('{') && JSON.parse(record.body).Message) {
        const snsMessage = JSON.parse(record.body);
        messageBody = snsMessage.Message;
      }

      const analyticsEvent: AnalyticsEvent = JSON.parse(messageBody);
      console.log('Processing analytics event:', analyticsEvent.eventType);

      await processAnalyticsEvent(analyticsEvent);

      results.push({ messageId: record.messageId, status: 'success' });
    } catch (error: any) {
      console.error('Error processing analytics event:', record.body, error);
      results.push({ 
        messageId: record.messageId, 
        status: 'failed', 
        error: error.message 
      });
      // Don't throw - continue processing other messages
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ 
      processed: results.length,
      results 
    }),
  };
}

async function processAnalyticsEvent(event: AnalyticsEvent) {
  // Store analytics event
  await insert('analytics_events', {
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    properties: event.properties ? JSON.stringify(event.properties) : null,
    user_id: event.userId || null,
    user_type: event.userType || null,
    session_id: event.sessionId || null,
    event_timestamp: event.timestamp || new Date().toISOString(),
    created_at: new Date().toISOString(),
  });

  // Update aggregated metrics based on event type
  await updateAggregatedMetrics(event);
}

async function updateAggregatedMetrics(event: AnalyticsEvent) {
  try {
    switch (event.eventType) {
      case 'booking_created':
        await query(
          `INSERT INTO analytics_daily_metrics (metric_date, bookings_created, updated_at)
           VALUES (CURRENT_DATE, 1, NOW())
           ON CONFLICT (metric_date) 
           DO UPDATE SET bookings_created = analytics_daily_metrics.bookings_created + 1, updated_at = NOW()`
        );
        break;

      case 'booking_completed':
        await query(
          `INSERT INTO analytics_daily_metrics (metric_date, bookings_completed, updated_at)
           VALUES (CURRENT_DATE, 1, NOW())
           ON CONFLICT (metric_date) 
           DO UPDATE SET bookings_completed = analytics_daily_metrics.bookings_completed + 1, updated_at = NOW()`
        );
        break;

      case 'payment_processed':
        const amount = event.properties?.amount || 0;
        await query(
          `INSERT INTO analytics_daily_metrics (metric_date, revenue, payments_processed, updated_at)
           VALUES (CURRENT_DATE, $1, 1, NOW())
           ON CONFLICT (metric_date) 
           DO UPDATE SET 
             revenue = analytics_daily_metrics.revenue + $1,
             payments_processed = analytics_daily_metrics.payments_processed + 1,
             updated_at = NOW()`,
          [amount]
        );
        break;

      case 'vendor_registered':
        await query(
          `INSERT INTO analytics_daily_metrics (metric_date, vendors_registered, updated_at)
           VALUES (CURRENT_DATE, 1, NOW())
           ON CONFLICT (metric_date) 
           DO UPDATE SET vendors_registered = analytics_daily_metrics.vendors_registered + 1, updated_at = NOW()`
        );
        break;

      case 'customer_registered':
        await query(
          `INSERT INTO analytics_daily_metrics (metric_date, customers_registered, updated_at)
           VALUES (CURRENT_DATE, 1, NOW())
           ON CONFLICT (metric_date) 
           DO UPDATE SET customers_registered = analytics_daily_metrics.customers_registered + 1, updated_at = NOW()`
        );
        break;
    }
  } catch (error) {
    console.error('Error updating aggregated metrics:', error);
    // Don't throw - event is stored, metrics can be recalculated
  }
}

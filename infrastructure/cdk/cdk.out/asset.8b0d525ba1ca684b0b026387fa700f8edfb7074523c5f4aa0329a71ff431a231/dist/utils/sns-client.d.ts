/**
 * ============================================================================
 * SNS CLIENT UTILITY (TEMPORAL AUDIT COMPLIANT)
 * ============================================================================
 *
 * Helper functions for publishing to SNS topics
 *
 * TEMPORAL AUDIT FIXES (2026-01-02):
 * - ✅ All events include timestamps
 * - ✅ All events include unique event IDs
 * - ✅ Standardized event envelope
 *
 * Date: 2025-01-28
 * Updated: 2026-01-02 (Temporal Audit Fixes)
 * ============================================================================
 */
import { SNSClient } from '@aws-sdk/client-sns';
export declare function getSnsClient(): SNSClient;
export interface TopicConfig {
    bookingCreatedTopic?: string;
    bookingStatusUpdatedTopic?: string;
    paymentCreatedTopic?: string;
    paymentProcessedTopic?: string;
    vendorApprovedTopic?: string;
    notificationTopic?: string;
    settlementTopic?: string;
}
export interface BookingCreatedEvent {
    bookingId: string;
    customerId: string;
    vendorId: string;
    serviceId?: string;
    serviceType: string;
    status: string;
    bookingDate?: string;
    bookingTime?: string;
    amount?: number;
}
/**
 * Publish booking created event with temporal metadata
 */
export declare function publishBookingCreated(message: BookingCreatedEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
export interface BookingStatusUpdatedEvent {
    bookingId: string;
    customerId: string;
    vendorId: string;
    oldStatus: string;
    newStatus: string;
    reason?: string;
}
/**
 * Publish booking status updated event with temporal metadata
 */
export declare function publishBookingStatusUpdated(message: BookingStatusUpdatedEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
export interface PaymentCreatedEvent {
    paymentId: string;
    bookingId: string;
    customerId: string;
    vendorId?: string;
    amount: number;
    currency: string;
    status: string;
}
/**
 * Publish payment created event with temporal metadata
 */
export declare function publishPaymentCreated(message: PaymentCreatedEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
export interface PaymentProcessedEvent {
    paymentId: string;
    bookingId?: string;
    customerId?: string;
    vendorId?: string;
    amount: number;
    status: string;
    razorpayPaymentId?: string;
}
/**
 * Publish payment processed event with temporal metadata
 */
export declare function publishPaymentProcessed(message: PaymentProcessedEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
export interface VendorApprovedEvent {
    vendorId: string;
    businessName?: string;
    ownerName?: string;
    email?: string;
    phone?: string;
    roleId?: string;
    approvedAt?: string;
    approvedBy?: string;
}
/**
 * Publish vendor approved event with temporal metadata
 */
export declare function publishVendorApproved(message: VendorApprovedEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
export interface SettlementCreatedEvent {
    settlementId: string;
    vendorId: string;
    amount: number;
    commissionAmount: number;
    netAmount: number;
    bookingCount: number;
}
/**
 * Publish settlement created event with temporal metadata
 */
export declare function publishSettlementCreated(message: SettlementCreatedEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
export interface NotificationEvent {
    recipientType: 'customer' | 'vendor' | 'admin';
    recipientId: string;
    title: string;
    body: string;
    type: string;
    data?: Record<string, any>;
}
/**
 * Publish notification event with temporal metadata
 */
export declare function publishNotification(message: NotificationEvent & {
    eventTimestamp?: string;
    eventId?: string;
    requestId?: string;
}): Promise<void>;
//# sourceMappingURL=sns-client.d.ts.map
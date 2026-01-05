/**
 * ============================================================================
 * AWS CLIENTS - UNIFIED AWS SDK UTILITIES
 * ============================================================================
 *
 * Provides unified access to AWS services:
 * - SNS for notifications
 * - SQS for queuing
 * - S3 for storage
 * - Chime for video calls
 *
 * Date: 2026-01-02
 * ============================================================================
 */
declare const S3_BUCKETS: Record<string, string>;
export declare function publishToSNS(topicName: string, message: Record<string, any>, attributes?: Record<string, any>): Promise<{
    messageId: string;
}>;
export declare function publishNotification(targetType: 'vendor' | 'customer' | 'admin', targetId: string, notification: {
    title: string;
    body: string;
    data?: Record<string, any>;
    type: string;
}): Promise<void>;
export declare function sendToSQS(queueName: string, message: Record<string, any>, options?: {
    delaySeconds?: number;
    messageGroupId?: string;
    deduplicationId?: string;
}): Promise<{
    messageId: string;
}>;
export declare function queueBookingEvent(event: 'created' | 'confirmed' | 'cancelled' | 'completed', bookingId: string, data: Record<string, any>): Promise<void>;
export declare function queuePaymentEvent(event: 'initiated' | 'completed' | 'failed' | 'refunded', paymentId: string, data: Record<string, any>): Promise<void>;
export declare function queueSettlement(vendorId: string, amount: number, bookingIds: string[]): Promise<void>;
export declare function queueSearchIndexUpdate(entity: 'service' | 'vendor' | 'staff' | 'product', action: 'create' | 'update' | 'delete', entityId: string, data?: Record<string, any>): Promise<void>;
export declare function uploadToS3(bucketName: keyof typeof S3_BUCKETS, key: string, body: Buffer | string, contentType: string): Promise<{
    url: string;
}>;
export declare function getFromS3(bucketName: keyof typeof S3_BUCKETS, key: string): Promise<Buffer>;
export declare function generateS3Key(type: 'document' | 'profile' | 'service' | 'product', entityId: string, filename: string): string;
export declare function getTopicArn(topicName: string): string | undefined;
export declare function getQueueUrl(queueName: string): string | undefined;
export declare function getBucketName(bucketType: keyof typeof S3_BUCKETS): string;
export {};
//# sourceMappingURL=aws-clients.d.ts.map
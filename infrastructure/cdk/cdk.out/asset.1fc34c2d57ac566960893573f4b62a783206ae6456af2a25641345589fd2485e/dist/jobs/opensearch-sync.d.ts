/**
 * ============================================================================
 * OPENSEARCH SYNC JOB
 * ============================================================================
 *
 * Lambda function that syncs data from RDS to OpenSearch
 * Triggered by:
 * - SQS messages (real-time updates)
 * - CloudWatch Events (full sync schedule)
 *
 * Date: 2026-01-02
 * ============================================================================
 */
import { SQSEvent, ScheduledEvent, Context } from 'aws-lambda';
export declare function handler(event: SQSEvent | ScheduledEvent, context: Context): Promise<{
    statusCode: number;
    body: string;
}>;
export declare function triggerServiceSync(serviceId: string, action: 'create' | 'update' | 'delete'): Promise<void>;
export declare function triggerVendorSync(vendorId: string, action: 'create' | 'update' | 'delete'): Promise<void>;
export declare function triggerStaffSync(staffId: string, action: 'create' | 'update' | 'delete'): Promise<void>;
//# sourceMappingURL=opensearch-sync.d.ts.map
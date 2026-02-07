/**
 * ============================================================================
 * AWS CDK STACK - S3 BUCKETS (Enhanced - Uses Existing Resources)
 * ============================================================================
 *
 * Enhanced to support existing S3 buckets
 * - Uses existing buckets if bucket names are provided via context
 * - Creates new buckets only if bucket names are not provided
 *
 * Date: 2026-01-28
 * ============================================================================
 */
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
export interface S3StackProps {
    environment?: string;
    existingStorageBucket?: string;
    existingUploadsBucket?: string;
    existingAssetsBucket?: string;
    existingLogsBucket?: string;
    existingAdminFrontendBucket?: string;
    existingVendorFrontendBucket?: string;
    existingCustomerFrontendBucket?: string;
}
export declare class S3Stack extends Construct {
    readonly storageBucket: s3.IBucket;
    readonly uploadsBucket: s3.IBucket;
    readonly assetsBucket: s3.IBucket;
    readonly logsBucket: s3.IBucket;
    readonly adminFrontendBucket?: s3.IBucket;
    readonly vendorFrontendBucket?: s3.IBucket;
    readonly customerFrontendBucket?: s3.IBucket;
    readonly distribution?: cloudfront.IDistribution;
    readonly apkBucket?: s3.IBucket;
    readonly apkDistribution?: cloudfront.IDistribution;
    constructor(scope: Construct, id: string, props?: S3StackProps);
}
//# sourceMappingURL=s3-stack.d.ts.map
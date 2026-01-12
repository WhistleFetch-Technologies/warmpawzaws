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

import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export interface S3StackProps {
  environment?: string;
  // Optional: Use existing buckets
  existingStorageBucket?: string;
  existingUploadsBucket?: string;
  existingAssetsBucket?: string;
  existingLogsBucket?: string;
  existingAdminFrontendBucket?: string;
  existingVendorFrontendBucket?: string;
  existingCustomerFrontendBucket?: string;
}

export class S3Stack extends Construct {
  public readonly storageBucket: s3.IBucket;
  public readonly uploadsBucket: s3.IBucket;
  public readonly assetsBucket: s3.IBucket;
  public readonly logsBucket: s3.IBucket;
  public readonly adminFrontendBucket?: s3.IBucket;
  public readonly vendorFrontendBucket?: s3.IBucket;
  public readonly customerFrontendBucket?: s3.IBucket;
  public readonly distribution?: cloudfront.IDistribution;
  public readonly apkBucket?: s3.IBucket;
  public readonly apkDistribution?: cloudfront.IDistribution;

  constructor(scope: Construct, id: string, props?: S3StackProps) {
    super(scope, id);

    const environment = props?.environment || 'dev';

    // ========================================================================
    // STORAGE BUCKET
    // ========================================================================
    if (props?.existingStorageBucket) {
      console.log(`[S3Stack] Using existing storage bucket: ${props.existingStorageBucket}`);
      this.storageBucket = s3.Bucket.fromBucketName(
        this,
        'StorageBucket',
        props.existingStorageBucket
      );
    } else {
      console.log('[S3Stack] Creating new storage bucket');
      this.storageBucket = new s3.Bucket(this, 'StorageBucket', {
        versioned: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        lifecycleRules: [
          {
            id: 'TransitionToIA',
            enabled: true,
            transitions: [
              {
                storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                transitionAfter: cdk.Duration.days(90),
              },
            ],
          },
        ],
      });
    }

    // ========================================================================
    // UPLOADS BUCKET
    // ========================================================================
    if (props?.existingUploadsBucket) {
      console.log(`[S3Stack] Using existing uploads bucket: ${props.existingUploadsBucket}`);
      this.uploadsBucket = s3.Bucket.fromBucketName(
        this,
        'UploadsBucket',
        props.existingUploadsBucket
      );
    } else {
      console.log('[S3Stack] Creating new uploads bucket');
      this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
        versioned: true,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        cors: [
          {
            allowedOrigins: ['*'],
            allowedMethods: [
              s3.HttpMethods.GET,
              s3.HttpMethods.PUT,
              s3.HttpMethods.POST,
              s3.HttpMethods.DELETE,
            ],
            allowedHeaders: ['*'],
            maxAge: 3000,
          },
        ],
      });
    }

    // ========================================================================
    // ASSETS BUCKET
    // ========================================================================
    if (props?.existingAssetsBucket) {
      console.log(`[S3Stack] Using existing assets bucket: ${props.existingAssetsBucket}`);
      this.assetsBucket = s3.Bucket.fromBucketName(
        this,
        'AssetsBucket',
        props.existingAssetsBucket
      );
    } else {
      console.log('[S3Stack] Creating new assets bucket');
      this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
        versioned: false,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        publicReadAccess: false,
      });
    }

    // CloudFront distribution for assets (only if we created the bucket)
    if (!props?.existingAssetsBucket) {
      this.distribution = new cloudfront.Distribution(this, 'AssetsDistribution', {
        defaultBehavior: {
          origin: new origins.S3Origin(this.assetsBucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
          cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
        comment: 'Warmpawz Assets CDN',
      });
    }

    // ========================================================================
    // LOGS BUCKET
    // ========================================================================
    if (props?.existingLogsBucket) {
      console.log(`[S3Stack] Using existing logs bucket: ${props.existingLogsBucket}`);
      this.logsBucket = s3.Bucket.fromBucketName(
        this,
        'LogsBucket',
        props.existingLogsBucket
      );
    } else {
      console.log('[S3Stack] Creating new logs bucket');
      this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
        versioned: false,
        encryption: s3.BucketEncryption.S3_MANAGED,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        lifecycleRules: [
          {
            id: 'DeleteOldLogs',
            enabled: true,
            expiration: cdk.Duration.days(30),
          },
        ],
      });
    }

    // ========================================================================
    // FRONTEND BUCKETS (From CI/CD Pattern)
    // ========================================================================
    if (props?.existingAdminFrontendBucket) {
      this.adminFrontendBucket = s3.Bucket.fromBucketName(
        this,
        'AdminFrontendBucket',
        props.existingAdminFrontendBucket
      );
    }

    if (props?.existingVendorFrontendBucket) {
      this.vendorFrontendBucket = s3.Bucket.fromBucketName(
        this,
        'VendorFrontendBucket',
        props.existingVendorFrontendBucket
      );
    }

    if (props?.existingCustomerFrontendBucket) {
      this.customerFrontendBucket = s3.Bucket.fromBucketName(
        this,
        'CustomerFrontendBucket',
        props.existingCustomerFrontendBucket
      );
    }

    // ========================================================================
    // APK BUCKET (Optional - for mobile apps)
    // ========================================================================
    // Only create if not using existing buckets pattern
    // APK bucket is optional and can be created separately if needed
  }
}

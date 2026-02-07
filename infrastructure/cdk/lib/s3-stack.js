"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.S3Stack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const s3 = __importStar(require("aws-cdk-lib/aws-s3"));
const cloudfront = __importStar(require("aws-cdk-lib/aws-cloudfront"));
const origins = __importStar(require("aws-cdk-lib/aws-cloudfront-origins"));
const constructs_1 = require("constructs");
class S3Stack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props?.environment || 'dev';
        // ========================================================================
        // STORAGE BUCKET
        // ========================================================================
        if (props?.existingStorageBucket) {
            console.log(`[S3Stack] Using existing storage bucket: ${props.existingStorageBucket}`);
            this.storageBucket = s3.Bucket.fromBucketName(this, 'StorageBucket', props.existingStorageBucket);
        }
        else {
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
            this.uploadsBucket = s3.Bucket.fromBucketName(this, 'UploadsBucket', props.existingUploadsBucket);
        }
        else {
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
            this.assetsBucket = s3.Bucket.fromBucketName(this, 'AssetsBucket', props.existingAssetsBucket);
        }
        else {
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
            this.logsBucket = s3.Bucket.fromBucketName(this, 'LogsBucket', props.existingLogsBucket);
        }
        else {
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
            this.adminFrontendBucket = s3.Bucket.fromBucketName(this, 'AdminFrontendBucket', props.existingAdminFrontendBucket);
        }
        if (props?.existingVendorFrontendBucket) {
            this.vendorFrontendBucket = s3.Bucket.fromBucketName(this, 'VendorFrontendBucket', props.existingVendorFrontendBucket);
        }
        if (props?.existingCustomerFrontendBucket) {
            this.customerFrontendBucket = s3.Bucket.fromBucketName(this, 'CustomerFrontendBucket', props.existingCustomerFrontendBucket);
        }
        // ========================================================================
        // APK BUCKET (Optional - for mobile apps)
        // ========================================================================
        // Only create if not using existing buckets pattern
        // APK bucket is optional and can be created separately if needed
    }
}
exports.S3Stack = S3Stack;
//# sourceMappingURL=s3-stack.js.map
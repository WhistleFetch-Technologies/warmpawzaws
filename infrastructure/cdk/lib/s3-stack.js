"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
        // Use auto-generated bucket names to avoid conflicts
        // CDK will generate unique names based on stack name and construct ID
        // Storage bucket (general file storage)
        this.storageBucket = new s3.Bucket(this, 'StorageBucket', {
            // Removed bucketName to use auto-generated name
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
        // Uploads bucket (user uploads)
        this.uploadsBucket = new s3.Bucket(this, 'UploadsBucket', {
            // Removed bucketName to use auto-generated name
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
        // Assets bucket (static assets with CloudFront)
        this.assetsBucket = new s3.Bucket(this, 'AssetsBucket', {
            // Removed bucketName to use auto-generated name
            versioned: false,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            publicReadAccess: false,
        });
        // CloudFront distribution for assets
        // Note: S3Origin is deprecated but still functional. Will update to S3BucketOrigin in future CDK version.
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
        // Logs bucket
        this.logsBucket = new s3.Bucket(this, 'LogsBucket', {
            // Removed bucketName to use auto-generated name
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
        // APK Storage bucket for mobile apps (iOS and Android)
        this.apkBucket = new s3.Bucket(this, 'ApkBucket', {
            // Removed bucketName to use auto-generated name
            versioned: true,
            encryption: s3.BucketEncryption.S3_MANAGED,
            blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
            cors: [
                {
                    allowedOrigins: ['*'],
                    allowedMethods: [
                        s3.HttpMethods.GET,
                        s3.HttpMethods.HEAD,
                    ],
                    allowedHeaders: ['*'],
                    maxAge: 3600,
                },
            ],
            lifecycleRules: [
                {
                    id: 'ArchiveOldApks',
                    enabled: true,
                    transitions: [
                        {
                            storageClass: s3.StorageClass.GLACIER,
                            transitionAfter: cdk.Duration.days(90),
                        },
                    ],
                },
            ],
        });
        // CloudFront distribution for APK downloads
        this.apkDistribution = new cloudfront.Distribution(this, 'ApkDistribution', {
            defaultBehavior: {
                origin: new origins.S3Origin(this.apkBucket),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
                cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD,
                cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
                originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
            },
            comment: 'Warmpawz APK Distribution CDN',
            defaultRootObject: 'index.html',
        });
    }
}
exports.S3Stack = S3Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiczMtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJzMy1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx1REFBeUM7QUFDekMsdUVBQXlEO0FBQ3pELDRFQUE4RDtBQUM5RCwyQ0FBdUM7QUFNdkMsTUFBYSxPQUFRLFNBQVEsc0JBQVM7SUFTcEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sV0FBVyxHQUFHLEtBQUssRUFBRSxXQUFXLElBQUksS0FBSyxDQUFDO1FBQ2hELHFEQUFxRDtRQUNyRCxzRUFBc0U7UUFFdEUsd0NBQXdDO1FBQ3hDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxFQUFFLENBQUMsTUFBTSxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDeEQsZ0RBQWdEO1lBQ2hELFNBQVMsRUFBRSxJQUFJO1lBQ2YsVUFBVSxFQUFFLEVBQUUsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVO1lBQzFDLGlCQUFpQixFQUFFLEVBQUUsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ2pELGFBQWEsRUFBRSxHQUFHLENBQUMsYUFBYSxDQUFDLE1BQU07WUFDdkMsY0FBYyxFQUFFO2dCQUNkO29CQUNFLEVBQUUsRUFBRSxnQkFBZ0I7b0JBQ3BCLE9BQU8sRUFBRSxJQUFJO29CQUNiLFdBQVcsRUFBRTt3QkFDWDs0QkFDRSxZQUFZLEVBQUUsRUFBRSxDQUFDLFlBQVksQ0FBQyxpQkFBaUI7NEJBQy9DLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7eUJBQ3ZDO3FCQUNGO2lCQUNGO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxnQ0FBZ0M7UUFDaEMsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLEVBQUUsQ0FBQyxN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c291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIHMzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zMyc7XG5pbXBvcnQgKiBhcyBjbG91ZGZyb250IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZGZyb250JztcbmltcG9ydCAqIGFzIG9yaWdpbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLWNsb3VkZnJvbnQtb3JpZ2lucyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBTM1N0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudD86IHN0cmluZzsgLy8gJ2RldicgfCAndGVzdCcgfCAncHJvZCdcbn1cblxuZXhwb3J0IGNsYXNzIFMzU3RhY2sgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgc3RvcmFnZUJ1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgdXBsb2Fkc0J1Y2tldDogczMuQnVja2V0O1xuICBwdWJsaWMgcmVhZG9ubHkgYXNzZXRzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBsb2dzQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBkaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuICBwdWJsaWMgcmVhZG9ubHkgYXBrQnVja2V0OiBzMy5CdWNrZXQ7XG4gIHB1YmxpYyByZWFkb25seSBhcGtEaXN0cmlidXRpb246IGNsb3VkZnJvbnQuRGlzdHJpYnV0aW9uO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogUzNTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHM/LmVudmlyb25tZW50IHx8ICdkZXYnO1xuICAgIC8vIFVzZSBhdXRvLWdlbmVyYXRlZCBidWNrZXQgbmFtZXMgdG8gYXZvaWQgY29uZmxpY3RzXG4gICAgLy8gQ0RLIHdpbGwgZ2VuZXJhdGUgdW5pcXVlIG5hbWVzIGJhc2VkIG9uIHN0YWNrIG5hbWUgYW5kIGNvbnN0cnVjdCBJRFxuXG4gICAgLy8gU3RvcmFnZSBidWNrZXQgKGdlbmVyYWwgZmlsZSBzdG9yYWdlKVxuICAgIHRoaXMuc3RvcmFnZUJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ1N0b3JhZ2VCdWNrZXQnLCB7XG4gICAgICAvLyBSZW1vdmVkIGJ1Y2tldE5hbWUgdG8gdXNlIGF1dG8tZ2VuZXJhdGVkIG5hbWVcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdUcmFuc2l0aW9uVG9JQScsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICB0cmFuc2l0aW9uczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBzdG9yYWdlQ2xhc3M6IHMzLlN0b3JhZ2VDbGFzcy5JTkZSRVFVRU5UX0FDQ0VTUyxcbiAgICAgICAgICAgICAgdHJhbnNpdGlvbkFmdGVyOiBjZGsuRHVyYXRpb24uZGF5cyg5MCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gVXBsb2FkcyBidWNrZXQgKHVzZXIgdXBsb2FkcylcbiAgICB0aGlzLnVwbG9hZHNCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdVcGxvYWRzQnVja2V0Jywge1xuICAgICAgLy8gUmVtb3ZlZCBidWNrZXROYW1lIHRvIHVzZSBhdXRvLWdlbmVyYXRlZCBuYW1lXG4gICAgICB2ZXJzaW9uZWQ6IHRydWUsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgcmVtb3ZhbFBvbGljeTogY2RrLlJlbW92YWxQb2xpY3kuUkVUQUlOLFxuICAgICAgY29yczogW1xuICAgICAgICB7XG4gICAgICAgICAgYWxsb3dlZE9yaWdpbnM6IFsnKiddLFxuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5HRVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QVVQsXG4gICAgICAgICAgICBzMy5IdHRwTWV0aG9kcy5QT1NULFxuICAgICAgICAgICAgczMuSHR0cE1ldGhvZHMuREVMRVRFLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFsnKiddLFxuICAgICAgICAgIG1heEFnZTogMzAwMCxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBc3NldHMgYnVja2V0IChzdGF0aWMgYXNzZXRzIHdpdGggQ2xvdWRGcm9udClcbiAgICB0aGlzLmFzc2V0c0J1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgJ0Fzc2V0c0J1Y2tldCcsIHtcbiAgICAgIC8vIFJlbW92ZWQgYnVja2V0TmFtZSB0byB1c2UgYXV0by1nZW5lcmF0ZWQgbmFtZVxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBwdWJsaWNSZWFkQWNjZXNzOiBmYWxzZSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciBhc3NldHNcbiAgICAvLyBOb3RlOiBTM09yaWdpbiBpcyBkZXByZWNhdGVkIGJ1dCBzdGlsbCBmdW5jdGlvbmFsLiBXaWxsIHVwZGF0ZSB0byBTM0J1Y2tldE9yaWdpbiBpbiBmdXR1cmUgQ0RLIHZlcnNpb24uXG4gICAgdGhpcy5kaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Fzc2V0c0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuYXNzZXRzQnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQUQsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgfSxcbiAgICAgIGNvbW1lbnQ6ICdXYXJtcGF3eiBBc3NldHMgQ0ROJyxcbiAgICB9KTtcblxuICAgIC8vIExvZ3MgYnVja2V0XG4gICAgdGhpcy5sb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCAnTG9nc0J1Y2tldCcsIHtcbiAgICAgIC8vIFJlbW92ZWQgYnVja2V0TmFtZSB0byB1c2UgYXV0by1nZW5lcmF0ZWQgbmFtZVxuICAgICAgdmVyc2lvbmVkOiBmYWxzZSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6ICdEZWxldGVPbGRMb2dzJyxcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIGV4cGlyYXRpb246IGNkay5EdXJhdGlvbi5kYXlzKDMwKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBBUEsgU3RvcmFnZSBidWNrZXQgZm9yIG1vYmlsZSBhcHBzIChpT1MgYW5kIEFuZHJvaWQpXG4gICAgdGhpcy5hcGtCdWNrZXQgPSBuZXcgczMuQnVja2V0KHRoaXMsICdBcGtCdWNrZXQnLCB7XG4gICAgICAvLyBSZW1vdmVkIGJ1Y2tldE5hbWUgdG8gdXNlIGF1dG8tZ2VuZXJhdGVkIG5hbWVcbiAgICAgIHZlcnNpb25lZDogdHJ1ZSxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICByZW1vdmFsUG9saWN5OiBjZGsuUmVtb3ZhbFBvbGljeS5SRVRBSU4sXG4gICAgICBjb3JzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogWycqJ10sXG4gICAgICAgICAgYWxsb3dlZE1ldGhvZHM6IFtcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkdFVCxcbiAgICAgICAgICAgIHMzLkh0dHBNZXRob2RzLkhFQUQsXG4gICAgICAgICAgXSxcbiAgICAgICAgICBhbGxvd2VkSGVhZGVyczogWycqJ10sXG4gICAgICAgICAgbWF4QWdlOiAzNjAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogJ0FyY2hpdmVPbGRBcGtzJyxcbiAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHRyYW5zaXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHN0b3JhZ2VDbGFzczogczMuU3RvcmFnZUNsYXNzLkdMQUNJRVIsXG4gICAgICAgICAgICAgIHRyYW5zaXRpb25BZnRlcjogY2RrLkR1cmF0aW9uLmRheXMoOTApLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnQgZGlzdHJpYnV0aW9uIGZvciBBUEsgZG93bmxvYWRzXG4gICAgdGhpcy5hcGtEaXN0cmlidXRpb24gPSBuZXcgY2xvdWRmcm9udC5EaXN0cmlidXRpb24odGhpcywgJ0Fwa0Rpc3RyaWJ1dGlvbicsIHtcbiAgICAgIGRlZmF1bHRCZWhhdmlvcjoge1xuICAgICAgICBvcmlnaW46IG5ldyBvcmlnaW5zLlMzT3JpZ2luKHRoaXMuYXBrQnVja2V0KSxcbiAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6IGNsb3VkZnJvbnQuVmlld2VyUHJvdG9jb2xQb2xpY3kuUkVESVJFQ1RfVE9fSFRUUFMsXG4gICAgICAgIGFsbG93ZWRNZXRob2RzOiBjbG91ZGZyb250LkFsbG93ZWRNZXRob2RzLkFMTE9XX0dFVF9IRUFELFxuICAgICAgICBjYWNoZWRNZXRob2RzOiBjbG91ZGZyb250LkNhY2hlZE1ldGhvZHMuQ0FDSEVfR0VUX0hFQUQsXG4gICAgICAgIGNhY2hlUG9saWN5OiBjbG91ZGZyb250LkNhY2hlUG9saWN5LkNBQ0hJTkdfT1BUSU1JWkVELFxuICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5OiBjbG91ZGZyb250Lk9yaWdpblJlcXVlc3RQb2xpY3kuQ09SU19TM19PUklHSU4sXG4gICAgICB9LFxuICAgICAgY29tbWVudDogJ1dhcm1wYXd6IEFQSyBEaXN0cmlidXRpb24gQ0ROJyxcbiAgICAgIGRlZmF1bHRSb290T2JqZWN0OiAnaW5kZXguaHRtbCcsXG4gICAgfSk7XG4gIH1cbn1cblxuIl19
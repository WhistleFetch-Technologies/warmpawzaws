import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import { Construct } from 'constructs';
export interface S3StackProps {
    environment?: string;
}
export declare class S3Stack extends Construct {
    readonly storageBucket: s3.Bucket;
    readonly uploadsBucket: s3.Bucket;
    readonly assetsBucket: s3.Bucket;
    readonly logsBucket: s3.Bucket;
    readonly distribution: cloudfront.Distribution;
    readonly apkBucket: s3.Bucket;
    readonly apkDistribution: cloudfront.Distribution;
    constructor(scope: Construct, id: string, props?: S3StackProps);
}

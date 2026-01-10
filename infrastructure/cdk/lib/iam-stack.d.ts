/**
 * ============================================================================
 * IAM STACK - AWS PERMISSIONS FOR WARMPAWZ LAMBDA
 * ============================================================================
 *
 * Defines all IAM roles and permissions for Lambda functions
 *
 * Services Covered:
 * - RDS Proxy access
 * - Secrets Manager
 * - S3 buckets
 * - Cognito user pools
 * - SNS topics
 * - SQS queues
 * - DynamoDB tables
 * - Bedrock AI models
 * - Chime SDK (video/chat)
 * - OpenSearch (search)
 * - EventBridge
 * - CloudWatch Logs
 *
 * Date: 2026-01-02
 * ============================================================================
 */
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
import { AuroraStack } from './aurora-stack';
import { S3Stack } from './s3-stack';
import { CognitoStack } from './cognito-stack';
export interface IamStackProps {
    auroraStack: AuroraStack;
    s3Stack: S3Stack;
    cognitoStack: CognitoStack;
}
export declare class IamStack extends Construct {
    readonly lambdaExecutionRole: iam.Role;
    constructor(scope: Construct, id: string, props: IamStackProps);
}
//# sourceMappingURL=iam-stack.d.ts.map
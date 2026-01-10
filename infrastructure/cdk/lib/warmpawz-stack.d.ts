/**
 * ============================================================================
 * AWS CDK MAIN STACK - WARMPAWZ PLATFORM
 * ============================================================================
 *
 * Main CDK stack that wires all infrastructure components together
 * - VPC (single VPC lookup)
 * - RDS Aurora (PostgreSQL)
 * - Cognito (3 user pools: customer, vendor, admin)
 * - Lambda (single API handler with Hono routing)
 * - API Gateway (HTTP API v2 with proxy routes)
 * - S3 + CloudFront (3 web apps)
 * - Route53 (custom domains)
 *
 * Date: 2026-01-08
 * ============================================================================
 */
import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { AuroraStack } from './aurora-stack';
import { CognitoStack } from './cognito-stack';
import { S3Stack } from './s3-stack';
import { ApiGatewayStack } from './api-gateway-stack';
import { Route53Stack } from './route53-stack';
import { IamStack } from './iam-stack';
import { SecurityStack } from './security-stack';
import { SqsStack } from './sqs-stack';
import { SnsStack } from './sns-stack';
import { DynamoDbStack } from './dynamodb-stack';
import { ChimeStack } from './chime-stack';
import { EventBridgeStack } from './eventbridge-stack';
import { LambdaStack } from './lambda-stack';
export interface WarmpawzStackProps extends cdk.StackProps {
    environment?: string;
}
export declare class WarmpawzStack extends cdk.Stack {
    readonly vpc: ec2.IVpc;
    readonly auroraStack: AuroraStack;
    readonly cognitoStack: CognitoStack;
    readonly s3Stack: S3Stack;
    readonly apiGatewayStack: ApiGatewayStack;
    readonly route53Stack: Route53Stack;
    readonly iamStack: IamStack;
    readonly securityStack: SecurityStack;
    readonly sqsStack: SqsStack;
    readonly snsStack: SnsStack;
    readonly dynamoDbStack: DynamoDbStack;
    readonly chimeStack: ChimeStack;
    readonly eventBridgeStack: EventBridgeStack;
    readonly lambdaStack: LambdaStack;
    constructor(scope: Construct, id: string, props?: WarmpawzStackProps);
}
//# sourceMappingURL=warmpawz-stack.d.ts.map
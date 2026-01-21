/**
 * ============================================================================
 * AWS CDK STACK - LAMBDA FUNCTIONS
 * ============================================================================
 *
 * Defines Lambda functions for all API endpoints
 * Uses single Lambda function with Hono routing for all endpoints
 *
 * Date: 2026-01-08
 * ============================================================================
 */
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import { AuroraStack } from './aurora-stack';
import { S3Stack } from './s3-stack';
import { CognitoStack } from './cognito-stack';
import { IamStack } from './iam-stack';
import { SecurityStack } from './security-stack';
import { SqsStack } from './sqs-stack';
import { SnsStack } from './sns-stack';
import { DynamoDbStack } from './dynamodb-stack';
export interface LambdaStackProps {
    auroraStack: AuroraStack;
    s3Stack: S3Stack;
    cognitoStack: CognitoStack;
    iamStack: IamStack;
    securityStack: SecurityStack;
    sqsStack: SqsStack;
    snsStack: SnsStack;
    dynamoDbStack: DynamoDbStack;
    vpc: ec2.IVpc;
    environment?: string;
}
export declare class LambdaStack extends Construct {
    readonly apiFunction: lambda.Function;
    readonly notificationProcessor: lambda.Function;
    readonly emailProcessor: lambda.Function;
    readonly smsProcessor: lambda.Function;
    readonly analyticsProcessor: lambda.Function;
    readonly settlementProcessor: lambda.Function;
    readonly functions: Map<string, lambda.Function>;
    constructor(scope: Construct, id: string, props: LambdaStackProps);
}
//# sourceMappingURL=lambda-stack.d.ts.map
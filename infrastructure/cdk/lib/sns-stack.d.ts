/**
 * AWS CDK STACK - SNS TOPICS
 * Defines SNS topics for pub/sub messaging
 */
import * as sns from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';
import { SqsStack } from './sqs-stack';
export interface SnsStackProps {
    sqsStack: SqsStack;
    environment?: string;
}
export declare class SnsStack extends Construct {
    readonly bookingCreatedTopic: sns.Topic;
    readonly paymentProcessedTopic: sns.Topic;
    readonly vendorApprovedTopic: sns.Topic;
    readonly notificationTopic: sns.Topic;
    readonly analyticsTopic: sns.Topic;
    constructor(scope: Construct, id: string, props: SnsStackProps);
}
//# sourceMappingURL=sns-stack.d.ts.map
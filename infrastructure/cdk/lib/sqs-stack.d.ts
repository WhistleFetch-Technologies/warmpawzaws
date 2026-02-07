/**
 * AWS CDK STACK - SQS QUEUES
 * Defines SQS queues for async processing
 */
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';
export interface SqsStackProps {
    environment?: string;
}
export declare class SqsStack extends Construct {
    readonly notificationQueue: sqs.Queue;
    readonly notificationDlq: sqs.Queue;
    readonly emailQueue: sqs.Queue;
    readonly emailDlq: sqs.Queue;
    readonly smsQueue: sqs.Queue;
    readonly smsDlq: sqs.Queue;
    readonly analyticsQueue: sqs.Queue;
    readonly analyticsDlq: sqs.Queue;
    readonly settlementQueue: sqs.Queue;
    readonly settlementDlq: sqs.Queue;
    constructor(scope: Construct, id: string, props?: SqsStackProps);
}
//# sourceMappingURL=sqs-stack.d.ts.map
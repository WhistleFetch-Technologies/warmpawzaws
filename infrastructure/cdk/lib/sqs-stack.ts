/**
 * AWS CDK STACK - SQS QUEUES
 * Defines SQS queues for async processing
 */

import * as cdk from 'aws-cdk-lib';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import { Construct } from 'constructs';

export interface SqsStackProps {
  environment?: string;
}

export class SqsStack extends Construct {
  public readonly notificationQueue: sqs.Queue;
  public readonly notificationDlq: sqs.Queue;
  public readonly emailQueue: sqs.Queue;
  public readonly emailDlq: sqs.Queue;
  public readonly smsQueue: sqs.Queue;
  public readonly smsDlq: sqs.Queue;
  public readonly analyticsQueue: sqs.Queue;
  public readonly analyticsDlq: sqs.Queue;
  public readonly settlementQueue: sqs.Queue;
  public readonly settlementDlq: sqs.Queue;

  constructor(scope: Construct, id: string, props?: SqsStackProps) {
    super(scope, id);

    const env = props?.environment || 'dev';

    // Notification DLQ
    this.notificationDlq = new sqs.Queue(this, 'NotificationDlq', {
      queueName: `warmpawz-${env}-notification-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Notification Queue
    this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
      queueName: `warmpawz-${env}-notification`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: this.notificationDlq, maxReceiveCount: 3 },
    });

    // Email DLQ
    this.emailDlq = new sqs.Queue(this, 'EmailDlq', {
      queueName: `warmpawz-${env}-email-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Email Queue
    this.emailQueue = new sqs.Queue(this, 'EmailQueue', {
      queueName: `warmpawz-${env}-email`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: this.emailDlq, maxReceiveCount: 3 },
    });

    // SMS DLQ
    this.smsDlq = new sqs.Queue(this, 'SmsDlq', {
      queueName: `warmpawz-${env}-sms-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // SMS Queue
    this.smsQueue = new sqs.Queue(this, 'SmsQueue', {
      queueName: `warmpawz-${env}-sms`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: this.smsDlq, maxReceiveCount: 3 },
    });

    // Analytics DLQ
    this.analyticsDlq = new sqs.Queue(this, 'AnalyticsDlq', {
      queueName: `warmpawz-${env}-analytics-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Analytics Queue
    this.analyticsQueue = new sqs.Queue(this, 'AnalyticsQueue', {
      queueName: `warmpawz-${env}-analytics`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: this.analyticsDlq, maxReceiveCount: 3 },
    });

    // Settlement DLQ
    this.settlementDlq = new sqs.Queue(this, 'SettlementDlq', {
      queueName: `warmpawz-${env}-settlement-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Settlement Queue
    this.settlementQueue = new sqs.Queue(this, 'SettlementQueue', {
      queueName: `warmpawz-${env}-settlement`,
      visibilityTimeout: cdk.Duration.seconds(300),
      deadLetterQueue: { queue: this.settlementDlq, maxReceiveCount: 3 },
    });
  }
}

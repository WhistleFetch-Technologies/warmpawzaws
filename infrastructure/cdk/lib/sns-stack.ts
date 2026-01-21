/**
 * AWS CDK STACK - SNS TOPICS
 * Defines SNS topics for pub/sub messaging
 */

import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';
import { SqsStack } from './sqs-stack';

export interface SnsStackProps {
  sqsStack: SqsStack;
  environment?: string;
}

export class SnsStack extends Construct {
  public readonly bookingCreatedTopic: sns.Topic;
  public readonly paymentProcessedTopic: sns.Topic;
  public readonly vendorApprovedTopic: sns.Topic;
  public readonly notificationTopic: sns.Topic;
  public readonly analyticsTopic: sns.Topic;

  constructor(scope: Construct, id: string, props: SnsStackProps) {
    super(scope, id);

    const env = props.environment || 'dev';

    // Booking Created Topic
    this.bookingCreatedTopic = new sns.Topic(this, 'BookingCreatedTopic', {
      topicName: `warmpawz-${env}-booking-created`,
      displayName: 'Booking Created Notifications',
    });

    // Payment Processed Topic
    this.paymentProcessedTopic = new sns.Topic(this, 'PaymentProcessedTopic', {
      topicName: `warmpawz-${env}-payment-processed`,
      displayName: 'Payment Processed Notifications',
    });

    // Vendor Approved Topic
    this.vendorApprovedTopic = new sns.Topic(this, 'VendorApprovedTopic', {
      topicName: `warmpawz-${env}-vendor-approved`,
      displayName: 'Vendor Approved Notifications',
    });

    // General Notification Topic
    this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
      topicName: `warmpawz-${env}-notifications`,
      displayName: 'General Notifications',
    });

    // Analytics Topic
    this.analyticsTopic = new sns.Topic(this, 'AnalyticsTopic', {
      topicName: `warmpawz-${env}-analytics`,
      displayName: 'Analytics Events',
    });

    // Subscribe queues to topics
    this.notificationTopic.addSubscription(
      new subs.SqsSubscription(props.sqsStack.notificationQueue)
    );

    this.analyticsTopic.addSubscription(
      new subs.SqsSubscription(props.sqsStack.analyticsQueue)
    );
  }
}

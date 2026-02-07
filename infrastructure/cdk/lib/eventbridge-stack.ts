/**
 * AWS CDK STACK - EVENTBRIDGE
 * Defines EventBridge event bus and rules
 */

import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { SqsStack } from './sqs-stack';
import { SnsStack } from './sns-stack';

export interface EventBridgeStackProps {
  sqsStack: SqsStack;
  snsStack: SnsStack;
  environment?: string;
}

export class EventBridgeStack extends Construct {
  public readonly eventBus: events.EventBus;

  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id);

    const env = props.environment || 'dev';

    // Create EventBus
    this.eventBus = new events.EventBus(this, 'EventBus', {
      eventBusName: `warmpawz-${env}-events`,
      description: 'Warmpawz platform event bus',
    });

    // Rule for booking events
    new events.Rule(this, 'BookingEventsRule', {
      eventBus: this.eventBus,
      ruleName: `warmpawz-${env}-booking-events`,
      description: 'Route booking events to notification queue',
      eventPattern: {
        source: ['warmpawz.booking'],
        detailType: ['BookingCreated', 'BookingConfirmed', 'BookingCancelled'],
      },
      targets: [
        new targets.SqsQueue(props.sqsStack.notificationQueue),
        new targets.SnsTopic(props.snsStack.bookingCreatedTopic),
      ],
    });

    // Rule for payment events
    new events.Rule(this, 'PaymentEventsRule', {
      eventBus: this.eventBus,
      ruleName: `warmpawz-${env}-payment-events`,
      description: 'Route payment events to processing queue',
      eventPattern: {
        source: ['warmpawz.payment'],
        detailType: ['PaymentReceived', 'PaymentFailed', 'RefundProcessed'],
      },
      targets: [
        new targets.SnsTopic(props.snsStack.paymentProcessedTopic),
      ],
    });

    // Rule for analytics events
    new events.Rule(this, 'AnalyticsEventsRule', {
      eventBus: this.eventBus,
      ruleName: `warmpawz-${env}-analytics-events`,
      description: 'Route analytics events to analytics queue',
      eventPattern: {
        source: ['warmpawz'],
        detailType: events.Match.prefix('Analytics'),
      },
      targets: [
        new targets.SqsQueue(props.sqsStack.analyticsQueue),
      ],
    });

    // Rule for settlement events
    new events.Rule(this, 'SettlementEventsRule', {
      eventBus: this.eventBus,
      ruleName: `warmpawz-${env}-settlement-events`,
      description: 'Route settlement events to settlement queue',
      eventPattern: {
        source: ['warmpawz.settlement'],
        detailType: ['SettlementDue', 'SettlementProcessed'],
      },
      targets: [
        new targets.SqsQueue(props.sqsStack.settlementQueue),
      ],
    });
  }
}

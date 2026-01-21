/**
 * AWS CDK STACK - DYNAMODB TABLES
 * Defines DynamoDB tables for high-throughput data
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoDbStackProps {
  environment?: string;
}

export class DynamoDbStack extends Construct {
  public readonly logsTable: dynamodb.Table;
  public readonly analyticsTable: dynamodb.Table;
  public readonly reportsTable: dynamodb.Table;
  public readonly chatMessagesTable: dynamodb.Table;
  public readonly aiConversationsTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DynamoDbStackProps) {
    super(scope, id);

    const env = props?.environment || 'dev';

    // Logs Table
    this.logsTable = new dynamodb.Table(this, 'LogsTable', {
      tableName: `warmpawz-${env}-logs`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
    });

    // Analytics Table
    this.analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
      tableName: `warmpawz-${env}-analytics`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Reports Table
    this.reportsTable = new dynamodb.Table(this, 'ReportsTable', {
      tableName: `warmpawz-${env}-reports`,
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Chat Messages Table
    this.chatMessagesTable = new dynamodb.Table(this, 'ChatMessagesTable', {
      tableName: `warmpawz-${env}-chat-messages`,
      partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'messageId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      timeToLiveAttribute: 'ttl',
    });

    // AI Conversations Table
    this.aiConversationsTable = new dynamodb.Table(this, 'AiConversationsTable', {
      tableName: `warmpawz-${env}-ai-conversations`,
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
    });

    // Add GSI for chat messages by user
    this.chatMessagesTable.addGlobalSecondaryIndex({
      indexName: 'userMessages',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });
  }
}

/**
 * ============================================================================
 * AWS CDK STACK - DYNAMODB TABLES (Enhanced - Uses Existing Resources)
 * ============================================================================
 * 
 * Enhanced to support existing DynamoDB tables
 * - Uses existing tables if useExistingTables is true
 * - Creates new tables only if useExistingTables is false
 * 
 * Date: 2026-01-27
 * ============================================================================
 */

import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export interface DynamoDbStackProps {
  environment?: string;
  // Optional: Use existing tables instead of creating new ones
  useExistingTables?: boolean;
}

export class DynamoDbStack extends Construct {
  public readonly logsTable: dynamodb.ITable;
  public readonly analyticsTable: dynamodb.ITable;
  public readonly reportsTable: dynamodb.ITable;
  public readonly chatMessagesTable: dynamodb.ITable;
  public readonly aiConversationsTable: dynamodb.ITable;

  constructor(scope: Construct, id: string, props?: DynamoDbStackProps) {
    super(scope, id);

    const env = props?.environment || 'dev';
    const useExisting = props?.useExistingTables ?? true; // Default to using existing tables

    // Table names
    const logsTableName = `warmpawz-${env}-logs`;
    const analyticsTableName = `warmpawz-${env}-analytics`;
    const reportsTableName = `warmpawz-${env}-reports`;
    const chatMessagesTableName = `warmpawz-${env}-chat-messages`;
    const aiConversationsTableName = `warmpawz-${env}-ai-conversations`;

    if (useExisting) {
      // ========================================================================
      // USE EXISTING TABLES
      // ========================================================================
      console.log(`[DynamoDbStack] Using existing DynamoDB tables for environment: ${env}`);

      this.logsTable = dynamodb.Table.fromTableName(this, 'LogsTable', logsTableName);
      console.log(`[DynamoDbStack] Referenced existing table: ${logsTableName}`);

      this.analyticsTable = dynamodb.Table.fromTableName(this, 'AnalyticsTable', analyticsTableName);
      console.log(`[DynamoDbStack] Referenced existing table: ${analyticsTableName}`);

      this.reportsTable = dynamodb.Table.fromTableName(this, 'ReportsTable', reportsTableName);
      console.log(`[DynamoDbStack] Referenced existing table: ${reportsTableName}`);

      this.chatMessagesTable = dynamodb.Table.fromTableName(this, 'ChatMessagesTable', chatMessagesTableName);
      console.log(`[DynamoDbStack] Referenced existing table: ${chatMessagesTableName}`);

      this.aiConversationsTable = dynamodb.Table.fromTableName(this, 'AiConversationsTable', aiConversationsTableName);
      console.log(`[DynamoDbStack] Referenced existing table: ${aiConversationsTableName}`);

    } else {
      // ========================================================================
      // CREATE NEW TABLES
      // ========================================================================
      console.log(`[DynamoDbStack] Creating new DynamoDB tables for environment: ${env}`);

      // Logs Table
      this.logsTable = new dynamodb.Table(this, 'LogsTable', {
        tableName: logsTableName,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        timeToLiveAttribute: 'ttl',
      });

      // Analytics Table
      this.analyticsTable = new dynamodb.Table(this, 'AnalyticsTable', {
        tableName: analyticsTableName,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      });

      // Reports Table
      this.reportsTable = new dynamodb.Table(this, 'ReportsTable', {
        tableName: reportsTableName,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      });

      // Chat Messages Table
      const chatMessagesTable = new dynamodb.Table(this, 'ChatMessagesTable', {
        tableName: chatMessagesTableName,
        partitionKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'messageId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
        timeToLiveAttribute: 'ttl',
      });
      this.chatMessagesTable = chatMessagesTable;

      // AI Conversations Table
      this.aiConversationsTable = new dynamodb.Table(this, 'AiConversationsTable', {
        tableName: aiConversationsTableName,
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'conversationId', type: dynamodb.AttributeType.STRING },
        billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
        removalPolicy: cdk.RemovalPolicy.RETAIN,
        pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      });

      // Add GSI for chat messages by user (only for new tables)
      chatMessagesTable.addGlobalSecondaryIndex({
        indexName: 'userMessages',
        partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
      });
    }
  }
}

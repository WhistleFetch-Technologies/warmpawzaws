"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DynamoDbStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const dynamodb = __importStar(require("aws-cdk-lib/aws-dynamodb"));
const constructs_1 = require("constructs");
class DynamoDbStack extends constructs_1.Construct {
    constructor(scope, id, props) {
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
        }
        else {
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
exports.DynamoDbStack = DynamoDbStack;
//# sourceMappingURL=dynamodb-stack.js.map
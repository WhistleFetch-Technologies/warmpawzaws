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
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface DynamoDbStackProps {
    environment?: string;
    useExistingTables?: boolean;
}
export declare class DynamoDbStack extends Construct {
    readonly logsTable: dynamodb.ITable;
    readonly analyticsTable: dynamodb.ITable;
    readonly reportsTable: dynamodb.ITable;
    readonly chatMessagesTable: dynamodb.ITable;
    readonly aiConversationsTable: dynamodb.ITable;
    constructor(scope: Construct, id: string, props?: DynamoDbStackProps);
}
//# sourceMappingURL=dynamodb-stack.d.ts.map
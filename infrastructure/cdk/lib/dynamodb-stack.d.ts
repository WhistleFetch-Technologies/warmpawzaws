import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface DynamoDbStackProps {
    environment?: string;
}
export declare class DynamoDbStack extends Construct {
    readonly logsTable: dynamodb.Table;
    readonly analyticsTable: dynamodb.Table;
    readonly reportsTable: dynamodb.Table;
    readonly chatMessagesTable: dynamodb.Table;
    readonly aiConversationsTable: dynamodb.Table;
    constructor(scope: Construct, id: string, props?: DynamoDbStackProps);
}

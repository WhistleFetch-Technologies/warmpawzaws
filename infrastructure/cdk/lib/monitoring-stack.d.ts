/**
 * ============================================================================
 * WARMPAWZ PLATFORM - CLOUDWATCH MONITORING STACK
 * ============================================================================
 *
 * Creates:
 * - CloudWatch Dashboard for real-time monitoring
 * - CloudWatch Alarms for critical metrics
 * - SNS topics for alarm notifications
 * - Lambda log insights queries
 *
 * Usage:
 *   npm run cdk deploy MonitoringStack
 *
 * ============================================================================
 */
import * as cdk from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as rds from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';
export interface MonitoringStackProps extends cdk.StackProps {
    apiId: string;
    lambdaFunctions: lambda.Function[];
    dbInstance?: rds.IDatabaseInstance;
    environment: 'development' | 'staging' | 'production';
}
export declare class MonitoringStack extends cdk.Stack {
    readonly alarmTopic: sns.Topic;
    readonly dashboard: cloudwatch.Dashboard;
    constructor(scope: Construct, id: string, props: MonitoringStackProps);
}
//# sourceMappingURL=monitoring-stack.d.ts.map
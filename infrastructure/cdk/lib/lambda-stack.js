"use strict";
/**
 * ============================================================================
 * AWS CDK STACK - LAMBDA FUNCTIONS
 * ============================================================================
 *
 * Defines Lambda functions for all API endpoints
 * Uses single Lambda function with Hono routing for all endpoints
 *
 * Date: 2026-01-08
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
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const lambdaEventSources = __importStar(require("aws-cdk-lib/aws-lambda-event-sources"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const logs = __importStar(require("aws-cdk-lib/aws-logs"));
const constructs_1 = require("constructs");
class LambdaStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props.environment || 'dev';
        // Lambda Layer for shared code (optional)
        let sharedLayer;
        try {
            sharedLayer = new lambda.LayerVersion(this, 'SharedLayer', {
                code: lambda.Code.fromAsset('../../backend/shared'),
                compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
                description: 'Shared utilities and database clients',
            });
        }
        catch (error) {
            // Layer is optional - Lambda will work without it
            console.warn('Shared layer not available, Lambda will use bundled code only');
        }
        // Main API Lambda Function
        // Note: Code must be built before deployment (npm run build in backend/lambda)
        this.apiFunction = new lambda.Function(this, 'ApiFunction', {
            functionName: `warmpawz-api-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/handler.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                // Exclude source files - only include dist and node_modules
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(60), // Increased from 30s to 60s to handle complex queries and reduce timeout errors
            memorySize: 512,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc, // Single VPC used for all resources
            vpcSubnets: {
                // Use public subnets (default VPC typically only has public subnets)
                // Lambda can access RDS Proxy from public subnets if security groups allow
                subnetType: ec2.SubnetType.PUBLIC,
            },
            allowPublicSubnet: true, // Required for Lambda in public subnets
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            logRetention: environment === 'prod'
                ? logs.RetentionDays.THREE_MONTHS
                : environment === 'stage'
                    ? logs.RetentionDays.ONE_MONTH
                    : logs.RetentionDays.ONE_WEEK,
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                // Database (using RDS Proxy or direct cluster)
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy?.endpoint || props.auroraStack.cluster.clusterEndpoint.hostname,
                AURORA_SECRET_ARN: props.auroraStack.secret.secretArn,
                AURORA_DATABASE: 'warmpawz',
                // Cognito
                COGNITO_CUSTOMER_POOL_ID: props.cognitoStack.customerPool.userPoolId,
                COGNITO_CUSTOMER_CLIENT_ID: props.cognitoStack.customerPoolClient.userPoolClientId,
                COGNITO_VENDOR_POOL_ID: props.cognitoStack.vendorPool.userPoolId,
                COGNITO_VENDOR_CLIENT_ID: props.cognitoStack.vendorPoolClient.userPoolClientId,
                COGNITO_ADMIN_POOL_ID: props.cognitoStack.adminPool.userPoolId,
                COGNITO_ADMIN_CLIENT_ID: props.cognitoStack.adminPoolClient.userPoolClientId,
                // S3
                S3_STORAGE_BUCKET: props.s3Stack.storageBucket.bucketName,
                S3_UPLOADS_BUCKET: props.s3Stack.uploadsBucket.bucketName,
                S3_ASSETS_BUCKET: props.s3Stack.assetsBucket.bucketName,
                S3_LOGS_BUCKET: props.s3Stack.logsBucket.bucketName,
                // SQS
                SQS_NOTIFICATION_QUEUE_URL: props.sqsStack.notificationQueue.queueUrl,
                SQS_EMAIL_QUEUE_URL: props.sqsStack.emailQueue.queueUrl,
                SQS_SMS_QUEUE_URL: props.sqsStack.smsQueue.queueUrl,
                SQS_ANALYTICS_QUEUE_URL: props.sqsStack.analyticsQueue.queueUrl,
                SQS_SETTLEMENT_QUEUE_URL: props.sqsStack.settlementQueue.queueUrl,
                // SNS
                SNS_BOOKING_CREATED_TOPIC_ARN: props.snsStack.bookingCreatedTopic.topicArn,
                SNS_PAYMENT_PROCESSED_TOPIC_ARN: props.snsStack.paymentProcessedTopic.topicArn,
                SNS_VENDOR_APPROVED_TOPIC_ARN: props.snsStack.vendorApprovedTopic.topicArn,
                SNS_NOTIFICATION_TOPIC_ARN: props.snsStack.notificationTopic.topicArn,
                SNS_ANALYTICS_TOPIC_ARN: props.snsStack.analyticsTopic.topicArn,
                // DynamoDB
                DYNAMODB_LOGS_TABLE: props.dynamoDbStack.logsTable.tableName,
                DYNAMODB_ANALYTICS_TABLE: props.dynamoDbStack.analyticsTable.tableName,
                DYNAMODB_REPORTS_TABLE: props.dynamoDbStack.reportsTable.tableName,
                DYNAMODB_CHAT_MESSAGES_TABLE: props.dynamoDbStack.chatMessagesTable.tableName,
                DYNAMODB_AI_CONVERSATIONS_TABLE: props.dynamoDbStack.aiConversationsTable.tableName,
                // CORS
                ALLOW_ORIGIN: environment === 'prod' ? 'https://warmpawz.com' : '*',
            },
            description: 'Main Warmpawz API Lambda function - handles all API requests',
        });
        // Grant additional permissions via CDK grant methods (more secure than inline policies)
        // SQS permissions
        props.sqsStack.notificationQueue.grantSendMessages(this.apiFunction);
        props.sqsStack.emailQueue.grantSendMessages(this.apiFunction);
        props.sqsStack.smsQueue.grantSendMessages(this.apiFunction);
        props.sqsStack.analyticsQueue.grantSendMessages(this.apiFunction);
        props.sqsStack.settlementQueue.grantSendMessages(this.apiFunction);
        // SNS permissions
        props.snsStack.bookingCreatedTopic.grantPublish(this.apiFunction);
        props.snsStack.paymentProcessedTopic.grantPublish(this.apiFunction);
        props.snsStack.vendorApprovedTopic.grantPublish(this.apiFunction);
        props.snsStack.notificationTopic.grantPublish(this.apiFunction);
        props.snsStack.analyticsTopic.grantPublish(this.apiFunction);
        // DynamoDB permissions
        props.dynamoDbStack.logsTable.grantReadWriteData(this.apiFunction);
        props.dynamoDbStack.analyticsTable.grantReadWriteData(this.apiFunction);
        props.dynamoDbStack.reportsTable.grantReadWriteData(this.apiFunction);
        props.dynamoDbStack.chatMessagesTable.grantReadWriteData(this.apiFunction);
        props.dynamoDbStack.aiConversationsTable.grantReadWriteData(this.apiFunction);
        // ============================================================================
        // QUEUE PROCESSOR LAMBDA FUNCTIONS
        // ============================================================================
        // These functions process messages from SQS queues
        // Notification Queue Processor
        this.notificationProcessor = new lambda.Function(this, 'NotificationProcessor', {
            functionName: `warmpawz-notification-processor-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/jobs/notification-processor.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            allowPublicSubnet: true,
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            logRetention: environment === 'prod'
                ? logs.RetentionDays.THREE_MONTHS
                : environment === 'stage'
                    ? logs.RetentionDays.ONE_MONTH
                    : logs.RetentionDays.ONE_WEEK,
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy?.endpoint || props.auroraStack.cluster.clusterEndpoint.hostname,
                AURORA_SECRET_ARN: props.auroraStack.secret.secretArn,
                AURORA_DATABASE: 'warmpawz',
                // AWS_REGION is automatically set by Lambda runtime
                NOTIFICATION_QUEUE_URL: props.sqsStack.notificationQueue.queueUrl,
            },
            description: 'Processes notifications from notification queue',
        });
        // Email Queue Processor
        this.emailProcessor = new lambda.Function(this, 'EmailProcessor', {
            functionName: `warmpawz-email-processor-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/jobs/email-processor.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(60),
            memorySize: 256,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            allowPublicSubnet: true,
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            logRetention: environment === 'prod'
                ? logs.RetentionDays.THREE_MONTHS
                : environment === 'stage'
                    ? logs.RetentionDays.ONE_MONTH
                    : logs.RetentionDays.ONE_WEEK,
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy?.endpoint || props.auroraStack.cluster.clusterEndpoint.hostname,
                AURORA_SECRET_ARN: props.auroraStack.secret.secretArn,
                AURORA_DATABASE: 'warmpawz',
                // AWS_REGION is automatically set by Lambda runtime
                SES_FROM_EMAIL: process.env.SES_FROM_EMAIL || 'noreply@warmpawz.com',
            },
            description: 'Processes emails from email queue',
        });
        // SMS Queue Processor
        this.smsProcessor = new lambda.Function(this, 'SmsProcessor', {
            functionName: `warmpawz-sms-processor-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/jobs/sms-processor.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            allowPublicSubnet: true,
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            logRetention: environment === 'prod'
                ? logs.RetentionDays.THREE_MONTHS
                : environment === 'stage'
                    ? logs.RetentionDays.ONE_MONTH
                    : logs.RetentionDays.ONE_WEEK,
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy?.endpoint || props.auroraStack.cluster.clusterEndpoint.hostname,
                AURORA_SECRET_ARN: props.auroraStack.secret.secretArn,
                AURORA_DATABASE: 'warmpawz',
                // AWS_REGION is automatically set by Lambda runtime
                SMS_QUEUE_URL: props.sqsStack.smsQueue.queueUrl,
            },
            description: 'Processes SMS from SMS queue',
        });
        // Analytics Queue Processor
        this.analyticsProcessor = new lambda.Function(this, 'AnalyticsProcessor', {
            functionName: `warmpawz-analytics-processor-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/jobs/analytics-processor.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(30),
            memorySize: 256,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            allowPublicSubnet: true,
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            logRetention: environment === 'prod'
                ? logs.RetentionDays.THREE_MONTHS
                : environment === 'stage'
                    ? logs.RetentionDays.ONE_MONTH
                    : logs.RetentionDays.ONE_WEEK,
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy?.endpoint || props.auroraStack.cluster.clusterEndpoint.hostname,
                AURORA_SECRET_ARN: props.auroraStack.secret.secretArn,
                AURORA_DATABASE: 'warmpawz',
                // AWS_REGION is automatically set by Lambda runtime
                ANALYTICS_QUEUE_URL: props.sqsStack.analyticsQueue.queueUrl,
            },
            description: 'Processes analytics events from analytics queue',
        });
        // Settlement Queue Processor
        this.settlementProcessor = new lambda.Function(this, 'SettlementProcessor', {
            functionName: `warmpawz-settlement-processor-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/jobs/settlement-processor.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(60),
            memorySize: 512,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc,
            vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
            allowPublicSubnet: true,
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            logRetention: environment === 'prod'
                ? logs.RetentionDays.THREE_MONTHS
                : environment === 'stage'
                    ? logs.RetentionDays.ONE_MONTH
                    : logs.RetentionDays.ONE_WEEK,
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy?.endpoint || props.auroraStack.cluster.clusterEndpoint.hostname,
                AURORA_SECRET_ARN: props.auroraStack.secret.secretArn,
                AURORA_DATABASE: 'warmpawz',
                // AWS_REGION is automatically set by Lambda runtime
                SETTLEMENT_QUEUE_URL: props.sqsStack.settlementQueue.queueUrl,
                RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID || '',
                RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || '',
            },
            description: 'Processes settlements from settlement queue',
        });
        // ============================================================================
        // EVENT SOURCE MAPPINGS - Connect SQS Queues to Lambda Functions
        // ============================================================================
        // Notification Queue → Notification Processor
        this.notificationProcessor.addEventSource(new lambdaEventSources.SqsEventSource(props.sqsStack.notificationQueue, {
            batchSize: 10,
            maxBatchingWindow: cdk.Duration.seconds(5),
        }));
        props.sqsStack.notificationQueue.grantConsumeMessages(this.notificationProcessor);
        // Email Queue → Email Processor
        this.emailProcessor.addEventSource(new lambdaEventSources.SqsEventSource(props.sqsStack.emailQueue, {
            batchSize: 10,
            maxBatchingWindow: cdk.Duration.seconds(5),
        }));
        props.sqsStack.emailQueue.grantConsumeMessages(this.emailProcessor);
        // SMS Queue → SMS Processor
        this.smsProcessor.addEventSource(new lambdaEventSources.SqsEventSource(props.sqsStack.smsQueue, {
            batchSize: 10,
            maxBatchingWindow: cdk.Duration.seconds(5),
        }));
        props.sqsStack.smsQueue.grantConsumeMessages(this.smsProcessor);
        // Analytics Queue → Analytics Processor
        this.analyticsProcessor.addEventSource(new lambdaEventSources.SqsEventSource(props.sqsStack.analyticsQueue, {
            batchSize: 10,
            maxBatchingWindow: cdk.Duration.seconds(5),
        }));
        props.sqsStack.analyticsQueue.grantConsumeMessages(this.analyticsProcessor);
        // Settlement Queue → Settlement Processor
        this.settlementProcessor.addEventSource(new lambdaEventSources.SqsEventSource(props.sqsStack.settlementQueue, {
            batchSize: 5,
            maxBatchingWindow: cdk.Duration.seconds(10),
        }));
        props.sqsStack.settlementQueue.grantConsumeMessages(this.settlementProcessor);
        // Grant additional permissions
        // SNS permissions for notification processor (for push notifications)
        props.snsStack.notificationTopic.grantPublish(this.notificationProcessor);
        // SES permissions for email processor
        // Note: SES permissions should be added via IAM role policies
        // SNS permissions for SMS processor
        // Note: SNS SMS permissions should be added via IAM role policies
        // Store functions in map for easy access
        this.functions = new Map();
        this.functions.set('api', this.apiFunction);
        this.functions.set('notification-processor', this.notificationProcessor);
        this.functions.set('email-processor', this.emailProcessor);
        this.functions.set('sms-processor', this.smsProcessor);
        this.functions.set('analytics-processor', this.analyticsProcessor);
        this.functions.set('settlement-processor', this.settlementProcessor);
    }
}
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=lambda-stack.js.map
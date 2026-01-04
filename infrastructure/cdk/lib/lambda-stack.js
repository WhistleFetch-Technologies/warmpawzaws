"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LambdaStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const lambda = __importStar(require("aws-cdk-lib/aws-lambda"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
class LambdaStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props.environment || 'dev';
        // Lambda Layer for shared code (optional - create only if directory exists)
        // Note: Path is relative to CDK project root (infrastructure/cdk), so we need to go up two levels
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
        // For now, using the source directory - bundling will be done via CI/CD
        this.apiFunction = new lambda.Function(this, 'ApiFunction', {
            functionName: `warmpawz-api-${environment}`,
            runtime: lambda.Runtime.NODEJS_20_X,
            handler: 'dist/src/handler.handler',
            code: lambda.Code.fromAsset('../../backend/lambda', {
                // Bundling disabled - will be done via CI/CD pipeline
                // Lambda code should be pre-built before CDK deployment
                exclude: ['node_modules', '*.ts', '!*.d.ts', 'tsconfig.json', '.git'],
            }),
            layers: sharedLayer ? [sharedLayer] : undefined,
            timeout: cdk.Duration.seconds(30),
            memorySize: 512,
            role: props.iamStack.lambdaExecutionRole,
            vpc: props.vpc,
            vpcSubnets: {
                // Use public subnets (default VPC typically only has public subnets)
                // Lambda can access RDS Proxy from public subnets if security groups allow
                subnetType: ec2.SubnetType.PUBLIC,
            },
            allowPublicSubnet: true,
            securityGroups: [props.securityStack.lambdaSecurityGroup],
            environment: {
                NODE_ENV: environment === 'prod' ? 'production' : 'development',
                // Note: AWS_REGION is automatically set by Lambda runtime
                // Database
                AURORA_PROXY_ENDPOINT: props.auroraStack.proxy.endpoint,
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
        // Grant additional permissions
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
        // Store functions in map for easy access
        this.functions = new Map();
        this.functions.set('api', this.apiFunction);
        // Note: Additional service-specific Lambda functions can be added here
        // For now, using a single monolithic function as per existing handler.ts structure
        // Future decomposition can split into:
        // - booking-service
        // - payment-service
        // - vendor-service
        // - customer-service
        // - admin-service
        // - notification-service
        // - ai-service
        // - video-service
    }
}
exports.LambdaStack = LambdaStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibGFtYmRhLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibGFtYmRhLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLCtEQUFpRDtBQUVqRCx5REFBMkM7QUFDM0MsMkNBQXVDO0FBdUJ2QyxNQUFhLFdBQVksU0FBUSxzQkFBUztJQUl4QyxZQUFZLEtBQWdCLEVBQUUsRUFBVSxFQUFFLEtBQXVCO1FBQy9ELEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7UUFFakIsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsSUFBSSxLQUFLLENBQUM7UUFFL0MsNEVBQTRFO1FBQzVFLGtHQUFrRztRQUNsRyxJQUFJLFdBQTRDLENBQUM7UUFDakQsSUFBSTtZQUNGLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtnQkFDekQsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLHNCQUFzQixDQUFDO2dCQUNuRCxrQkFBa0IsRUFBRSxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDO2dCQUNoRCxXQUFXLEVBQUUsdUNBQXVDO2FBQ3JELENBQUMsQ0FBQztTQUNKO1FBQUMsT0FBTyxLQUFLLEVBQUU7WUFDZCxrREFBa0Q7WUFDbEQsT0FBTyxDQUFDLElBQUksQ0FBQywrREFBK0QsQ0FBQyxDQUFDO1NBQy9FO1FBRUQsMkJBQTJCO1FBQzNCLCtFQUErRTtRQUMvRSx3RUFBd0U7UUFDeEUsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLE1BQU0sQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLGFBQWEsRUFBRTtZQUMxRCxZQUFZLEVBQUUsZ0JBQWdCLFdBQVcsRUFBRTtZQUMzQyxPQUFPLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxXQUFXO1lBQ25DLE9BQU8sRUFBRSww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QUMsS0FBSyxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUU1Qyx1RUFBdUU7UUFDdkUsbUZBQW1GO1FBQ25GLHVDQUF1QztRQUN2QyxvQkFBb0I7UUFDcEIsb0JBQW9CO1FBQ3BCLG1CQUFtQjtRQUNuQixxQkFBcUI7UUFDckIsa0JBQWtCO1FBQ2xCLHlCQUF5QjtRQUN6QixlQUFlO1FBQ2Ysa0JBQWtCO0lBQ3BCLENBQUM7Q0FDRjtBQWhJRCxrQ0FnSUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgbGFtYmRhIGZyb20gJ2F3cy1jZGstbGliL2F3cy1sYW1iZGEnO1xuaW1wb3J0ICogYXMgaWFtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1pYW0nO1xuaW1wb3J0ICogYXMgZWMyIGZyb20gJ2F3cy1jZGstbGliL2F3cy1lYzInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBBdXJvcmFTdGFjayB9IGZyb20gJy4vYXVyb3JhLXN0YWNrJztcbmltcG9ydCB7IFMzU3RhY2sgfSBmcm9tICcuL3MzLXN0YWNrJztcbmltcG9ydCB7IENvZ25pdG9TdGFjayB9IGZyb20gJy4vY29nbml0by1zdGFjayc7XG5pbXBvcnQgeyBJYW1TdGFjayB9IGZyb20gJy4vaWFtLXN0YWNrJztcbmltcG9ydCB7IFNlY3VyaXR5U3RhY2sgfSBmcm9tICcuL3NlY3VyaXR5LXN0YWNrJztcbmltcG9ydCB7IFNxc1N0YWNrIH0gZnJvbSAnLi9zcXMtc3RhY2snO1xuaW1wb3J0IHsgU25zU3RhY2sgfSBmcm9tICcuL3Nucy1zdGFjayc7XG5pbXBvcnQgeyBEeW5hbW9EYlN0YWNrIH0gZnJvbSAnLi9keW5hbW9kYi1zdGFjayc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgTGFtYmRhU3RhY2tQcm9wcyB7XG4gIGF1cm9yYVN0YWNrOiBBdXJvcmFTdGFjaztcbiAgczNTdGFjazogUzNTdGFjaztcbiAgY29nbml0b1N0YWNrOiBDb2duaXRvU3RhY2s7XG4gIGlhbVN0YWNrOiBJYW1TdGFjaztcbiAgc2VjdXJpdHlTdGFjazogU2VjdXJpdHlTdGFjaztcbiAgc3FzU3RhY2s6IFNxc1N0YWNrO1xuICBzbnNTdGFjazogU25zU3RhY2s7XG4gIGR5bmFtb0RiU3RhY2s6IER5bmFtb0RiU3RhY2s7XG4gIHZwYzogZWMyLklWcGM7XG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgTGFtYmRhU3RhY2sgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgYXBpRnVuY3Rpb246IGxhbWJkYS5GdW5jdGlvbjtcbiAgcHVibGljIHJlYWRvbmx5IGZ1bmN0aW9uczogTWFwPHN0cmluZywgbGFtYmRhLkZ1bmN0aW9uPjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogTGFtYmRhU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHByb3BzLmVudmlyb25tZW50IHx8ICdkZXYnO1xuXG4gICAgLy8gTGFtYmRhIExheWVyIGZvciBzaGFyZWQgY29kZSAob3B0aW9uYWwgLSBjcmVhdGUgb25seSBpZiBkaXJlY3RvcnkgZXhpc3RzKVxuICAgIC8vIE5vdGU6IFBhdGggaXMgcmVsYXRpdmUgdG8gQ0RLIHByb2plY3Qgcm9vdCAoaW5mcmFzdHJ1Y3R1cmUvY2RrKSwgc28gd2UgbmVlZCB0byBnbyB1cCB0d28gbGV2ZWxzXG4gICAgbGV0IHNoYXJlZExheWVyOiBsYW1iZGEuTGF5ZXJWZXJzaW9uIHwgdW5kZWZpbmVkO1xuICAgIHRyeSB7XG4gICAgICBzaGFyZWRMYXllciA9IG5ldyBsYW1iZGEuTGF5ZXJWZXJzaW9uKHRoaXMsICdTaGFyZWRMYXllcicsIHtcbiAgICAgICAgY29kZTogbGFtYmRhLkNvZGUuZnJvbUFzc2V0KCcuLi8uLi9iYWNrZW5kL3NoYXJlZCcpLFxuICAgICAgICBjb21wYXRpYmxlUnVudGltZXM6IFtsYW1iZGEuUnVudGltZS5OT0RFSlNfMjBfWF0sXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnU2hhcmVkIHV0aWxpdGllcyBhbmQgZGF0YWJhc2UgY2xpZW50cycsXG4gICAgICB9KTtcbiAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgLy8gTGF5ZXIgaXMgb3B0aW9uYWwgLSBMYW1iZGEgd2lsbCB3b3JrIHdpdGhvdXQgaXRcbiAgICAgIGNvbnNvbGUud2FybignU2hhcmVkIGxheWVyIG5vdCBhdmFpbGFibGUsIExhbWJkYSB3aWxsIHVzZSBidW5kbGVkIGNvZGUgb25seScpO1xuICAgIH1cblxuICAgIC8vIE1haW4gQVBJIExhbWJkYSBGdW5jdGlvblxuICAgIC8vIE5vdGU6IENvZGUgbXVzdCBiZSBidWlsdCBiZWZvcmUgZGVwbG95bWVudCAobnBtIHJ1biBidWlsZCBpbiBiYWNrZW5kL2xhbWJkYSlcbiAgICAvLyBGb3Igbm93LCB1c2luZyB0aGUgc291cmNlIGRpcmVjdG9yeSAtIGJ1bmRsaW5nIHdpbGwgYmUgZG9uZSB2aWEgQ0kvQ0RcbiAgICB0aGlzLmFwaUZ1bmN0aW9uID0gbmV3IGxhbWJkYS5GdW5jdGlvbih0aGlzLCAnQXBpRnVuY3Rpb24nLCB7XG4gICAgICBmdW5jdGlvbk5hbWU6IGB3YXJtcGF3ei1hcGktJHtlbnZpcm9ubWVudH1gLFxuICAgICAgcnVudGltZTogbGFtYmRhLlJ1bnRpbWUuTk9ERUpTXzIwX1gsXG4gICAgICBoYW5kbGVyOiAnZGlzdC9zcmMvaGFuZGxlci5oYW5kbGVyJyxcbiAgICAgIGNvZGU6IGxhbWJkYS5Db2RlLmZyb21Bc3NldCgnLi4vLi4vYmFja2VuZC9sYW1iZGEnLCB7XG4gICAgICAgIC8vIEJ1bmRsaW5nIGRpc2FibGVkIC0gd2lsbCBiZSBkb25lIHZpYSBDSS9DRCBwaXBlbGluZVxuICAgICAgICAvLyBMYW1iZGEgY29kZSBzaG91bGQgYmUgcHJlLWJ1aWx0IGJlZm9yZSBDREsgZGVwbG95bWVudFxuICAgICAgICBleGNsdWRlOiBbJ25vZGVfbW9kdWxlcycsICcqLnRzJywgJyEqLmQudHMnLCAndHNjb25maWcuanNvbicsICcuZ2l0J10sXG4gICAgICB9KSxcbiAgICAgIGxheWVyczogc2hhcmVkTGF5ZXIgPyBbc2hhcmVkTGF5ZXJdIDogdW5kZWZpbmVkLFxuICAgICAgdGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgbWVtb3J5U2l6ZTogNTEyLFxuICAgICAgcm9sZTogcHJvcHMuaWFtU3RhY2subGFtYmRhRXhlY3V0aW9uUm9sZSxcbiAgICAgIHZwYzogcHJvcHMudnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICAvLyBVc2UgcHVibGljIHN1Ym5ldHMgKGRlZmF1bHQgVlBDIHR5cGljYWxseSBvbmx5IGhhcyBwdWJsaWMgc3VibmV0cylcbiAgICAgICAgLy8gTGFtYmRhIGNhbiBhY2Nlc3MgUkRTIFByb3h5IGZyb20gcHVibGljIHN1Ym5ldHMgaWYgc2VjdXJpdHkgZ3JvdXBzIGFsbG93XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBVQkxJQyxcbiAgICAgIH0sXG4gICAgICBhbGxvd1B1YmxpY1N1Ym5ldDogdHJ1ZSwgLy8gUmVxdWlyZWQgZm9yIExhbWJkYSBpbiBwdWJsaWMgc3VibmV0cyB0byBhY2Nlc3MgaW50ZXJuZXRcbiAgICAgIHNlY3VyaXR5R3JvdXBzOiBbcHJvcHMuc2VjdXJpdHlTdGFjay5sYW1iZGFTZWN1cml0eUdyb3VwXSxcbiAgICAgIGVudmlyb25tZW50OiB7XG4gICAgICAgIE5PREVfRU5WOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJ3Byb2R1Y3Rpb24nIDogJ2RldmVsb3BtZW50JyxcbiAgICAgICAgLy8gTm90ZTogQVdTX1JFR0lPTiBpcyBhdXRvbWF0aWNhbGx5IHNldCBieSBMYW1iZGEgcnVudGltZVxuICAgICAgICAvLyBEYXRhYmFzZVxuICAgICAgICBBVVJPUkFfUFJPWFlfRU5EUE9JTlQ6IHByb3BzLmF1cm9yYVN0YWNrLnByb3h5LmVuZHBvaW50LFxuICAgICAgICBBVVJPUkFfU0VDUkVUX0FSTjogcHJvcHMuYXVyb3JhU3RhY2suc2VjcmV0LnNlY3JldEFybixcbiAgICAgICAgQVVST1JBX0RBVEFCQVNFOiAnd2FybXBhd3onLFxuICAgICAgICAvLyBDb2duaXRvXG4gICAgICAgIENPR05JVE9fQ1VTVE9NRVJfUE9PTF9JRDogcHJvcHMuY29nbml0b1N0YWNrLmN1c3RvbWVyUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBDT0dOSVRPX0NVU1RPTUVSX0NMSUVOVF9JRDogcHJvcHMuY29nbml0b1N0YWNrLmN1c3RvbWVyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICBDT0dOSVRPX1ZFTkRPUl9QT09MX0lEOiBwcm9wcy5jb2duaXRvU3RhY2sudmVuZG9yUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBDT0dOSVRPX1ZFTkRPUl9DTElFTlRfSUQ6IHByb3BzLmNvZ25pdG9TdGFjay52ZW5kb3JQb29sQ2xpZW50LnVzZXJQb29sQ2xpZW50SWQsXG4gICAgICAgIENPR05JVE9fQURNSU5fUE9PTF9JRDogcHJvcHMuY29nbml0b1N0YWNrLmFkbWluUG9vbC51c2VyUG9vbElkLFxuICAgICAgICBDT0dOSVRPX0FETUlOX0NMSUVOVF9JRDogcHJvcHMuY29nbml0b1N0YWNrLmFkbWluUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgICAvLyBTM1xuICAgICAgICBTM19TVE9SQUdFX0JVQ0tFVDogcHJvcHMuczNTdGFjay5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICAgIFMzX1VQTE9BRFNfQlVDS0VUOiBwcm9wcy5zM1N0YWNrLnVwbG9hZHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfQVNTRVRTX0JVQ0tFVDogcHJvcHMuczNTdGFjay5hc3NldHNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgUzNfTE9HU19CVUNLRVQ6IHByb3BzLnMzU3RhY2subG9nc0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgICAvLyBTUVNcbiAgICAgICAgU1FTX05PVElGSUNBVElPTl9RVUVVRV9VUkw6IHByb3BzLnNxc1N0YWNrLm5vdGlmaWNhdGlvblF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgICBTUVNfRU1BSUxfUVVFVUVfVVJMOiBwcm9wcy5zcXNTdGFjay5lbWFpbFF1ZXVlLnF1ZXVlVXJsLFxuICAgICAgICBTUVNfU01TX1FVRVVFX1VSTDogcHJvcHMuc3FzU3RhY2suc21zUXVldWUucXVldWVVcmwsXG4gICAgICAgIFNRU19BTkFMWVRJQ1NfUVVFVUVfVVJMOiBwcm9wcy5zcXNTdGFjay5hbmFseXRpY3NRdWV1ZS5xdWV1ZVVybCxcbiAgICAgICAgU1FTX1NFVFRMRU1FTlRfUVVFVUVfVVJMOiBwcm9wcy5zcXNTdGFjay5zZXR0bGVtZW50UXVldWUucXVldWVVcmwsXG4gICAgICAgIC8vIFNOU1xuICAgICAgICBTTlNfQk9PS0lOR19DUkVBVEVEX1RPUElDX0FSTjogcHJvcHMuc25zU3RhY2suYm9va2luZ0NyZWF0ZWRUb3BpYy50b3BpY0FybixcbiAgICAgICAgU05TX1BBWU1FTlRfUFJPQ0VTU0VEX1RPUElDX0FSTjogcHJvcHMuc25zU3RhY2sucGF5bWVudFByb2Nlc3NlZFRvcGljLnRvcGljQXJuLFxuICAgICAgICBTTlNfVkVORE9SX0FQUFJPVkVEX1RPUElDX0FSTjogcHJvcHMuc25zU3RhY2sudmVuZG9yQXBwcm92ZWRUb3BpYy50b3BpY0FybixcbiAgICAgICAgU05TX05PVElGSUNBVElPTl9UT1BJQ19BUk46IHByb3BzLnNuc1N0YWNrLm5vdGlmaWNhdGlvblRvcGljLnRvcGljQXJuLFxuICAgICAgICBTTlNfQU5BTFlUSUNTX1RPUElDX0FSTjogcHJvcHMuc25zU3RhY2suYW5hbHl0aWNzVG9waWMudG9waWNBcm4sXG4gICAgICAgIC8vIER5bmFtb0RCXG4gICAgICAgIERZTkFNT0RCX0xPR1NfVEFCTEU6IHByb3BzLmR5bmFtb0RiU3RhY2subG9nc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRFlOQU1PREJfQU5BTFlUSUNTX1RBQkxFOiBwcm9wcy5keW5hbW9EYlN0YWNrLmFuYWx5dGljc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRFlOQU1PREJfUkVQT1JUU19UQUJMRTogcHJvcHMuZHluYW1vRGJTdGFjay5yZXBvcnRzVGFibGUudGFibGVOYW1lLFxuICAgICAgICBEWU5BTU9EQl9DSEFUX01FU1NBR0VTX1RBQkxFOiBwcm9wcy5keW5hbW9EYlN0YWNrLmNoYXRNZXNzYWdlc1RhYmxlLnRhYmxlTmFtZSxcbiAgICAgICAgRFlOQU1PREJfQUlfQ09OVkVSU0FUSU9OU19UQUJMRTogcHJvcHMuZHluYW1vRGJTdGFjay5haUNvbnZlcnNhdGlvbnNUYWJsZS50YWJsZU5hbWUsXG4gICAgICAgIC8vIENPUlNcbiAgICAgICAgQUxMT1dfT1JJR0lOOiBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJ2h0dHBzOi8vd2FybXBhd3ouY29tJyA6ICcqJyxcbiAgICAgIH0sXG4gICAgICBkZXNjcmlwdGlvbjogJ01haW4gV2FybXBhd3ogQVBJIExhbWJkYSBmdW5jdGlvbiAtIGhhbmRsZXMgYWxsIEFQSSByZXF1ZXN0cycsXG4gICAgfSk7XG5cbiAgICAvLyBHcmFudCBhZGRpdGlvbmFsIHBlcm1pc3Npb25zXG4gICAgLy8gU1FTIHBlcm1pc3Npb25zXG4gICAgcHJvcHMuc3FzU3RhY2subm90aWZpY2F0aW9uUXVldWUuZ3JhbnRTZW5kTWVzc2FnZXModGhpcy5hcGlGdW5jdGlvbik7XG4gICAgcHJvcHMuc3FzU3RhY2suZW1haWxRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5zcXNTdGFjay5zbXNRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5zcXNTdGFjay5hbmFseXRpY3NRdWV1ZS5ncmFudFNlbmRNZXNzYWdlcyh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5zcXNTdGFjay5zZXR0bGVtZW50UXVldWUuZ3JhbnRTZW5kTWVzc2FnZXModGhpcy5hcGlGdW5jdGlvbik7XG5cbiAgICAvLyBTTlMgcGVybWlzc2lvbnNcbiAgICBwcm9wcy5zbnNTdGFjay5ib29raW5nQ3JlYXRlZFRvcGljLmdyYW50UHVibGlzaCh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5zbnNTdGFjay5wYXltZW50UHJvY2Vzc2VkVG9waWMuZ3JhbnRQdWJsaXNoKHRoaXMuYXBpRnVuY3Rpb24pO1xuICAgIHByb3BzLnNuc1N0YWNrLnZlbmRvckFwcHJvdmVkVG9waWMuZ3JhbnRQdWJsaXNoKHRoaXMuYXBpRnVuY3Rpb24pO1xuICAgIHByb3BzLnNuc1N0YWNrLm5vdGlmaWNhdGlvblRvcGljLmdyYW50UHVibGlzaCh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5zbnNTdGFjay5hbmFseXRpY3NUb3BpYy5ncmFudFB1Ymxpc2godGhpcy5hcGlGdW5jdGlvbik7XG5cbiAgICAvLyBEeW5hbW9EQiBwZXJtaXNzaW9uc1xuICAgIHByb3BzLmR5bmFtb0RiU3RhY2subG9nc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5keW5hbW9EYlN0YWNrLmFuYWx5dGljc1RhYmxlLmdyYW50UmVhZFdyaXRlRGF0YSh0aGlzLmFwaUZ1bmN0aW9uKTtcbiAgICBwcm9wcy5keW5hbW9EYlN0YWNrLnJlcG9ydHNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hcGlGdW5jdGlvbik7XG4gICAgcHJvcHMuZHluYW1vRGJTdGFjay5jaGF0TWVzc2FnZXNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hcGlGdW5jdGlvbik7XG4gICAgcHJvcHMuZHluYW1vRGJTdGFjay5haUNvbnZlcnNhdGlvbnNUYWJsZS5ncmFudFJlYWRXcml0ZURhdGEodGhpcy5hcGlGdW5jdGlvbik7XG5cbiAgICAvLyBTdG9yZSBmdW5jdGlvbnMgaW4gbWFwIGZvciBlYXN5IGFjY2Vzc1xuICAgIHRoaXMuZnVuY3Rpb25zID0gbmV3IE1hcCgpO1xuICAgIHRoaXMuZnVuY3Rpb25zLnNldCgnYXBpJywgdGhpcy5hcGlGdW5jdGlvbik7XG5cbiAgICAvLyBOb3RlOiBBZGRpdGlvbmFsIHNlcnZpY2Utc3BlY2lmaWMgTGFtYmRhIGZ1bmN0aW9ucyBjYW4gYmUgYWRkZWQgaGVyZVxuICAgIC8vIEZvciBub3csIHVzaW5nIGEgc2luZ2xlIG1vbm9saXRoaWMgZnVuY3Rpb24gYXMgcGVyIGV4aXN0aW5nIGhhbmRsZXIudHMgc3RydWN0dXJlXG4gICAgLy8gRnV0dXJlIGRlY29tcG9zaXRpb24gY2FuIHNwbGl0IGludG86XG4gICAgLy8gLSBib29raW5nLXNlcnZpY2VcbiAgICAvLyAtIHBheW1lbnQtc2VydmljZVxuICAgIC8vIC0gdmVuZG9yLXNlcnZpY2VcbiAgICAvLyAtIGN1c3RvbWVyLXNlcnZpY2VcbiAgICAvLyAtIGFkbWluLXNlcnZpY2VcbiAgICAvLyAtIG5vdGlmaWNhdGlvbi1zZXJ2aWNlXG4gICAgLy8gLSBhaS1zZXJ2aWNlXG4gICAgLy8gLSB2aWRlby1zZXJ2aWNlXG4gIH1cbn1cblxuIl19
"use strict";
/**
 * ============================================================================
 * AWS CDK MAIN STACK - WARMPAWZ PLATFORM
 * ============================================================================
 *
 * Main CDK stack that wires all infrastructure components together
 * - VPC (single VPC lookup)
 * - RDS Aurora (PostgreSQL)
 * - Cognito (3 user pools: customer, vendor, admin)
 * - Lambda (single API handler with Hono routing)
 * - API Gateway (HTTP API v2 with proxy routes)
 * - S3 + CloudFront (3 web apps)
 * - Route53 (custom domains)
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
exports.WarmpawzStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const integrations = __importStar(require("aws-cdk-lib/aws-apigatewayv2-integrations"));
const aurora_stack_1 = require("./aurora-stack");
const cognito_stack_1 = require("./cognito-stack");
const s3_stack_1 = require("./s3-stack");
const api_gateway_stack_1 = require("./api-gateway-stack");
const route53_stack_1 = require("./route53-stack");
const iam_stack_1 = require("./iam-stack");
const security_stack_1 = require("./security-stack");
const sqs_stack_1 = require("./sqs-stack");
const sns_stack_1 = require("./sns-stack");
const dynamodb_stack_1 = require("./dynamodb-stack");
const chime_stack_1 = require("./chime-stack");
const eventbridge_stack_1 = require("./eventbridge-stack");
const lambda_stack_1 = require("./lambda-stack");
class WarmpawzStack extends cdk.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const environment = props?.environment || 'dev';
        // Use existing VPC instead of creating new one (to avoid VPC limit)
        // Lookup existing VPC - try default VPC first, then lookup by ID if provided
        const vpcId = this.node.tryGetContext('vpcId') || process.env.VPC_ID;
        if (vpcId) {
            // Import existing VPC by ID
            this.vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
                vpcId: vpcId,
            });
        }
        else {
            // Try to lookup default VPC (most common case)
            // If this fails, user needs to provide VPC ID via: cdk deploy --context vpcId=vpc-xxxxx
            this.vpc = ec2.Vpc.fromLookup(this, 'DefaultVpc', {
                isDefault: true,
            });
        }
        // Deploy Aurora RDS
        this.auroraStack = new aurora_stack_1.AuroraStack(this, 'AuroraStack', {
            vpc: this.vpc,
        });
        // Deploy Cognito User Pools (3 separate pools for customer, vendor, admin)
        this.cognitoStack = new cognito_stack_1.CognitoStack(this, 'CognitoStack');
        // Deploy Security Groups
        this.securityStack = new security_stack_1.SecurityStack(this, 'SecurityStack', {
            vpc: this.vpc,
        });
        // Deploy S3 Buckets (needed before IAM stack)
        this.s3Stack = new s3_stack_1.S3Stack(this, 'S3Stack', {
            environment: environment,
        });
        // Deploy IAM Roles and Policies
        this.iamStack = new iam_stack_1.IamStack(this, 'IamStack', {
            auroraStack: this.auroraStack,
            s3Stack: this.s3Stack,
            cognitoStack: this.cognitoStack,
        });
        // Deploy SQS Queues (needed before SNS)
        this.sqsStack = new sqs_stack_1.SqsStack(this, 'SqsStack', {
            environment: environment,
        });
        // Deploy SNS Topics (needed before EventBridge and Lambda)
        this.snsStack = new sns_stack_1.SnsStack(this, 'SnsStack', {
            sqsStack: this.sqsStack,
            environment: environment,
        });
        // Deploy DynamoDB Tables
        this.dynamoDbStack = new dynamodb_stack_1.DynamoDbStack(this, 'DynamoDbStack', {
            environment: environment,
        });
        // Deploy Chime Stack (for video calls)
        this.chimeStack = new chime_stack_1.ChimeStack(this, 'ChimeStack', {
            environment: environment,
        });
        // Deploy EventBridge (needed after SNS and SQS)
        this.eventBridgeStack = new eventbridge_stack_1.EventBridgeStack(this, 'EventBridgeStack', {
            sqsStack: this.sqsStack,
            snsStack: this.snsStack,
            environment: environment,
        });
        // Deploy Lambda Functions (needs all other stacks)
        this.lambdaStack = new lambda_stack_1.LambdaStack(this, 'LambdaStack', {
            auroraStack: this.auroraStack,
            s3Stack: this.s3Stack,
            cognitoStack: this.cognitoStack,
            iamStack: this.iamStack,
            securityStack: this.securityStack,
            sqsStack: this.sqsStack,
            snsStack: this.snsStack,
            dynamoDbStack: this.dynamoDbStack,
            vpc: this.vpc,
            environment: environment,
        });
        // Deploy API Gateway (without custom domain first)
        this.apiGatewayStack = new api_gateway_stack_1.ApiGatewayStack(this, 'ApiGatewayStack', {
            cognitoStack: this.cognitoStack,
            environment: environment,
        });
        // Wire Lambda to API Gateway
        const lambdaIntegration = new integrations.HttpLambdaIntegration('LambdaIntegration', this.lambdaStack.apiFunction);
        // IMPORTANT: Route ordering matters!
        // More specific routes must be added BEFORE the catch-all route
        // In HTTP API v2, routes are matched by specificity, but explicit ordering ensures correct behavior
        // 1. Health check route (public, no auth) - most specific
        this.apiGatewayStack.api.addRoutes({
            path: '/health',
            methods: [apigateway.HttpMethod.GET],
            integration: lambdaIntegration,
            // No authorizer - public route
        });
        // 2. Authorized routes (specific paths before catch-all)
        // Admin routes require admin Cognito token
        this.apiGatewayStack.addAuthorizedRoute('/admin/{proxy+}', [
            apigateway.HttpMethod.GET,
            apigateway.HttpMethod.POST,
            apigateway.HttpMethod.PUT,
            apigateway.HttpMethod.PATCH,
            apigateway.HttpMethod.DELETE,
            apigateway.HttpMethod.OPTIONS,
            apigateway.HttpMethod.HEAD,
        ], lambdaIntegration, 'admin');
        // Customer routes require customer Cognito token
        this.apiGatewayStack.addAuthorizedRoute('/customer/{proxy+}', [
            apigateway.HttpMethod.GET,
            apigateway.HttpMethod.POST,
            apigateway.HttpMethod.PUT,
            apigateway.HttpMethod.PATCH,
            apigateway.HttpMethod.DELETE,
            apigateway.HttpMethod.OPTIONS,
            apigateway.HttpMethod.HEAD,
        ], lambdaIntegration, 'customer');
        // Vendor routes require vendor Cognito token
        this.apiGatewayStack.addAuthorizedRoute('/vendor/{proxy+}', [
            apigateway.HttpMethod.GET,
            apigateway.HttpMethod.POST,
            apigateway.HttpMethod.PUT,
            apigateway.HttpMethod.PATCH,
            apigateway.HttpMethod.DELETE,
            apigateway.HttpMethod.OPTIONS,
            apigateway.HttpMethod.HEAD,
        ], lambdaIntegration, 'vendor');
        // 3. Catch-all proxy route (must be LAST) - handles all other routes
        // This routes everything to Lambda, and Lambda's Hono router handles internal routing
        this.apiGatewayStack.api.addRoutes({
            path: '/{proxy+}',
            methods: [
                apigateway.HttpMethod.GET,
                apigateway.HttpMethod.POST,
                apigateway.HttpMethod.PUT,
                apigateway.HttpMethod.PATCH,
                apigateway.HttpMethod.DELETE,
                apigateway.HttpMethod.OPTIONS,
                apigateway.HttpMethod.HEAD,
            ],
            integration: lambdaIntegration,
            // No authorizer - public catch-all (authorization handled in Lambda/Hono)
        });
        // Root path handler (optional - routes to Lambda)
        this.apiGatewayStack.api.addRoutes({
            path: '/',
            methods: [
                apigateway.HttpMethod.GET,
                apigateway.HttpMethod.OPTIONS,
            ],
            integration: lambdaIntegration,
        });
        // Deploy Route53 and Custom Domain (after API Gateway)
        this.route53Stack = new route53_stack_1.Route53Stack(this, 'Route53Stack', {
            apiGatewayStack: this.apiGatewayStack,
            s3Stack: this.s3Stack,
            environment: environment,
        });
        // Update API Gateway with custom domain from Route53
        this.apiGatewayStack.addCustomDomain(this.route53Stack);
        // Create API Gateway DNS records
        this.route53Stack.createApiGatewayRecords(this.apiGatewayStack);
        // Outputs for other agents
        new cdk.CfnOutput(this, 'AuroraEndpoint', {
            value: this.auroraStack.cluster.clusterEndpoint.hostname,
            description: 'Aurora RDS Cluster Endpoint - For A4 (Backend Engineer)',
            exportName: 'Warmpawz-AuroraEndpoint',
        });
        new cdk.CfnOutput(this, 'AuroraProxyEndpoint', {
            value: this.auroraStack.proxy.endpoint,
            description: 'RDS Proxy Endpoint - For A4 (Backend Engineer)',
            exportName: 'Warmpawz-AuroraProxyEndpoint',
        });
        new cdk.CfnOutput(this, 'AuroraSecretArn', {
            value: this.auroraStack.secret.secretArn,
            description: 'Aurora RDS Secret ARN - For A4 (Backend Engineer)',
            exportName: 'Warmpawz-AuroraSecretArn',
        });
        new cdk.CfnOutput(this, 'CustomerUserPoolId', {
            value: this.cognitoStack.customerPool.userPoolId,
            description: 'Customer Cognito User Pool ID - For A6 (Mobile Engineer)',
            exportName: 'Warmpawz-CustomerUserPoolId',
        });
        new cdk.CfnOutput(this, 'CustomerUserPoolClientId', {
            value: this.cognitoStack.customerPoolClient.userPoolClientId,
            description: 'Customer Cognito Client ID - For A6 (Mobile Engineer)',
            exportName: 'Warmpawz-CustomerUserPoolClientId',
        });
        new cdk.CfnOutput(this, 'VendorUserPoolId', {
            value: this.cognitoStack.vendorPool.userPoolId,
            description: 'Vendor Cognito User Pool ID - For A6 (Mobile Engineer)',
            exportName: 'Warmpawz-VendorUserPoolId',
        });
        new cdk.CfnOutput(this, 'VendorUserPoolClientId', {
            value: this.cognitoStack.vendorPoolClient.userPoolClientId,
            description: 'Vendor Cognito Client ID - For A6 (Mobile Engineer)',
            exportName: 'Warmpawz-VendorUserPoolClientId',
        });
        new cdk.CfnOutput(this, 'AdminUserPoolId', {
            value: this.cognitoStack.adminPool.userPoolId,
            description: 'Admin Cognito User Pool ID - For Agent 3 (Auth Integration)',
            exportName: 'Warmpawz-AdminUserPoolId',
        });
        new cdk.CfnOutput(this, 'AdminUserPoolClientId', {
            value: this.cognitoStack.adminPoolClient.userPoolClientId,
            description: 'Admin Cognito Client ID - For Agent 3 (Auth Integration)',
            exportName: 'Warmpawz-AdminUserPoolClientId',
        });
        new cdk.CfnOutput(this, 'CustomerAuthorizerId', {
            value: this.apiGatewayStack.customerAuthorizer.authorizerId,
            description: 'Customer Cognito Authorizer ID - For Agent 3 (Auth Integration)',
            exportName: 'Warmpawz-CustomerAuthorizerId',
        });
        new cdk.CfnOutput(this, 'VendorAuthorizerId', {
            value: this.apiGatewayStack.vendorAuthorizer.authorizerId,
            description: 'Vendor Cognito Authorizer ID - For Agent 3 (Auth Integration)',
            exportName: 'Warmpawz-VendorAuthorizerId',
        });
        new cdk.CfnOutput(this, 'AdminAuthorizerId', {
            value: this.apiGatewayStack.adminAuthorizer.authorizerId,
            description: 'Admin Cognito Authorizer ID - For Agent 3 (Auth Integration)',
            exportName: 'Warmpawz-AdminAuthorizerId',
        });
        new cdk.CfnOutput(this, 'ApiGatewayUrl', {
            value: this.apiGatewayStack.api.url || 'Not yet deployed',
            description: 'API Gateway HTTP API URL - For A6 (Mobile Engineer) and A8 (QA)',
            exportName: 'Warmpawz-ApiGatewayUrl',
        });
        new cdk.CfnOutput(this, 'ApiGatewayId', {
            value: this.apiGatewayStack.api.httpApiId,
            description: 'API Gateway HTTP API ID - For A6 (Mobile Engineer) and A8 (QA)',
            exportName: 'Warmpawz-ApiGatewayId',
        });
        new cdk.CfnOutput(this, 'StorageBucketName', {
            value: this.s3Stack.storageBucket.bucketName,
            description: 'S3 Storage Bucket - For A4 (Backend Engineer)',
            exportName: 'Warmpawz-StorageBucketName',
        });
        new cdk.CfnOutput(this, 'UploadsBucketName', {
            value: this.s3Stack.uploadsBucket.bucketName,
            description: 'S3 Uploads Bucket - For A6 (Mobile Engineer)',
            exportName: 'Warmpawz-UploadsBucketName',
        });
        new cdk.CfnOutput(this, 'CloudFrontDomainName', {
            value: this.s3Stack.distribution.distributionDomainName,
            description: 'CloudFront Domain - For A6 (Mobile Engineer)',
            exportName: 'Warmpawz-CloudFrontDomainName',
        });
        new cdk.CfnOutput(this, 'ApiDomainName', {
            value: this.route53Stack.apiDomainName,
            description: 'API Custom Domain Name',
            exportName: 'Warmpawz-ApiDomainName',
        });
        new cdk.CfnOutput(this, 'CustomerAppDomain', {
            value: this.route53Stack.customerAppDomain,
            description: 'Customer App Domain',
            exportName: 'Warmpawz-CustomerAppDomain',
        });
        new cdk.CfnOutput(this, 'VendorAppDomain', {
            value: this.route53Stack.vendorAppDomain,
            description: 'Vendor App Domain',
            exportName: 'Warmpawz-VendorAppDomain',
        });
        new cdk.CfnOutput(this, 'AdminDomain', {
            value: this.route53Stack.adminDomain,
            description: 'Admin Portal Domain',
            exportName: 'Warmpawz-AdminDomain',
        });
        new cdk.CfnOutput(this, 'ApkBucketName', {
            value: this.s3Stack.apkBucket.bucketName,
            description: 'APK Storage Bucket - For Mobile Apps',
            exportName: 'Warmpawz-ApkBucketName',
        });
        new cdk.CfnOutput(this, 'ApkDistributionDomain', {
            value: this.s3Stack.apkDistribution.distributionDomainName,
            description: 'APK CloudFront Distribution Domain',
            exportName: 'Warmpawz-ApkDistributionDomain',
        });
        new cdk.CfnOutput(this, 'LambdaExecutionRoleArn', {
            value: this.iamStack.lambdaExecutionRole.roleArn,
            description: 'Lambda Execution Role ARN',
            exportName: 'Warmpawz-LambdaExecutionRoleArn',
        });
        new cdk.CfnOutput(this, 'LambdaFunctionArn', {
            value: this.lambdaStack.apiFunction.functionArn,
            description: 'Main Lambda Function ARN',
            exportName: `Warmpawz-${environment}-LambdaFunctionArn`,
        });
        new cdk.CfnOutput(this, 'LambdaFunctionName', {
            value: this.lambdaStack.apiFunction.functionName,
            description: 'Main Lambda Function Name',
            exportName: `Warmpawz-${environment}-LambdaFunctionName`,
        });
        new cdk.CfnOutput(this, 'NotificationQueueUrl', {
            value: this.sqsStack.notificationQueue.queueUrl,
            description: 'SQS Notification Queue URL',
            exportName: `Warmpawz-${environment}-NotificationQueueUrl`,
        });
        new cdk.CfnOutput(this, 'BookingCreatedTopicArn', {
            value: this.snsStack.bookingCreatedTopic.topicArn,
            description: 'SNS Booking Created Topic ARN',
            exportName: `Warmpawz-${environment}-BookingCreatedTopicArn`,
        });
        new cdk.CfnOutput(this, 'LogsTableName', {
            value: this.dynamoDbStack.logsTable.tableName,
            description: 'DynamoDB Logs Table Name',
            exportName: `Warmpawz-${environment}-LogsTableName`,
        });
        new cdk.CfnOutput(this, 'ChatMessagesTableName', {
            value: this.dynamoDbStack.chatMessagesTable.tableName,
            description: 'DynamoDB Chat Messages Table Name',
            exportName: `Warmpawz-${environment}-ChatMessagesTableName`,
        });
        new cdk.CfnOutput(this, 'EventBusName', {
            value: this.eventBridgeStack.eventBus.eventBusName,
            description: 'EventBridge Event Bus Name',
            exportName: `Warmpawz-${environment}-EventBusName`,
        });
        // Note: ChimeAppInstanceArn output is already created in ChimeStack
        // No need to duplicate it here
    }
}
exports.WarmpawzStack = WarmpawzStack;
//# sourceMappingURL=warmpawz-stack.js.map
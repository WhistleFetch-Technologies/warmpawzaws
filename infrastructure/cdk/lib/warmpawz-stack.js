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
        // Deploy Cognito User Pools
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
        // Deploy Chime Stack
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
        // Add routes to API Gateway
        this.apiGatewayStack.api.addRoutes({
            path: '/{proxy+}',
            methods: [
                apigateway.HttpMethod.GET,
                apigateway.HttpMethod.POST,
                apigateway.HttpMethod.PUT,
                apigateway.HttpMethod.PATCH,
                apigateway.HttpMethod.DELETE,
            ],
            integration: lambdaIntegration,
        });
        // Health check route (public, no auth)
        this.apiGatewayStack.api.addRoutes({
            path: '/health',
            methods: [apigateway.HttpMethod.GET],
            integration: lambdaIntegration,
        });
        // Example: Add admin routes with Cognito authorization
        // Admin routes require admin Cognito token
        this.apiGatewayStack.addAuthorizedRoute('/admin/{proxy+}', [
            apigateway.HttpMethod.GET,
            apigateway.HttpMethod.POST,
            apigateway.HttpMethod.PUT,
            apigateway.HttpMethod.PATCH,
            apigateway.HttpMethod.DELETE,
        ], lambdaIntegration, 'admin');
        // Example: Add customer routes with Cognito authorization
        // Customer routes require customer Cognito token
        this.apiGatewayStack.addAuthorizedRoute('/customer/{proxy+}', [
            apigateway.HttpMethod.GET,
            apigateway.HttpMethod.POST,
            apigateway.HttpMethod.PUT,
            apigateway.HttpMethod.PATCH,
            apigateway.HttpMethod.DELETE,
        ], lambdaIntegration, 'customer');
        // Example: Add vendor routes with Cognito authorization
        // Vendor routes require vendor Cognito token
        this.apiGatewayStack.addAuthorizedRoute('/vendor/{proxy+}', [
            apigateway.HttpMethod.GET,
            apigateway.HttpMethod.POST,
            apigateway.HttpMethod.PUT,
            apigateway.HttpMethod.PATCH,
            apigateway.HttpMethod.DELETE,
        ], lambdaIntegration, 'vendor');
        // Note: The catch-all route /{proxy+} remains public
        // Individual routes can be protected by adding them before the catch-all
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid2FybXBhd3otc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJ3YXJtcGF3ei1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUVuQyx5REFBMkM7QUFDM0MseUVBQTJEO0FBQzNELHdGQUEwRTtBQUMxRSxpREFBNkM7QUFDN0MsbURBQStDO0FBQy9DLHlDQUFxQztBQUNyQywyREFBc0Q7QUFDdEQsbURBQStDO0FBQy9DLDJDQUF1QztBQUN2QyxxREFBaUQ7QUFDakQsMkNBQXVDO0FBQ3ZDLDJDQUF1QztBQUN2QyxxREFBaUQ7QUFDakQsK0NBQTJDO0FBQzNDLDJEQUF1RDtBQUN2RCxpREFBNkM7QUFNN0MsTUFBYSxhQUFjLFNBQVEsR0FBRyxDQUFDLEtBQUs7SUFnQjFDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMEI7UUFDbEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFFeEIsTUFBTSxXQUFXLEdBQUcsS0FBSyxFQUFFLFdBQVcsSUFBSSxLQUFLLENBQUM7UUFFaEQsb0VBQW9FO1FBQ3BFLDZFQUE2RTtRQUM3RSxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxPQUFPLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQztRQUVyRSxJQUFJLEtBQUssRUFBRTtZQUNULDRCQUE0QjtZQUM1QixJQUFJLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxhQUFhLEVBQUU7Z0JBQ2pELEtBQUssRUFBRSxLQUFLO2FBQ2IsQ0FBQyxDQUFDO1NBQ0o7YUFBTTtZQUNMLCtDQUErQztZQUMvQyx3RkFBd0Y7WUFDeEYsSUFBSSxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVB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RyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsd0JBQXdCLEVBQUU7WUFDaEQsS0FBSyxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsbUJBQW1CLENBQUMsUUFBUTtZQUNqRCxXQUFXLEVBQUUsK0JBQStCO1lBQzVDLFVBQVUsRUFBRSxZQUFZLFdBQVcseUJBQXlCO1NBQzdELENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO1lBQ3ZDLEtBQUssRUFBRSxJQUFJLENBQUMsYUFBYSxDQUFDLFNBQVMsQ0FBQyxTQUFTO1lBQzdDLFdBQVcsRUFBRSwwQkFBMEI7WUFDdkMsVUFBVSxFQUFFLFlBQVksV0FBVyxnQkFBZ0I7U0FDcEQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSx1QkFBdUIsRUFBRTtZQUMvQyxLQUFLLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTO1lBQ3JELFdBQVcsRUFBRSxtQ0FBbUM7WUFDaEQsVUFBVSxFQUFFLFlBQVksV0FBVyx3QkFBd0I7U0FDNUQsQ0FBQyxDQUFDO1FBRUgsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxjQUFjLEVBQUU7WUFDdEMsS0FBSyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxRQUFRLENBQUMsWUFBWTtZQUNsRCxXQUFXLEVBQUUsNEJBQTRCO1lBQ3pDLFVBQVUsRUFBRSxZQUFZLFdBQVcsZUFBZTtTQUNuRCxDQUFDLENBQUM7UUFFSCxvRUFBb0U7UUFDcEUsK0JBQStCO0lBQ2pDLENBQUM7Q0FDRjtBQXBZRCxzQ0FvWUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgKiBhcyBlYzIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWVjMic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5IGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djInO1xuaW1wb3J0ICogYXMgaW50ZWdyYXRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1hcGlnYXRld2F5djItaW50ZWdyYXRpb25zJztcbmltcG9ydCB7IEF1cm9yYVN0YWNrIH0gZnJvbSAnLi9hdXJvcmEtc3RhY2snO1xuaW1wb3J0IHsgQ29nbml0b1N0YWNrIH0gZnJvbSAnLi9jb2duaXRvLXN0YWNrJztcbmltcG9ydCB7IFMzU3RhY2sgfSBmcm9tICcuL3MzLXN0YWNrJztcbmltcG9ydCB7IEFwaUdhdGV3YXlTdGFjayB9IGZyb20gJy4vYXBpLWdhdGV3YXktc3RhY2snO1xuaW1wb3J0IHsgUm91dGU1M1N0YWNrIH0gZnJvbSAnLi9yb3V0ZTUzLXN0YWNrJztcbmltcG9ydCB7IElhbVN0YWNrIH0gZnJvbSAnLi9pYW0tc3RhY2snO1xuaW1wb3J0IHsgU2VjdXJpdHlTdGFjayB9IGZyb20gJy4vc2VjdXJpdHktc3RhY2snO1xuaW1wb3J0IHsgU3FzU3RhY2sgfSBmcm9tICcuL3Nxcy1zdGFjayc7XG5pbXBvcnQgeyBTbnNTdGFjayB9IGZyb20gJy4vc25zLXN0YWNrJztcbmltcG9ydCB7IER5bmFtb0RiU3RhY2sgfSBmcm9tICcuL2R5bmFtb2RiLXN0YWNrJztcbmltcG9ydCB7IENoaW1lU3RhY2sgfSBmcm9tICcuL2NoaW1lLXN0YWNrJztcbmltcG9ydCB7IEV2ZW50QnJpZGdlU3RhY2sgfSBmcm9tICcuL2V2ZW50YnJpZGdlLXN0YWNrJztcbmltcG9ydCB7IExhbWJkYVN0YWNrIH0gZnJvbSAnLi9sYW1iZGEtc3RhY2snO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdhcm1wYXd6U3RhY2tQcm9wcyBleHRlbmRzIGNkay5TdGFja1Byb3BzIHtcbiAgZW52aXJvbm1lbnQ/OiBzdHJpbmc7IC8vICdkZXYnIHwgJ3Rlc3QnIHwgJ3Byb2QnXG59XG5cbmV4cG9ydCBjbGFzcyBXYXJtcGF3elN0YWNrIGV4dGVuZHMgY2RrLlN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IHZwYzogZWMyLklWcGM7XG4gIHB1YmxpYyByZWFkb25seSBhdXJvcmFTdGFjazogQXVyb3JhU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBjb2duaXRvU3RhY2s6IENvZ25pdG9TdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IHMzU3RhY2s6IFMzU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBhcGlHYXRld2F5U3RhY2s6IEFwaUdhdGV3YXlTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IHJvdXRlNTNTdGFjazogUm91dGU1M1N0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgaWFtU3RhY2s6IElhbVN0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgc2VjdXJpdHlTdGFjazogU2VjdXJpdHlTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IHNxc1N0YWNrOiBTcXNTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IHNuc1N0YWNrOiBTbnNTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IGR5bmFtb0RiU3RhY2s6IER5bmFtb0RiU3RhY2s7XG4gIHB1YmxpYyByZWFkb25seSBjaGltZVN0YWNrOiBDaGltZVN0YWNrO1xuICBwdWJsaWMgcmVhZG9ubHkgZXZlbnRCcmlkZ2VTdGFjazogRXZlbnRCcmlkZ2VTdGFjaztcbiAgcHVibGljIHJlYWRvbmx5IGxhbWJkYVN0YWNrOiBMYW1iZGFTdGFjaztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFdhcm1wYXd6U3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCwgcHJvcHMpO1xuXG4gICAgY29uc3QgZW52aXJvbm1lbnQgPSBwcm9wcz8uZW52aXJvbm1lbnQgfHwgJ2Rldic7XG5cbiAgICAvLyBVc2UgZXhpc3RpbmcgVlBDIGluc3RlYWQgb2YgY3JlYXRpbmcgbmV3IG9uZSAodG8gYXZvaWQgVlBDIGxpbWl0KVxuICAgIC8vIExvb2t1cCBleGlzdGluZyBWUEMgLSB0cnkgZGVmYXVsdCBWUEMgZmlyc3QsIHRoZW4gbG9va3VwIGJ5IElEIGlmIHByb3ZpZGVkXG4gICAgY29uc3QgdnBjSWQgPSB0aGlzLm5vZGUudHJ5R2V0Q29udGV4dCgndnBjSWQnKSB8fCBwcm9jZXNzLmVudi5WUENfSUQ7XG4gICAgXG4gICAgaWYgKHZwY0lkKSB7XG4gICAgICAvLyBJbXBvcnQgZXhpc3RpbmcgVlBDIGJ5IElEXG4gICAgICB0aGlzLnZwYyA9IGVjMi5WcGMuZnJvbUxvb2t1cCh0aGlzLCAnRXhpc3RpbmdWcGMnLCB7XG4gICAgICAgIHZwY0lkOiB2cGNJZCxcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBUcnkgdG8gbG9va3VwIGRlZmF1bHQgVlBDIChtb3N0IGNvbW1vbiBjYXNlKVxuICAgICAgLy8gSWYgdGhpcyBmYWlscywgdXNlciBuZWVkcyB0byBwcm92aWRlIFZQQyBJRCB2aWE6IGNkayBkZXBsb3kgLS1jb250ZXh0IHZwY0lkPXZwYy14eHh4eFxuICAgICAgdGhpcy52cGMgPSBlYzIuVnBjLmZyb21Mb29rdXAodGhpcywgJ0RlZmF1bHRWcGMnLCB7XG4gICAgICAgIGlzRGVmYXVsdDogdHJ1ZSxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIERlcGxveSBBdXJvcmEgUkRTXG4gICAgdGhpcy5hdXJvcmFTdGFjayA9IG5ldyBBdXJvcmFTdGFjayh0aGlzLCAnQXVyb3JhU3RhY2snLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IENvZ25pdG8gVXNlciBQb29sc1xuICAgIHRoaXMuY29nbml0b1N0YWNrID0gbmV3IENvZ25pdG9TdGFjayh0aGlzLCAnQ29nbml0b1N0YWNrJyk7XG5cbiAgICAvLyBEZXBsb3kgU2VjdXJpdHkgR3JvdXBzXG4gICAgdGhpcy5zZWN1cml0eVN0YWNrID0gbmV3IFNlY3VyaXR5U3RhY2sodGhpcywgJ1NlY3VyaXR5U3RhY2snLCB7XG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IFMzIEJ1Y2tldHMgKG5lZWRlZCBiZWZvcmUgSUFNIHN0YWNrKVxuICAgIHRoaXMuczNTdGFjayA9IG5ldyBTM1N0YWNrKHRoaXMsICdTM1N0YWNrJywge1xuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IElBTSBSb2xlcyBhbmQgUG9saWNpZXNcbiAgICB0aGlzLmlhbVN0YWNrID0gbmV3IElhbVN0YWNrKHRoaXMsICdJYW1TdGFjaycsIHtcbiAgICAgIGF1cm9yYVN0YWNrOiB0aGlzLmF1cm9yYVN0YWNrLFxuICAgICAgczNTdGFjazogdGhpcy5zM1N0YWNrLFxuICAgICAgY29nbml0b1N0YWNrOiB0aGlzLmNvZ25pdG9TdGFjayxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBTUVMgUXVldWVzIChuZWVkZWQgYmVmb3JlIFNOUylcbiAgICB0aGlzLnNxc1N0YWNrID0gbmV3IFNxc1N0YWNrKHRoaXMsICdTcXNTdGFjaycsIHtcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBTTlMgVG9waWNzIChuZWVkZWQgYmVmb3JlIEV2ZW50QnJpZGdlIGFuZCBMYW1iZGEpXG4gICAgdGhpcy5zbnNTdGFjayA9IG5ldyBTbnNTdGFjayh0aGlzLCAnU25zU3RhY2snLCB7XG4gICAgICBzcXNTdGFjazogdGhpcy5zcXNTdGFjayxcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBEeW5hbW9EQiBUYWJsZXNcbiAgICB0aGlzLmR5bmFtb0RiU3RhY2sgPSBuZXcgRHluYW1vRGJTdGFjayh0aGlzLCAnRHluYW1vRGJTdGFjaycsIHtcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIERlcGxveSBDaGltZSBTdGFja1xuICAgIHRoaXMuY2hpbWVTdGFjayA9IG5ldyBDaGltZVN0YWNrKHRoaXMsICdDaGltZVN0YWNrJywge1xuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IEV2ZW50QnJpZGdlIChuZWVkZWQgYWZ0ZXIgU05TIGFuZCBTUVMpXG4gICAgdGhpcy5ldmVudEJyaWRnZVN0YWNrID0gbmV3IEV2ZW50QnJpZGdlU3RhY2sodGhpcywgJ0V2ZW50QnJpZGdlU3RhY2snLCB7XG4gICAgICBzcXNTdGFjazogdGhpcy5zcXNTdGFjayxcbiAgICAgIHNuc1N0YWNrOiB0aGlzLnNuc1N0YWNrLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IExhbWJkYSBGdW5jdGlvbnMgKG5lZWRzIGFsbCBvdGhlciBzdGFja3MpXG4gICAgdGhpcy5sYW1iZGFTdGFjayA9IG5ldyBMYW1iZGFTdGFjayh0aGlzLCAnTGFtYmRhU3RhY2snLCB7XG4gICAgICBhdXJvcmFTdGFjazogdGhpcy5hdXJvcmFTdGFjayxcbiAgICAgIHMzU3RhY2s6IHRoaXMuczNTdGFjayxcbiAgICAgIGNvZ25pdG9TdGFjazogdGhpcy5jb2duaXRvU3RhY2ssXG4gICAgICBpYW1TdGFjazogdGhpcy5pYW1TdGFjayxcbiAgICAgIHNlY3VyaXR5U3RhY2s6IHRoaXMuc2VjdXJpdHlTdGFjayxcbiAgICAgIHNxc1N0YWNrOiB0aGlzLnNxc1N0YWNrLFxuICAgICAgc25zU3RhY2s6IHRoaXMuc25zU3RhY2ssXG4gICAgICBkeW5hbW9EYlN0YWNrOiB0aGlzLmR5bmFtb0RiU3RhY2ssXG4gICAgICB2cGM6IHRoaXMudnBjLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gRGVwbG95IEFQSSBHYXRld2F5ICh3aXRob3V0IGN1c3RvbSBkb21haW4gZmlyc3QpXG4gICAgdGhpcy5hcGlHYXRld2F5U3RhY2sgPSBuZXcgQXBpR2F0ZXdheVN0YWNrKHRoaXMsICdBcGlHYXRld2F5U3RhY2snLCB7XG4gICAgICBjb2duaXRvU3RhY2s6IHRoaXMuY29nbml0b1N0YWNrLFxuICAgICAgZW52aXJvbm1lbnQ6IGVudmlyb25tZW50LFxuICAgIH0pO1xuXG4gICAgLy8gV2lyZSBMYW1iZGEgdG8gQVBJIEdhdGV3YXlcbiAgICBjb25zdCBsYW1iZGFJbnRlZ3JhdGlvbiA9IG5ldyBpbnRlZ3JhdGlvbnMuSHR0cExhbWJkYUludGVncmF0aW9uKFxuICAgICAgJ0xhbWJkYUludGVncmF0aW9uJyxcbiAgICAgIHRoaXMubGFtYmRhU3RhY2suYXBpRnVuY3Rpb25cbiAgICApO1xuXG4gICAgLy8gQWRkIHJvdXRlcyB0byBBUEkgR2F0ZXdheVxuICAgIHRoaXMuYXBpR2F0ZXdheVN0YWNrLmFwaS5hZGRSb3V0ZXMoe1xuICAgICAgcGF0aDogJy97cHJveHkrfScsXG4gICAgICBtZXRob2RzOiBbXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5QT1NULFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuUFVULFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuUEFUQ0gsXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5ERUxFVEUsXG4gICAgICBdLFxuICAgICAgaW50ZWdyYXRpb246IGxhbWJkYUludGVncmF0aW9uLFxuICAgIH0pO1xuXG4gICAgLy8gSGVhbHRoIGNoZWNrIHJvdXRlIChwdWJsaWMsIG5vIGF1dGgpXG4gICAgdGhpcy5hcGlHYXRld2F5U3RhY2suYXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoOiAnL2hlYWx0aCcsXG4gICAgICBtZXRob2RzOiBbYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLkdFVF0sXG4gICAgICBpbnRlZ3JhdGlvbjogbGFtYmRhSW50ZWdyYXRpb24sXG4gICAgfSk7XG5cbiAgICAvLyBFeGFtcGxlOiBBZGQgYWRtaW4gcm91dGVzIHdpdGggQ29nbml0byBhdXRob3JpemF0aW9uXG4gICAgLy8gQWRtaW4gcm91dGVzIHJlcXVpcmUgYWRtaW4gQ29nbml0byB0b2tlblxuICAgIHRoaXMuYXBpR2F0ZXdheVN0YWNrLmFkZEF1dGhvcml6ZWRSb3V0ZShcbiAgICAgICcvYWRtaW4ve3Byb3h5K30nLFxuICAgICAgW1xuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuR0VULFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuUE9TVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBVVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBBVENILFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuREVMRVRFLFxuICAgICAgXSxcbiAgICAgIGxhbWJkYUludGVncmF0aW9uLFxuICAgICAgJ2FkbWluJ1xuICAgICk7XG5cbiAgICAvLyBFeGFtcGxlOiBBZGQgY3VzdG9tZXIgcm91dGVzIHdpdGggQ29nbml0byBhdXRob3JpemF0aW9uXG4gICAgLy8gQ3VzdG9tZXIgcm91dGVzIHJlcXVpcmUgY3VzdG9tZXIgQ29nbml0byB0b2tlblxuICAgIHRoaXMuYXBpR2F0ZXdheVN0YWNrLmFkZEF1dGhvcml6ZWRSb3V0ZShcbiAgICAgICcvY3VzdG9tZXIve3Byb3h5K30nLFxuICAgICAgW1xuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuR0VULFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuUE9TVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBVVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBBVENILFxuICAgICAgICBhcGlnYXRld2F5Lkh0dHBNZXRob2QuREVMRVRFLFxuICAgICAgXSxcbiAgICAgIGxhbWJkYUludGVncmF0aW9uLFxuICAgICAgJ2N1c3RvbWVyJ1xuICAgICk7XG5cbiAgICAvLyBFeGFtcGxlOiBBZGQgdmVuZG9yIHJvdXRlcyB3aXRoIENvZ25pdG8gYXV0aG9yaXphdGlvblxuICAgIC8vIFZlbmRvciByb3V0ZXMgcmVxdWlyZSB2ZW5kb3IgQ29nbml0byB0b2tlblxuICAgIHRoaXMuYXBpR2F0ZXdheVN0YWNrLmFkZEF1dGhvcml6ZWRSb3V0ZShcbiAgICAgICcvdmVuZG9yL3twcm94eSt9JyxcbiAgICAgIFtcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLkdFVCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLlBPU1QsXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5QVVQsXG4gICAgICAgIGFwaWdhdGV3YXkuSHR0cE1ldGhvZC5QQVRDSCxcbiAgICAgICAgYXBpZ2F0ZXdheS5IdHRwTWV0aG9kLkRFTEVURSxcbiAgICAgIF0sXG4gICAgICBsYW1iZGFJbnRlZ3JhdGlvbixcbiAgICAgICd2ZW5kb3InXG4gICAgKTtcblxuICAgIC8vIE5vdGU6IFRoZSBjYXRjaC1hbGwgcm91dGUgL3twcm94eSt9IHJlbWFpbnMgcHVibGljXG4gICAgLy8gSW5kaXZpZHVhbCByb3V0ZXMgY2FuIGJlIHByb3RlY3RlZCBieSBhZGRpbmcgdGhlbSBiZWZvcmUgdGhlIGNhdGNoLWFsbFxuXG4gICAgLy8gRGVwbG95IFJvdXRlNTMgYW5kIEN1c3RvbSBEb21haW4gKGFmdGVyIEFQSSBHYXRld2F5KVxuICAgIHRoaXMucm91dGU1M1N0YWNrID0gbmV3IFJvdXRlNTNTdGFjayh0aGlzLCAnUm91dGU1M1N0YWNrJywge1xuICAgICAgYXBpR2F0ZXdheVN0YWNrOiB0aGlzLmFwaUdhdGV3YXlTdGFjayxcbiAgICAgIHMzU3RhY2s6IHRoaXMuczNTdGFjayxcbiAgICAgIGVudmlyb25tZW50OiBlbnZpcm9ubWVudCxcbiAgICB9KTtcblxuICAgIC8vIFVwZGF0ZSBBUEkgR2F0ZXdheSB3aXRoIGN1c3RvbSBkb21haW4gZnJvbSBSb3V0ZTUzXG4gICAgdGhpcy5hcGlHYXRld2F5U3RhY2suYWRkQ3VzdG9tRG9tYWluKHRoaXMucm91dGU1M1N0YWNrKTtcblxuICAgIC8vIENyZWF0ZSBBUEkgR2F0ZXdheSBETlMgcmVjb3Jkc1xuICAgIHRoaXMucm91dGU1M1N0YWNrLmNyZWF0ZUFwaUdhdGV3YXlSZWNvcmRzKHRoaXMuYXBpR2F0ZXdheVN0YWNrKTtcblxuICAgIC8vIE91dHB1dHMgZm9yIG90aGVyIGFnZW50c1xuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXJvcmFFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1cm9yYVN0YWNrLmNsdXN0ZXIuY2x1c3RlckVuZHBvaW50Lmhvc3RuYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBdXJvcmEgUkRTIENsdXN0ZXIgRW5kcG9pbnQgLSBGb3IgQTQgKEJhY2tlbmQgRW5naW5lZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1BdXJvcmFFbmRwb2ludCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXVyb3JhUHJveHlFbmRwb2ludCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmF1cm9yYVN0YWNrLnByb3h5LmVuZHBvaW50LFxuICAgICAgZGVzY3JpcHRpb246ICdSRFMgUHJveHkgRW5kcG9pbnQgLSBGb3IgQTQgKEJhY2tlbmQgRW5naW5lZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1BdXJvcmFQcm94eUVuZHBvaW50JyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBdXJvcmFTZWNyZXRBcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hdXJvcmFTdGFjay5zZWNyZXQuc2VjcmV0QXJuLFxuICAgICAgZGVzY3JpcHRpb246ICdBdXJvcmEgUkRTIFNlY3JldCBBUk4gLSBGb3IgQTQgKEJhY2tlbmQgRW5naW5lZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1BdXJvcmFTZWNyZXRBcm4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0N1c3RvbWVyVXNlclBvb2xJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvZ25pdG9TdGFjay5jdXN0b21lclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3VzdG9tZXIgQ29nbml0byBVc2VyIFBvb2wgSUQgLSBGb3IgQTYgKE1vYmlsZSBFbmdpbmVlciknLFxuICAgICAgZXhwb3J0TmFtZTogJ1dhcm1wYXd6LUN1c3RvbWVyVXNlclBvb2xJZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ3VzdG9tZXJVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMuY29nbml0b1N0YWNrLmN1c3RvbWVyUG9vbENsaWVudC51c2VyUG9vbENsaWVudElkLFxuICAgICAgZGVzY3JpcHRpb246ICdDdXN0b21lciBDb2duaXRvIENsaWVudCBJRCAtIEZvciBBNiAoTW9iaWxlIEVuZ2luZWVyKScsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otQ3VzdG9tZXJVc2VyUG9vbENsaWVudElkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWZW5kb3JVc2VyUG9vbElkJywge1xuICAgICAgdmFsdWU6IHRoaXMuY29nbml0b1N0YWNrLnZlbmRvclBvb2wudXNlclBvb2xJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVmVuZG9yIENvZ25pdG8gVXNlciBQb29sIElEIC0gRm9yIEE2IChNb2JpbGUgRW5naW5lZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1WZW5kb3JVc2VyUG9vbElkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWZW5kb3JVc2VyUG9vbENsaWVudElkJywge1xuICAgICAgdmFsdWU6IHRoaXMuY29nbml0b1N0YWNrLnZlbmRvclBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnVmVuZG9yIENvZ25pdG8gQ2xpZW50IElEIC0gRm9yIEE2IChNb2JpbGUgRW5naW5lZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1WZW5kb3JVc2VyUG9vbENsaWVudElkJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZG1pblVzZXJQb29sSWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5jb2duaXRvU3RhY2suYWRtaW5Qb29sLnVzZXJQb29sSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluIENvZ25pdG8gVXNlciBQb29sIElEIC0gRm9yIEFnZW50IDMgKEF1dGggSW50ZWdyYXRpb24pJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1BZG1pblVzZXJQb29sSWQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FkbWluVXNlclBvb2xDbGllbnRJZCcsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmNvZ25pdG9TdGFjay5hZG1pblBvb2xDbGllbnQudXNlclBvb2xDbGllbnRJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gQ29nbml0byBDbGllbnQgSUQgLSBGb3IgQWdlbnQgMyAoQXV0aCBJbnRlZ3JhdGlvbiknLFxuICAgICAgZXhwb3J0TmFtZTogJ1dhcm1wYXd6LUFkbWluVXNlclBvb2xDbGllbnRJZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ3VzdG9tZXJBdXRob3JpemVySWQnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlHYXRld2F5U3RhY2suY3VzdG9tZXJBdXRob3JpemVyLmF1dGhvcml6ZXJJZCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQ3VzdG9tZXIgQ29nbml0byBBdXRob3JpemVyIElEIC0gRm9yIEFnZW50IDMgKEF1dGggSW50ZWdyYXRpb24pJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1DdXN0b21lckF1dGhvcml6ZXJJZCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnVmVuZG9yQXV0aG9yaXplcklkJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpR2F0ZXdheVN0YWNrLnZlbmRvckF1dGhvcml6ZXIuYXV0aG9yaXplcklkLFxuICAgICAgZGVzY3JpcHRpb246ICdWZW5kb3IgQ29nbml0byBBdXRob3JpemVyIElEIC0gRm9yIEFnZW50IDMgKEF1dGggSW50ZWdyYXRpb24pJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1WZW5kb3JBdXRob3JpemVySWQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FkbWluQXV0aG9yaXplcklkJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpR2F0ZXdheVN0YWNrLmFkbWluQXV0aG9yaXplci5hdXRob3JpemVySWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FkbWluIENvZ25pdG8gQXV0aG9yaXplciBJRCAtIEZvciBBZ2VudCAzIChBdXRoIEludGVncmF0aW9uKScsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otQWRtaW5BdXRob3JpemVySWQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaUdhdGV3YXlVcmwnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5hcGlHYXRld2F5U3RhY2suYXBpLnVybCB8fCAnTm90IHlldCBkZXBsb3llZCcsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IEhUVFAgQVBJIFVSTCAtIEZvciBBNiAoTW9iaWxlIEVuZ2luZWVyKSBhbmQgQTggKFFBKScsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otQXBpR2F0ZXdheVVybCcsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQXBpR2F0ZXdheUlkJywge1xuICAgICAgdmFsdWU6IHRoaXMuYXBpR2F0ZXdheVN0YWNrLmFwaS5odHRwQXBpSWQsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSSBHYXRld2F5IEhUVFAgQVBJIElEIC0gRm9yIEE2IChNb2JpbGUgRW5naW5lZXIpIGFuZCBBOCAoUUEpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1BcGlHYXRld2F5SWQnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1N0b3JhZ2VCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuczNTdGFjay5zdG9yYWdlQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIFN0b3JhZ2UgQnVja2V0IC0gRm9yIEE0IChCYWNrZW5kIEVuZ2luZWVyKScsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otU3RvcmFnZUJ1Y2tldE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ1VwbG9hZHNCdWNrZXROYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuczNTdGFjay51cGxvYWRzQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ1MzIFVwbG9hZHMgQnVja2V0IC0gRm9yIEE2IChNb2JpbGUgRW5naW5lZXIpJyxcbiAgICAgIGV4cG9ydE5hbWU6ICdXYXJtcGF3ei1VcGxvYWRzQnVja2V0TmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2xvdWRGcm9udERvbWFpbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zM1N0YWNrLmRpc3RyaWJ1dGlvbi5kaXN0cmlidXRpb25Eb21haW5OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdDbG91ZEZyb250IERvbWFpbiAtIEZvciBBNiAoTW9iaWxlIEVuZ2luZWVyKScsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otQ2xvdWRGcm9udERvbWFpbk5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0FwaURvbWFpbk5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yb3V0ZTUzU3RhY2suYXBpRG9tYWluTmFtZSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIEN1c3RvbSBEb21haW4gTmFtZScsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otQXBpRG9tYWluTmFtZScsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ3VzdG9tZXJBcHBEb21haW4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yb3V0ZTUzU3RhY2suY3VzdG9tZXJBcHBEb21haW4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0N1c3RvbWVyIEFwcCBEb21haW4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1dhcm1wYXd6LUN1c3RvbWVyQXBwRG9tYWluJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdWZW5kb3JBcHBEb21haW4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5yb3V0ZTUzU3RhY2sudmVuZG9yQXBwRG9tYWluLFxuICAgICAgZGVzY3JpcHRpb246ICdWZW5kb3IgQXBwIERvbWFpbicsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otVmVuZG9yQXBwRG9tYWluJyxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdBZG1pbkRvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnJvdXRlNTNTdGFjay5hZG1pbkRvbWFpbixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQWRtaW4gUG9ydGFsIERvbWFpbicsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otQWRtaW5Eb21haW4nLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Fwa0J1Y2tldE5hbWUnLCB7XG4gICAgICB2YWx1ZTogdGhpcy5zM1N0YWNrLmFwa0J1Y2tldC5idWNrZXROYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdBUEsgU3RvcmFnZSBCdWNrZXQgLSBGb3IgTW9iaWxlIEFwcHMnLFxuICAgICAgZXhwb3J0TmFtZTogJ1dhcm1wYXd6LUFwa0J1Y2tldE5hbWUnLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0Fwa0Rpc3RyaWJ1dGlvbkRvbWFpbicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnMzU3RhY2suYXBrRGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbkRvbWFpbk5hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0FQSyBDbG91ZEZyb250IERpc3RyaWJ1dGlvbiBEb21haW4nLFxuICAgICAgZXhwb3J0TmFtZTogJ1dhcm1wYXd6LUFwa0Rpc3RyaWJ1dGlvbkRvbWFpbicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhRXhlY3V0aW9uUm9sZUFybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmlhbVN0YWNrLmxhbWJkYUV4ZWN1dGlvblJvbGUucm9sZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTGFtYmRhIEV4ZWN1dGlvbiBSb2xlIEFSTicsXG4gICAgICBleHBvcnROYW1lOiAnV2FybXBhd3otTGFtYmRhRXhlY3V0aW9uUm9sZUFybicsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhRnVuY3Rpb25Bcm4nLCB7XG4gICAgICB2YWx1ZTogdGhpcy5sYW1iZGFTdGFjay5hcGlGdW5jdGlvbi5mdW5jdGlvbkFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnTWFpbiBMYW1iZGEgRnVuY3Rpb24gQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBXYXJtcGF3ei0ke2Vudmlyb25tZW50fS1MYW1iZGFGdW5jdGlvbkFybmAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnTGFtYmRhRnVuY3Rpb25OYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMubGFtYmRhU3RhY2suYXBpRnVuY3Rpb24uZnVuY3Rpb25OYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdNYWluIExhbWJkYSBGdW5jdGlvbiBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBXYXJtcGF3ei0ke2Vudmlyb25tZW50fS1MYW1iZGFGdW5jdGlvbk5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ05vdGlmaWNhdGlvblF1ZXVlVXJsJywge1xuICAgICAgdmFsdWU6IHRoaXMuc3FzU3RhY2subm90aWZpY2F0aW9uUXVldWUucXVldWVVcmwsXG4gICAgICBkZXNjcmlwdGlvbjogJ1NRUyBOb3RpZmljYXRpb24gUXVldWUgVVJMJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBXYXJtcGF3ei0ke2Vudmlyb25tZW50fS1Ob3RpZmljYXRpb25RdWV1ZVVybGAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQm9va2luZ0NyZWF0ZWRUb3BpY0FybicsIHtcbiAgICAgIHZhbHVlOiB0aGlzLnNuc1N0YWNrLmJvb2tpbmdDcmVhdGVkVG9waWMudG9waWNBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ1NOUyBCb29raW5nIENyZWF0ZWQgVG9waWMgQVJOJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBXYXJtcGF3ei0ke2Vudmlyb25tZW50fS1Cb29raW5nQ3JlYXRlZFRvcGljQXJuYCxcbiAgICB9KTtcblxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdMb2dzVGFibGVOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZHluYW1vRGJTdGFjay5sb2dzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBMb2dzIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFdhcm1wYXd6LSR7ZW52aXJvbm1lbnR9LUxvZ3NUYWJsZU5hbWVgLFxuICAgIH0pO1xuXG4gICAgbmV3IGNkay5DZm5PdXRwdXQodGhpcywgJ0NoYXRNZXNzYWdlc1RhYmxlTmFtZScsIHtcbiAgICAgIHZhbHVlOiB0aGlzLmR5bmFtb0RiU3RhY2suY2hhdE1lc3NhZ2VzVGFibGUudGFibGVOYW1lLFxuICAgICAgZGVzY3JpcHRpb246ICdEeW5hbW9EQiBDaGF0IE1lc3NhZ2VzIFRhYmxlIE5hbWUnLFxuICAgICAgZXhwb3J0TmFtZTogYFdhcm1wYXd6LSR7ZW52aXJvbm1lbnR9LUNoYXRNZXNzYWdlc1RhYmxlTmFtZWAsXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnRXZlbnRCdXNOYW1lJywge1xuICAgICAgdmFsdWU6IHRoaXMuZXZlbnRCcmlkZ2VTdGFjay5ldmVudEJ1cy5ldmVudEJ1c05hbWUsXG4gICAgICBkZXNjcmlwdGlvbjogJ0V2ZW50QnJpZGdlIEV2ZW50IEJ1cyBOYW1lJyxcbiAgICAgIGV4cG9ydE5hbWU6IGBXYXJtcGF3ei0ke2Vudmlyb25tZW50fS1FdmVudEJ1c05hbWVgLFxuICAgIH0pO1xuXG4gICAgLy8gTm90ZTogQ2hpbWVBcHBJbnN0YW5jZUFybiBvdXRwdXQgaXMgYWxyZWFkeSBjcmVhdGVkIGluIENoaW1lU3RhY2tcbiAgICAvLyBObyBuZWVkIHRvIGR1cGxpY2F0ZSBpdCBoZXJlXG4gIH1cbn1cblxuIl19
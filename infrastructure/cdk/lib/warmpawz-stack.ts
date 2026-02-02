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

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { Construct } from 'constructs';
import { AuroraStack } from './aurora-stack';
import { CognitoStack } from './cognito-stack';
import { S3Stack } from './s3-stack';
import { ApiGatewayStack } from './api-gateway-stack';
import { Route53Stack } from './route53-stack';
import { IamStack } from './iam-stack';
import { SecurityStack } from './security-stack';
import { SqsStack } from './sqs-stack';
import { SnsStack } from './sns-stack';
import { DynamoDbStack } from './dynamodb-stack';
import { ChimeStack } from './chime-stack';
import { EventBridgeStack } from './eventbridge-stack';
import { LambdaStack } from './lambda-stack';

export interface WarmpawzStackProps extends cdk.StackProps {
  environment?: string;
}

export class WarmpawzStack extends cdk.Stack {
  public readonly vpc: ec2.IVpc;
  public readonly auroraStack: AuroraStack;
  public readonly cognitoStack: CognitoStack;
  public readonly s3Stack: S3Stack;
  public readonly apiGatewayStack: ApiGatewayStack;
  public readonly route53Stack: Route53Stack;
  public readonly iamStack: IamStack;
  public readonly securityStack: SecurityStack;
  public readonly sqsStack: SqsStack;
  public readonly snsStack: SnsStack;
  public readonly dynamoDbStack: DynamoDbStack;
  public readonly chimeStack: ChimeStack;
  public readonly eventBridgeStack: EventBridgeStack;
  public readonly lambdaStack: LambdaStack;

  constructor(scope: Construct, id: string, props?: WarmpawzStackProps) {
    super(scope, id, props);

    const environment = props?.environment || 'dev';

    // Use existing VPC instead of creating new one (to avoid VPC limit)
    // IMPORTANT: Must use the same VPC as RDS for database connectivity
    // The RDS VPC has Secrets Manager VPC endpoint configured
    const vpcId = this.node.tryGetContext('vpcId') || process.env.VPC_ID || 'vpc-02a4893e5e582c4d8'; // RDS VPC
    
    // Import existing VPC by ID
    this.vpc = ec2.Vpc.fromLookup(this, 'ExistingVpc', {
      vpcId: vpcId,
    });
    
    // Note: Secrets Manager VPC Endpoint already exists in the RDS VPC (vpc-02a4893e5e582c4d8)
    // Lambda security group (sg-04f3c12d9c3f4fb64) has ingress to SM endpoint (sg-029fd9f75cf25da6f)
    // and RDS security groups (sg-0f873d37e561cdfb0)

    // Deploy Aurora RDS (use existing if cluster identifier provided)
    const existingClusterId = this.node.tryGetContext('existingRdsClusterId') || 
                              process.env.EXISTING_RDS_CLUSTER_ID;
    const existingClusterEndpoint = this.node.tryGetContext('existingRdsClusterEndpoint') || 
                              process.env.EXISTING_RDS_CLUSTER_ENDPOINT;
    // Use the correct RDS master secret (not the CDK-generated one)
    const existingSecretArn = this.node.tryGetContext('existingRdsSecretArn') || 
                              process.env.EXISTING_RDS_SECRET_ARN ||
                              'arn:aws:secretsmanager:ap-south-1:057442119249:secret:warmpawz-dev-rds-master-20260106164510791100000002-WqZcjI';
    const existingProxyName = this.node.tryGetContext('existingRdsProxyName') || 
                              process.env.EXISTING_RDS_PROXY_NAME;
    
    this.auroraStack = new AuroraStack(this, 'AuroraStack', {
      vpc: this.vpc,
      environment: environment,
      existingClusterIdentifier: existingClusterId || 'warmpawz-dev-cluster', // Default from CI/CD
      existingClusterEndpoint: existingClusterEndpoint || 'warmpawz-dev-cluster.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com',
      existingSecretArn: existingSecretArn,
      existingProxyName: existingProxyName || 'warmpawz-aurora-proxy',
    });

    // Deploy Cognito User Pools (3 separate pools for customer, vendor, admin)
    this.cognitoStack = new CognitoStack(this, 'CognitoStack');

    // Deploy Security Groups
    this.securityStack = new SecurityStack(this, 'SecurityStack', {
      vpc: this.vpc,
    });

    // Deploy S3 Buckets (use existing if bucket names provided)
    const existingAdminFrontend = this.node.tryGetContext('existingAdminFrontendBucket') ||
                                  `warmpawz-${environment}-admin-frontend-ap-south-1`;
    const existingVendorFrontend = this.node.tryGetContext('existingVendorFrontendBucket') ||
                                   `warmpawz-${environment}-vendor-frontend-ap-south-1`;
    const existingCustomerFrontend = this.node.tryGetContext('existingCustomerFrontendBucket') ||
                                     `warmpawz-${environment}-customer-frontend-ap-south-1`;
    
    this.s3Stack = new S3Stack(this, 'S3Stack', {
      environment: environment,
      existingAdminFrontendBucket: existingAdminFrontend,
      existingVendorFrontendBucket: existingVendorFrontend,
      existingCustomerFrontendBucket: existingCustomerFrontend,
      // Other buckets will be created if not provided
    });

    // Deploy IAM Roles and Policies
    this.iamStack = new IamStack(this, 'IamStack', {
      auroraStack: this.auroraStack,
      s3Stack: this.s3Stack,
      cognitoStack: this.cognitoStack,
    });

    // Deploy SQS Queues (needed before SNS)
    this.sqsStack = new SqsStack(this, 'SqsStack', {
      environment: environment,
    });

    // Deploy SNS Topics (needed before EventBridge and Lambda)
    this.snsStack = new SnsStack(this, 'SnsStack', {
      sqsStack: this.sqsStack,
      environment: environment,
    });

    // Deploy DynamoDB Tables (use existing tables to avoid conflicts)
    this.dynamoDbStack = new DynamoDbStack(this, 'DynamoDbStack', {
      environment: environment,
      useExistingTables: true, // Tables already exist in AWS
    });

    // Deploy Chime Stack (for video calls)
    this.chimeStack = new ChimeStack(this, 'ChimeStack', {
      environment: environment,
    });

    // Deploy EventBridge (needed after SNS and SQS)
    this.eventBridgeStack = new EventBridgeStack(this, 'EventBridgeStack', {
      sqsStack: this.sqsStack,
      snsStack: this.snsStack,
      environment: environment,
    });

    // Deploy Lambda Functions (needs all other stacks)
    this.lambdaStack = new LambdaStack(this, 'LambdaStack', {
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
    this.apiGatewayStack = new ApiGatewayStack(this, 'ApiGatewayStack', {
      cognitoStack: this.cognitoStack,
      environment: environment,
    });

    // Wire Lambda to API Gateway
    const lambdaIntegration = new integrations.HttpLambdaIntegration(
      'LambdaIntegration',
      this.lambdaStack.apiFunction
    );

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

    // 1b. Pharmacy order status by orderId (public – track by order ID without auth)
    this.apiGatewayStack.api.addRoutes({
      path: '/customer/orders/{orderId}/pharmacy-status',
      methods: [apigateway.HttpMethod.GET],
      integration: lambdaIntegration,
      // No authorizer - public so customer app can poll order status after creating order
    });

    // 2. Authorized routes (specific paths before catch-all)
    // Admin routes require admin Cognito token
    this.apiGatewayStack.addAuthorizedRoute(
      '/admin/{proxy+}',
      [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
        apigateway.HttpMethod.PUT,
        apigateway.HttpMethod.PATCH,
        apigateway.HttpMethod.DELETE,
        apigateway.HttpMethod.OPTIONS,
        apigateway.HttpMethod.HEAD,
      ],
      lambdaIntegration,
      'admin'
    );

    // Customer routes require customer Cognito token
    this.apiGatewayStack.addAuthorizedRoute(
      '/customer/{proxy+}',
      [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
        apigateway.HttpMethod.PUT,
        apigateway.HttpMethod.PATCH,
        apigateway.HttpMethod.DELETE,
        apigateway.HttpMethod.OPTIONS,
        apigateway.HttpMethod.HEAD,
      ],
      lambdaIntegration,
      'customer'
    );

    // Vendor routes require vendor Cognito token
    this.apiGatewayStack.addAuthorizedRoute(
      '/vendor/{proxy+}',
      [
        apigateway.HttpMethod.GET,
        apigateway.HttpMethod.POST,
        apigateway.HttpMethod.PUT,
        apigateway.HttpMethod.PATCH,
        apigateway.HttpMethod.DELETE,
        apigateway.HttpMethod.OPTIONS,
        apigateway.HttpMethod.HEAD,
      ],
      lambdaIntegration,
      'vendor'
    );

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
    this.route53Stack = new Route53Stack(this, 'Route53Stack', {
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

    if (this.auroraStack.proxy) {
      new cdk.CfnOutput(this, 'AuroraProxyEndpoint', {
        value: this.auroraStack.proxy.endpoint,
        description: 'RDS Proxy Endpoint - For A4 (Backend Engineer)',
        exportName: 'Warmpawz-AuroraProxyEndpoint',
      });
    } else {
      new cdk.CfnOutput(this, 'AuroraClusterEndpoint', {
        value: this.auroraStack.cluster.clusterEndpoint.hostname,
        description: 'RDS Cluster Endpoint - For A4 (Backend Engineer)',
        exportName: 'Warmpawz-AuroraClusterEndpoint',
      });
    }

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

    if (this.s3Stack.distribution) {
      new cdk.CfnOutput(this, 'CloudFrontDomainName', {
        value: this.s3Stack.distribution.distributionDomainName,
        description: 'CloudFront Domain - For A6 (Mobile Engineer)',
        exportName: 'Warmpawz-CloudFrontDomainName',
      });
    }

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

    if (this.s3Stack.apkBucket) {
      new cdk.CfnOutput(this, 'ApkBucketName', {
        value: this.s3Stack.apkBucket.bucketName,
        description: 'APK Storage Bucket - For Mobile Apps',
        exportName: 'Warmpawz-ApkBucketName',
      });
    }

    if (this.s3Stack.apkDistribution) {
      new cdk.CfnOutput(this, 'ApkDistributionDomain', {
        value: this.s3Stack.apkDistribution.distributionDomainName,
        description: 'APK CloudFront Distribution Domain',
        exportName: 'Warmpawz-ApkDistributionDomain',
      });
    }

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


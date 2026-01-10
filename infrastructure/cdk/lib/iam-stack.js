"use strict";
/**
 * ============================================================================
 * IAM STACK - AWS PERMISSIONS FOR WARMPAWZ LAMBDA
 * ============================================================================
 *
 * Defines all IAM roles and permissions for Lambda functions
 *
 * Services Covered:
 * - RDS Proxy access
 * - Secrets Manager
 * - S3 buckets
 * - Cognito user pools
 * - SNS topics
 * - SQS queues
 * - DynamoDB tables
 * - Bedrock AI models
 * - Chime SDK (video/chat)
 * - OpenSearch (search)
 * - EventBridge
 * - CloudWatch Logs
 *
 * Date: 2026-01-02
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
exports.IamStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
class IamStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Lambda Execution Role with all necessary permissions
        this.lambdaExecutionRole = new iam.Role(this, 'LambdaExecutionRole', {
            roleName: 'warmpawz-lambda-execution-role',
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Execution role for Warmpawz Lambda functions',
            managedPolicies: [
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
                iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
            ],
        });
        // RDS Proxy access
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'rds-db:connect',
            ],
            resources: [
                `arn:aws:rds-db:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:dbuser:*/warmpawz_lambda`,
            ],
        }));
        // Secrets Manager access for database credentials
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret',
            ],
            resources: [props.auroraStack.secret.secretArn],
        }));
        // S3 access
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                's3:GetObject',
                's3:PutObject',
                's3:DeleteObject',
                's3:ListBucket',
            ],
            resources: [
                props.s3Stack.storageBucket.bucketArn,
                `${props.s3Stack.storageBucket.bucketArn}/*`,
                props.s3Stack.uploadsBucket.bucketArn,
                `${props.s3Stack.uploadsBucket.bucketArn}/*`,
                props.s3Stack.assetsBucket.bucketArn,
                `${props.s3Stack.assetsBucket.bucketArn}/*`,
                props.s3Stack.logsBucket.bucketArn,
                `${props.s3Stack.logsBucket.bucketArn}/*`,
            ],
        }));
        // Cognito access
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'cognito-idp:AdminGetUser',
                'cognito-idp:AdminCreateUser',
                'cognito-idp:AdminUpdateUserAttributes',
                'cognito-idp:AdminDeleteUser',
                'cognito-idp:AdminSetUserPassword',
                'cognito-idp:ListUsers',
                'cognito-idp:AdminListGroupsForUser',
                'cognito-idp:AdminAddUserToGroup',
                'cognito-idp:AdminRemoveUserFromGroup',
            ],
            resources: [
                props.cognitoStack.customerPool.userPoolArn,
                props.cognitoStack.vendorPool.userPoolArn,
                props.cognitoStack.adminPool.userPoolArn,
            ],
        }));
        // SNS access for notifications
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sns:Publish',
            ],
            resources: ['*'], // Will be restricted to specific topics
        }));
        // SQS access for async processing
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'sqs:SendMessage',
                'sqs:ReceiveMessage',
                'sqs:DeleteMessage',
                'sqs:GetQueueAttributes',
            ],
            resources: ['*'], // Will be restricted to specific queues
        }));
        // DynamoDB access for non-critical data
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'dynamodb:PutItem',
                'dynamodb:GetItem',
                'dynamodb:UpdateItem',
                'dynamodb:DeleteItem',
                'dynamodb:Query',
                'dynamodb:Scan',
                'dynamodb:BatchGetItem',
                'dynamodb:BatchWriteItem',
            ],
            resources: ['*'], // Will be restricted to specific tables
        }));
        // Bedrock access for AI features
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'bedrock:InvokeModel',
                'bedrock:InvokeModelWithResponseStream',
                'bedrock:ListFoundationModels',
                'bedrock:GetFoundationModel',
            ],
            resources: [
                // Claude models
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-v2`,
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-v2-1`,
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-sonnet`,
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-haiku`,
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/anthropic.claude-3-opus`,
                // Titan models
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-text-express-v1`,
                `arn:aws:bedrock:${cdk.Aws.REGION}::foundation-model/amazon.titan-embed-text-v1`,
            ],
        }));
        // Chime SDK access for video/chat
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'chime:CreateMeeting',
                'chime:GetMeeting',
                'chime:DeleteMeeting',
                'chime:CreateAttendee',
                'chime:GetAttendee',
                'chime:ListAttendees',
                'chime:CreateAppInstance',
                'chime:DescribeAppInstance',
                'chime:ListAppInstances',
                'chime:CreateAppInstanceUser',
                'chime:DescribeAppInstanceUser',
                'chime:ListAppInstanceUsers',
                'chime:CreateChannel',
                'chime:DescribeChannel',
                'chime:ListChannels',
                'chime:SendChannelMessage',
                'chime:ListChannelMessages',
                'chime:CreateChannelMembership',
                'chime:ListChannelMemberships',
            ],
            resources: ['*'], // Chime doesn't support resource-level permissions
        }));
        // ✅ NEW: OpenSearch access for search functionality
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'es:ESHttpGet',
                'es:ESHttpPost',
                'es:ESHttpPut',
                'es:ESHttpDelete',
                'es:ESHttpHead',
                'es:ESHttpPatch',
                'es:DescribeDomain',
                'es:DescribeDomains',
                'es:ListDomainNames',
            ],
            resources: [
                `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/warmpawz-*`,
                `arn:aws:es:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:domain/warmpawz-*/*`,
            ],
        }));
        // ✅ NEW: OpenSearch Serverless access (if using serverless)
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'aoss:APIAccessAll',
            ],
            resources: [
                `arn:aws:aoss:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:collection/*`,
            ],
        }));
        // EventBridge access for event publishing
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'events:PutEvents',
            ],
            resources: ['*'], // Will be restricted to specific event bus
        }));
        // CloudWatch Logs (already included in basic execution role, but explicit)
        this.lambdaExecutionRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: ['*'],
        }));
    }
}
exports.IamStack = IamStack;
//# sourceMappingURL=iam-stack.js.map
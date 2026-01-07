/**
 * ============================================================================
 * AWS CDK STACK - LAMBDA FUNCTIONS
 * ============================================================================
 * 
 * Defines Lambda functions for all API endpoints
 * 
 * Date: 2025-01-28
 * ============================================================================
 */

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface LambdaStackProps extends cdk.StackProps {
  rdsEndpoint: string;
  rdsDatabase: string;
  rdsUsername: string;
  rdsPassword: string;
}

export class LambdaStack extends cdk.Stack {
  public readonly apiHandler: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // Main API Lambda function
    this.apiHandler = new lambda.Function(this, 'ApiHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler.handler',
      code: lambda.Code.fromAsset('../backend/lambda/dist'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      environment: {
        DB_HOST: props.rdsEndpoint,
        DB_NAME: props.rdsDatabase,
        DB_USER: props.rdsUsername,
        DB_PASSWORD: props.rdsPassword,
        DB_PORT: '5432',
        NODE_ENV: 'production',
        RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || '',
        COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID || '',
        COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID || '',
        COGNITO_PASSWORD_SECRET: process.env.COGNITO_PASSWORD_SECRET || '',
        AWS_REGION: process.env.AWS_REGION || 'ap-south-1',
      },
    });

    // Grant RDS access
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'rds-db:connect',
        ],
        resources: [
          `arn:aws:rds:${this.region}:${this.account}:db:${props.rdsDatabase}`,
        ],
      })
    );

    // Grant SNS access for notifications
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sns:Publish',
        ],
        resources: ['*'],
      })
    );

    // Grant SQS access for async processing
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'sqs:SendMessage',
          'sqs:ReceiveMessage',
          'sqs:DeleteMessage',
        ],
        resources: ['*'],
      })
    );

    // Grant S3 access for file storage
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          's3:GetObject',
          's3:PutObject',
          's3:DeleteObject',
        ],
        resources: ['*'],
      })
    );

    // Grant Chime SDK access for video calls
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'chime:CreateMeeting',
          'chime:CreateAttendee',
          'chime:DeleteMeeting',
          'chime:GetMeeting',
        ],
        resources: ['*'],
      })
    );

    // Grant Cognito access for user management
    this.apiHandler.addToRolePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: [
          'cognito-idp:AdminCreateUser',
          'cognito-idp:AdminSetUserPassword',
          'cognito-idp:AdminInitiateAuth',
          'cognito-idp:AdminGetUser',
          'cognito-idp:AdminUpdateUserAttributes',
        ],
        resources: [
          `arn:aws:cognito-idp:${this.region}:${this.account}:userpool/*`,
        ],
      })
    );
  }
}


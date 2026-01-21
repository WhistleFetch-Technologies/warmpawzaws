/**
 * AWS CDK STACK - CHIME
 * Defines resources for AWS Chime SDK integration (video calling)
 */

import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface ChimeStackProps {
  environment?: string;
}

export class ChimeStack extends Construct {
  public readonly chimeAppInstanceArn: string;
  public readonly chimeRole: iam.Role;

  constructor(scope: Construct, id: string, props?: ChimeStackProps) {
    super(scope, id);

    const env = props?.environment || 'dev';

    // Chime App Instance ARN (placeholder - actual instance created via Chime API)
    this.chimeAppInstanceArn = `arn:aws:chime:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:app-instance/warmpawz-${env}`;

    // IAM Role for Chime operations
    this.chimeRole = new iam.Role(this, 'ChimeRole', {
      roleName: `warmpawz-${env}-chime-role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      description: 'Role for Chime SDK operations',
    });

    // Add Chime permissions
    this.chimeRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'chime:CreateMeeting',
        'chime:CreateMeetingWithAttendees',
        'chime:DeleteMeeting',
        'chime:GetMeeting',
        'chime:ListMeetings',
        'chime:CreateAttendee',
        'chime:BatchCreateAttendee',
        'chime:DeleteAttendee',
        'chime:GetAttendee',
        'chime:ListAttendees',
        'chime:StartMeetingTranscription',
        'chime:StopMeetingTranscription',
      ],
      resources: ['*'],
    }));

    // Add CloudWatch Logs permissions
    this.chimeRole.addToPolicy(new iam.PolicyStatement({
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

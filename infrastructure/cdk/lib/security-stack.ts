/**
 * AWS CDK STACK - SECURITY
 * Defines security groups for Lambda and API Gateway
 */

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';

export interface SecurityStackProps {
  vpc: ec2.IVpc;
}

export class SecurityStack extends Construct {
  public readonly lambdaSecurityGroup: ec2.SecurityGroup;
  public readonly apiSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: SecurityStackProps) {
    super(scope, id);

    // Lambda Security Group
    this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // API Security Group
    this.apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for API Gateway',
      allowAllOutbound: true,
    });

    // Allow Lambda to communicate with API
    this.lambdaSecurityGroup.addIngressRule(
      this.apiSecurityGroup,
      ec2.Port.allTcp(),
      'Allow API to communicate with Lambda'
    );
  }
}

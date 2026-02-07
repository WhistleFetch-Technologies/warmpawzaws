#!/usr/bin/env node
/**
 * ============================================================================
 * AWS CDK APPLICATION ENTRY POINT
 * ============================================================================
 * 
 * Entry point for CDK application - creates stacks for each environment
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { WarmpawzStack } from '../lib/warmpawz-stack';

const app = new cdk.App();

// Get environment from context or use 'dev' as default
const environments = ['dev', 'staging', 'prod'];

environments.forEach((env) => {
  new WarmpawzStack(app, `WarmpawzStack-${env}`, {
    environment: env,
    env: {
      account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
      region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'ap-south-1',
    },
    description: `Warmpawz Platform Infrastructure - ${env.toUpperCase()}`,
    tags: {
      Environment: env,
      Project: 'Warmpawz',
      ManagedBy: 'CDK',
    },
  });
});

app.synth();

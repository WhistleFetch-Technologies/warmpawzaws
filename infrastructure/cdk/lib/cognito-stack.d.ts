/**
 * ============================================================================
 * AWS CDK STACK - COGNITO USER POOLS
 * ============================================================================
 *
 * Defines Cognito User Pools for authentication
 * - Customer Pool
 * - Vendor Pool
 * - Admin Pool
 *
 * Date: 2026-01-02
 * ============================================================================
 */
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';
export declare class CognitoStack extends Construct {
    readonly customerPool: cognito.UserPool;
    readonly customerPoolClient: cognito.UserPoolClient;
    readonly vendorPool: cognito.UserPool;
    readonly vendorPoolClient: cognito.UserPoolClient;
    readonly adminPool: cognito.UserPool;
    readonly adminPoolClient: cognito.UserPoolClient;
    constructor(scope: Construct, id: string);
}

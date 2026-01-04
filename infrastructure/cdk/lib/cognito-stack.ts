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

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export class CognitoStack extends Construct {
  public readonly customerPool: cognito.UserPool;
  public readonly customerPoolClient: cognito.UserPoolClient;
  public readonly vendorPool: cognito.UserPool;
  public readonly vendorPoolClient: cognito.UserPoolClient;
  public readonly adminPool: cognito.UserPool;
  public readonly adminPoolClient: cognito.UserPoolClient;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // =========================================================================
    // CUSTOMER USER POOL
    // =========================================================================
    this.customerPool = new cognito.UserPool(this, 'CustomerUserPool', {
      userPoolName: 'warmpawz-customers',
      selfSignUpEnabled: true,
      signInAliases: {
        phone: true,
        email: false,
        username: true,
      },
      autoVerify: {
        phone: true,
      },
      standardAttributes: {
        phoneNumber: {
          required: true,
          mutable: false,
        },
        email: {
          required: false,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      customAttributes: {
        user_type: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: false }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.PHONE_ONLY_WITHOUT_MFA,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.customerPoolClient = this.customerPool.addClient('CustomerWebClient', {
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // =========================================================================
    // VENDOR USER POOL
    // =========================================================================
    this.vendorPool = new cognito.UserPool(this, 'VendorUserPool', {
      userPoolName: 'warmpawz-vendors',
      selfSignUpEnabled: true,
      signInAliases: {
        phone: true,
        email: true,
        username: true,
      },
      autoVerify: {
        phone: true,
        email: true,
      },
      standardAttributes: {
        phoneNumber: {
          required: true,
          mutable: false,
        },
        email: {
          required: true,
          mutable: true,
        },
      },
      customAttributes: {
        user_type: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: false }),
        vendor_id: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: false }),
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.PHONE_ONLY_WITHOUT_MFA,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.vendorPoolClient = this.vendorPool.addClient('VendorWebClient', {
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
    });

    // =========================================================================
    // ADMIN USER POOL
    // =========================================================================
    this.adminPool = new cognito.UserPool(this, 'AdminUserPool', {
      userPoolName: 'warmpawz-admins',
      selfSignUpEnabled: false, // Admin users must be created manually
      signInAliases: {
        email: true,
        username: true,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: false,
        },
      },
      customAttributes: {
        user_type: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: false }),
        admin_role: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
      },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      mfa: cognito.Mfa.OPTIONAL,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.adminPoolClient = this.adminPool.addClient('AdminWebClient', {
      authFlows: {
        adminUserPassword: true,
        userPassword: true,
        userSrp: true,
      },
      generateSecret: false,
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(7), // Shorter for admin
    });

    // Outputs will be created at the parent stack level
  }
}


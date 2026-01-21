/**
 * ============================================================================
 * AWS CDK STACK - API GATEWAY (FIXED)
 * ============================================================================
 * 
 * Defines API Gateway with Lambda integration
 * Uses HTTP API v2 for better performance and lower cost
 * 
 * Date: 2026-01-08
 * ============================================================================
 */

import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';
import { CognitoStack } from './cognito-stack';
import { Route53Stack } from './route53-stack';

export interface ApiGatewayStackProps {
  cognitoStack: CognitoStack;
  route53Stack?: Route53Stack;
  environment?: string;
}

export class ApiGatewayStack extends Construct {
  public readonly api: apigateway.HttpApi;
  public apiDomain?: apigatewayv2.DomainName;
  public readonly customerAuthorizer: authorizers.HttpUserPoolAuthorizer;
  public readonly vendorAuthorizer: authorizers.HttpUserPoolAuthorizer;
  public readonly adminAuthorizer: authorizers.HttpUserPoolAuthorizer;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id);

    // Create Cognito JWT Authorizers for each user pool
    this.customerAuthorizer = new authorizers.HttpUserPoolAuthorizer(
      'CustomerAuthorizer',
      props.cognitoStack.customerPool,
      {
        userPoolClients: [props.cognitoStack.customerPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    this.vendorAuthorizer = new authorizers.HttpUserPoolAuthorizer(
      'VendorAuthorizer',
      props.cognitoStack.vendorPool,
      {
        userPoolClients: [props.cognitoStack.vendorPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    this.adminAuthorizer = new authorizers.HttpUserPoolAuthorizer(
      'AdminAuthorizer',
      props.cognitoStack.adminPool,
      {
        userPoolClients: [props.cognitoStack.adminPoolClient],
        identitySource: ['$request.header.Authorization'],
      }
    );

    // Create HTTP API v2 (better performance and lower cost than REST API)
    // FIXED: When using wildcard origins, we cannot use allowCredentials
    // For dev, use specific origins without credentials to avoid CORS issues
    const allowedOrigins = props.environment === 'prod'
      ? ['https://warmpawz.com', 'https://www.warmpawz.com', 'https://customer.warmpawz.com', 'https://vendor.warmpawz.com', 'https://admin.warmpawz.com']
      : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://127.0.0.1:3000', 'http://127.0.0.1:3001', 'http://127.0.0.1:3002']; // Specific origins for dev
    
    // Create API without CORS preflight (CORS handled in Lambda function)
    // This avoids CDK validation errors with allowCredentials and wildcard origins
    this.api = new apigateway.HttpApi(this, 'WarmpawzApi', {
      apiName: `warmpawz-api-${props.environment || 'dev'}`,
      description: 'Warmpawz Platform API Gateway',
      // CORS is handled in the Lambda function to avoid CDK validation issues
    });

    // Create custom domain if Route53 stack is provided
    if (props.route53Stack && props.route53Stack.certificate) {
      this.apiDomain = new apigatewayv2.DomainName(this, 'ApiDomain', {
        domainName: props.route53Stack.apiDomainName,
        certificate: props.route53Stack.certificate,
      });

      // Create API mapping
      new apigatewayv2.ApiMapping(this, 'ApiMapping', {
        api: this.api,
        domainName: this.apiDomain,
        stage: this.api.defaultStage,
      });
    }
  }

  /**
   * Add a route with Cognito authorization
   * @param path Route path (supports {proxy+} pattern)
   * @param methods HTTP methods
   * @param integration Lambda integration
   * @param authorizer Cognito authorizer type ('customer', 'vendor', or 'admin')
   */
  public addAuthorizedRoute(
    path: string,
    methods: apigateway.HttpMethod[],
    integration: integrations.HttpLambdaIntegration,
    authorizer: 'customer' | 'vendor' | 'admin'
  ): void {
    const selectedAuthorizer =
      authorizer === 'customer' ? this.customerAuthorizer :
      authorizer === 'vendor' ? this.vendorAuthorizer :
      this.adminAuthorizer;

    this.api.addRoutes({
      path,
      methods,
      integration,
      authorizer: selectedAuthorizer,
    });
  }

  /**
   * Add custom domain to API Gateway
   * Called after Route53 stack is created
   */
  public addCustomDomain(route53Stack: Route53Stack): void {
    if (!this.apiDomain) {
      this.apiDomain = new apigatewayv2.DomainName(this, 'ApiDomain', {
        domainName: route53Stack.apiDomainName,
        certificate: route53Stack.certificate,
      });

      // Create API mapping
      new apigatewayv2.ApiMapping(this, 'ApiMapping', {
        api: this.api,
        domainName: this.apiDomain,
        stage: this.api.defaultStage,
      });
    }
  }

  /**
   * Create API Gateway DNS records in Route53
   */
  public createApiGatewayRecords(route53Stack: Route53Stack): void {
    // This will be handled by Route53Stack
    // API Gateway domain is already configured above
  }
}

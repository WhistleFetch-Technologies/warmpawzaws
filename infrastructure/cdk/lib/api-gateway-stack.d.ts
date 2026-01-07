import * as apigateway from 'aws-cdk-lib/aws-apigatewayv2';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as authorizers from 'aws-cdk-lib/aws-apigatewayv2-authorizers';
import { Construct } from 'constructs';
import { CognitoStack } from './cognito-stack';
import { Route53Stack } from './route53-stack';
export interface ApiGatewayStackProps {
    cognitoStack: CognitoStack;
    route53Stack?: Route53Stack;
    environment?: string;
}
export declare class ApiGatewayStack extends Construct {
    readonly api: apigateway.HttpApi;
    apiDomain?: apigatewayv2.DomainName;
    readonly customerAuthorizer: authorizers.HttpUserPoolAuthorizer;
    readonly vendorAuthorizer: authorizers.HttpUserPoolAuthorizer;
    readonly adminAuthorizer: authorizers.HttpUserPoolAuthorizer;
    constructor(scope: Construct, id: string, props: ApiGatewayStackProps);
    /**
     * Add a route with Cognito authorization
     * @param path Route path
     * @param methods HTTP methods
     * @param integration Lambda integration
     * @param authorizer Cognito authorizer (customer, vendor, or admin)
     */
    addAuthorizedRoute(path: string, methods: apigateway.HttpMethod[], integration: apigateway.HttpRouteIntegration, authorizer: 'customer' | 'vendor' | 'admin'): void;
    /**
     * Add custom domain to API Gateway
     * Called after Route53 stack is created
     */
    addCustomDomain(route53Stack: Route53Stack): void;
}

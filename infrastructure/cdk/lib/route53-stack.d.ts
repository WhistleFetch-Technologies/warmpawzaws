import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';
import { ApiGatewayStack } from './api-gateway-stack';
import { S3Stack } from './s3-stack';
export interface Route53StackProps {
    apiGatewayStack: ApiGatewayStack;
    s3Stack: S3Stack;
    environment: string;
}
export declare class Route53Stack extends Construct {
    readonly hostedZone: route53.HostedZone;
    readonly certificate: acm.Certificate;
    readonly apiDomainName: string;
    readonly customerAppDomain: string;
    readonly vendorAppDomain: string;
    readonly adminDomain: string;
    private apiARecord?;
    private apiAaaaRecord?;
    constructor(scope: Construct, id: string, props: Route53StackProps);
    /**
     * Create API Gateway DNS records
     * Called after API Gateway custom domain is created
     */
    createApiGatewayRecords(apiGatewayStack: ApiGatewayStack): void;
}

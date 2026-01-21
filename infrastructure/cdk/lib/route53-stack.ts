/**
 * ============================================================================
 * AWS CDK STACK - ROUTE53 AND CUSTOM DOMAINS
 * ============================================================================
 * 
 * Defines Route53 hosted zones, certificates, and DNS records
 * for custom domain configuration
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import * as cdk from 'aws-cdk-lib';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import { Construct } from 'constructs';
import { ApiGatewayStack } from './api-gateway-stack';
import { S3Stack } from './s3-stack';

export interface Route53StackProps {
  apiGatewayStack: ApiGatewayStack;
  s3Stack: S3Stack;
  environment: string;
}

export class Route53Stack extends Construct {
  public readonly hostedZone: route53.IHostedZone;
  public readonly certificate: acm.ICertificate;
  public readonly apiDomainName: string;
  public readonly customerAppDomain: string;
  public readonly vendorAppDomain: string;
  public readonly adminDomain: string;

  private apiARecord?: route53.ARecord;
  private apiAaaaRecord?: route53.AaaaRecord;

  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id);

    const baseDomain = 'warmpawz.com';
    const envPrefix = props.environment === 'prod' ? '' : `${props.environment}.`;

    // Set domain names
    this.apiDomainName = `${envPrefix}api.${baseDomain}`;
    this.customerAppDomain = `${envPrefix}customer.${baseDomain}`;
    this.vendorAppDomain = `${envPrefix}vendor.${baseDomain}`;
    this.adminDomain = `${envPrefix}admin.${baseDomain}`;

    // Try to look up existing hosted zone, otherwise create placeholder
    try {
      this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: baseDomain,
      });
    } catch {
      // If lookup fails, create a public hosted zone
      this.hostedZone = new route53.PublicHostedZone(this, 'HostedZone', {
        zoneName: baseDomain,
        comment: `Hosted zone for ${baseDomain} - ${props.environment}`,
      });
    }

    // Create or import certificate
    // Note: In production, you would typically import an existing certificate
    // or create one with DNS validation
    try {
      // Try to create a certificate with DNS validation
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: baseDomain,
        subjectAlternativeNames: [
          `*.${baseDomain}`,
          `*.${envPrefix}${baseDomain}`,
        ],
        validation: acm.CertificateValidation.fromDns(this.hostedZone as route53.IHostedZone),
      });
    } catch {
      // If certificate creation fails, use a placeholder
      // This is mainly for environments where Route53 is not the DNS provider
      this.certificate = acm.Certificate.fromCertificateArn(
        this,
        'ImportedCertificate',
        `arn:aws:acm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:certificate/placeholder`
      );
    }
  }

  /**
   * Create API Gateway DNS records
   * Called after API Gateway custom domain is created
   */
  public createApiGatewayRecords(apiGatewayStack: ApiGatewayStack): void {
    if (!apiGatewayStack.apiDomain) {
      console.log('[Route53Stack] No API domain configured, skipping DNS records');
      return;
    }

    // Create A record for API Gateway
    this.apiARecord = new route53.ARecord(this, 'ApiARecord', {
      zone: this.hostedZone as route53.IHostedZone,
      recordName: this.apiDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          apiGatewayStack.apiDomain.regionalDomainName,
          apiGatewayStack.apiDomain.regionalHostedZoneId
        )
      ),
    });

    // Create AAAA record for API Gateway (IPv6)
    this.apiAaaaRecord = new route53.AaaaRecord(this, 'ApiAaaaRecord', {
      zone: this.hostedZone as route53.IHostedZone,
      recordName: this.apiDomainName,
      target: route53.RecordTarget.fromAlias(
        new targets.ApiGatewayv2DomainProperties(
          apiGatewayStack.apiDomain.regionalDomainName,
          apiGatewayStack.apiDomain.regionalHostedZoneId
        )
      ),
    });
  }
}

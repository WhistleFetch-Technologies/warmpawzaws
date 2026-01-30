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
  public readonly hostedZone?: route53.IHostedZone;
  public readonly certificate?: acm.ICertificate;
  public readonly apiDomainName: string;
  public readonly customerAppDomain: string;
  public readonly vendorAppDomain: string;
  public readonly adminDomain: string;
  public readonly isCustomDomainEnabled: boolean = false;

  private apiARecord?: route53.ARecord;
  private apiAaaaRecord?: route53.AaaaRecord;

  constructor(scope: Construct, id: string, props: Route53StackProps) {
    super(scope, id);

    const baseDomain = 'warmpawz.com';
    const envPrefix = props.environment === 'prod' ? '' : `${props.environment}.`;

    // Set domain names
    // For non-prod environments, use subdomain.env.warmpawz.com format
    // This ensures coverage by *.env.warmpawz.com certificate SAN
    // e.g., api.dev.warmpawz.com (covered by *.dev.warmpawz.com)
    if (props.environment === 'prod') {
      this.apiDomainName = `api.${baseDomain}`;
      this.customerAppDomain = `customer.${baseDomain}`;
      this.vendorAppDomain = `vendor.${baseDomain}`;
      this.adminDomain = `admin.${baseDomain}`;
    } else {
      this.apiDomainName = `api.${props.environment}.${baseDomain}`;
      this.customerAppDomain = `customer.${props.environment}.${baseDomain}`;
      this.vendorAppDomain = `vendor.${props.environment}.${baseDomain}`;
      this.adminDomain = `admin.${props.environment}.${baseDomain}`;
    }

    // Check if custom domain should be enabled
    // Can be disabled via context or environment variable
    const skipCustomDomain = this.node.tryGetContext('skipCustomDomain') === 'true' ||
                              process.env.SKIP_CUSTOM_DOMAIN === 'true';
    
    if (skipCustomDomain) {
      console.log('[Route53Stack] Custom domain setup skipped via configuration');
      return;
    }

    // Try to look up existing hosted zone
    try {
      this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: baseDomain,
      });
      
      // Check if hostedZone is a valid lookup (not dummy values from synth)
      if (!this.hostedZone.hostedZoneId || this.hostedZone.hostedZoneId === 'DUMMY') {
        console.log('[Route53Stack] Hosted zone lookup returned dummy value - skipping custom domain');
        return;
      }
    } catch (error) {
      console.log('[Route53Stack] Hosted zone lookup failed - skipping custom domain setup');
      console.log('[Route53Stack] To enable custom domains, create a hosted zone for', baseDomain);
      return;
    }

    // Create or import certificate
    // For non-prod environments, use subdomain format that matches wildcard cert
    // e.g., api.dev.warmpawz.com covered by *.dev.warmpawz.com
    try {
      const certDomains = props.environment === 'prod'
        ? [baseDomain, `*.${baseDomain}`]
        : [baseDomain, `*.${baseDomain}`, `*.${props.environment}.${baseDomain}`];
      
      this.certificate = new acm.Certificate(this, 'Certificate', {
        domainName: baseDomain,
        subjectAlternativeNames: certDomains.slice(1), // All except the main domain
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
      });
      
      // Mark custom domain as enabled only if we got here
      (this as any).isCustomDomainEnabled = true;
      console.log('[Route53Stack] Custom domain setup enabled');
      console.log('[Route53Stack] API Domain:', this.apiDomainName);
      console.log('[Route53Stack] Certificate covers:', certDomains.join(', '));
    } catch (error) {
      console.log('[Route53Stack] Certificate creation failed - custom domain disabled');
      console.log('[Route53Stack] Error:', error);
    }
  }

  /**
   * Create API Gateway DNS records
   * Called after API Gateway custom domain is created
   */
  public createApiGatewayRecords(apiGatewayStack: ApiGatewayStack): void {
    if (!this.isCustomDomainEnabled || !this.hostedZone) {
      console.log('[Route53Stack] Custom domain not enabled, skipping DNS records');
      return;
    }
    
    if (!apiGatewayStack.apiDomain) {
      console.log('[Route53Stack] No API domain configured, skipping DNS records');
      return;
    }

    console.log('[Route53Stack] Creating DNS records for', this.apiDomainName);

    // Create A record for API Gateway
    this.apiARecord = new route53.ARecord(this, 'ApiARecord', {
      zone: this.hostedZone,
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
      zone: this.hostedZone,
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

"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Route53Stack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const constructs_1 = require("constructs");
class Route53Stack extends constructs_1.Construct {
    constructor(scope, id, props) {
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
        }
        catch {
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
                validation: acm.CertificateValidation.fromDns(this.hostedZone),
            });
        }
        catch {
            // If certificate creation fails, use a placeholder
            // This is mainly for environments where Route53 is not the DNS provider
            this.certificate = acm.Certificate.fromCertificateArn(this, 'ImportedCertificate', `arn:aws:acm:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:certificate/placeholder`);
        }
    }
    /**
     * Create API Gateway DNS records
     * Called after API Gateway custom domain is created
     */
    createApiGatewayRecords(apiGatewayStack) {
        if (!apiGatewayStack.apiDomain) {
            console.log('[Route53Stack] No API domain configured, skipping DNS records');
            return;
        }
        // Create A record for API Gateway
        this.apiARecord = new route53.ARecord(this, 'ApiARecord', {
            zone: this.hostedZone,
            recordName: this.apiDomainName,
            target: route53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(apiGatewayStack.apiDomain.regionalDomainName, apiGatewayStack.apiDomain.regionalHostedZoneId)),
        });
        // Create AAAA record for API Gateway (IPv6)
        this.apiAaaaRecord = new route53.AaaaRecord(this, 'ApiAaaaRecord', {
            zone: this.hostedZone,
            recordName: this.apiDomainName,
            target: route53.RecordTarget.fromAlias(new targets.ApiGatewayv2DomainProperties(apiGatewayStack.apiDomain.regionalDomainName, apiGatewayStack.apiDomain.regionalHostedZoneId)),
        });
    }
}
exports.Route53Stack = Route53Stack;
//# sourceMappingURL=route53-stack.js.map
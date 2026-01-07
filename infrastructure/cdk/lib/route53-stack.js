"use strict";
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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Route53Stack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const route53 = __importStar(require("aws-cdk-lib/aws-route53"));
const route53Targets = __importStar(require("aws-cdk-lib/aws-route53-targets"));
const acm = __importStar(require("aws-cdk-lib/aws-certificatemanager"));
const constructs_1 = require("constructs");
class Route53Stack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const domainName = 'warmpawz.com';
        const environment = props.environment;
        // Lookup existing hosted zone (confirmed: warmpawz.com exists in Route 53)
        this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
            domainName: domainName,
        });
        // Set domain names based on environment
        if (environment === 'prod') {
            this.apiDomainName = `api.${domainName}`;
            this.customerAppDomain = `customer.${domainName}`;
            this.vendorAppDomain = `vendor.${domainName}`;
            this.adminDomain = `admin.${domainName}`;
        }
        else {
            this.apiDomainName = `api-${environment}.${domainName}`;
            this.customerAppDomain = `customer-${environment}.${domainName}`;
            this.vendorAppDomain = `vendor-${environment}.${domainName}`;
            this.adminDomain = `admin-${environment}.${domainName}`;
        }
        // Create SSL certificate for API Gateway custom domain
        this.certificate = new acm.Certificate(this, 'ApiCertificate', {
            domainName: this.apiDomainName,
            subjectAlternativeNames: [
                `*.${domainName}`, // Wildcard for all subdomains
            ],
            validation: acm.CertificateValidation.fromDns(this.hostedZone),
        });
        // Customer App CloudFront A record
        new route53.ARecord(this, 'CustomerAppARecord', {
            zone: this.hostedZone,
            recordName: this.customerAppDomain,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(props.s3Stack.distribution)),
            ttl: cdk.Duration.minutes(5),
        });
        // Vendor App CloudFront A record
        new route53.ARecord(this, 'VendorAppARecord', {
            zone: this.hostedZone,
            recordName: this.vendorAppDomain,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(props.s3Stack.distribution)),
            ttl: cdk.Duration.minutes(5),
        });
        // Admin Portal CloudFront A record
        new route53.ARecord(this, 'AdminARecord', {
            zone: this.hostedZone,
            recordName: this.adminDomain,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(props.s3Stack.distribution)),
            ttl: cdk.Duration.minutes(5),
        });
        // APK Download subdomains
        const apkDomain = environment === 'prod'
            ? `apk.${domainName}`
            : `apk-${environment}.${domainName}`;
        new route53.ARecord(this, 'ApkARecord', {
            zone: this.hostedZone,
            recordName: apkDomain,
            target: route53.RecordTarget.fromAlias(new route53Targets.CloudFrontTarget(props.s3Stack.apkDistribution)),
            ttl: cdk.Duration.minutes(5),
        });
        // API Gateway DNS records will be created via createApiGatewayRecords()
        // Called from warmpawz-stack.ts after apiDomain is available
    }
    /**
     * Create API Gateway DNS records
     * Called after API Gateway custom domain is created
     */
    createApiGatewayRecords(apiGatewayStack) {
        if (apiGatewayStack.apiDomain) {
            // API Gateway A record
            this.apiARecord = new route53.ARecord(this, 'ApiARecord', {
                zone: this.hostedZone,
                recordName: this.apiDomainName,
                target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayv2DomainProperties(apiGatewayStack.apiDomain.regionalDomainName, apiGatewayStack.apiDomain.regionalHostedZoneId)),
                ttl: cdk.Duration.minutes(5),
            });
            // API Gateway AAAA record (IPv6)
            this.apiAaaaRecord = new route53.AaaaRecord(this, 'ApiAaaaRecord', {
                zone: this.hostedZone,
                recordName: this.apiDomainName,
                target: route53.RecordTarget.fromAlias(new route53Targets.ApiGatewayv2DomainProperties(apiGatewayStack.apiDomain.regionalDomainName, apiGatewayStack.apiDomain.regionalHostedZoneId)),
                ttl: cdk.Duration.minutes(5),
            });
        }
    }
}
exports.Route53Stack = Route53Stack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGU1My1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbInJvdXRlNTMtc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSxpREFBbUM7QUFDbkMsaUVBQW1EO0FBQ25ELGdGQUFrRTtBQUNsRSx3RUFBMEQ7QUFDMUQsMkNBQXVDO0FBVXZDLE1BQWEsWUFBYSxTQUFRLHNCQUFTO0lBVXpDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBd0I7UUFDaEUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLFVBQVUsR0FBRyxjQUFjLENBQUM7UUFDbEMsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLFdBQVcsQ0FBQztRQUV0QywyRUFBMkU7UUFDM0UsSUFBSSxDQUFDLFVBQVUsR0FBRyxPQUFPLENBQUMsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO1lBQ2xFLFVBQVUsRUFBRSxVQUFVO1NBQ3ZCLENBQXVCLENBQUM7UUFFekIsd0NBQXdDO1FBQ3hDLElBQUksV0FBVyxLQUFLLE1BQU0sRUFBRTtZQUMxQixJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sVUFBVSxFQUFFLENBQUM7WUFDekMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLFlBQVksVUFBVSxFQUFFLENBQUM7WUFDbEQsSUFBSSxDQUFDLGVBQWUsR0FBRyxVQUFVLFVBQVUsRUFBRSxDQUFDO1lBQzlDLElBQUksQ0FBQyxXQUFXLEdBQUcsU0FBUyxVQUFVLEVBQUUsQ0FBQztTQUMxQzthQUFNO1lBQ0wsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLFdBQVcsSUFBSSxVQUFVLEVBQUUsQ0FBQztZQUN4RCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsWUFBWSxXQUFXLElBQUksVUFBVSxFQUFFLENBQUM7WUFDakUsSUFBSSxDQUFDLGVBQWUsR0FBRyxVQUFVLFdBQVcsSUFBSSxV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VSxHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsWUFBWSxFQUFFO2dCQUN4RCxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVU7Z0JBQ3JCLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYTtnQkFDOUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUNwQyxJQUFJLGNBQWMsQ0FBQyw0QkFBNEIsQ0FDN0MsZUFBZSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFDNUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FDL0MsQ0FDRjtnQkFDRCxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQzdCLENBQUMsQ0FBQztZQUVILGlDQUFpQztZQUNqQyxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEVBQUUsZUFBZSxFQUFFO2dCQUNqRSxJQUFJLEVBQUUsSUFBSSxDQUFDLFVBQVU7Z0JBQ3JCLFVBQVUsRUFBRSxJQUFJLENBQUMsYUFBYTtnQkFDOUIsTUFBTSxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUNwQyxJQUFJLGNBQWMsQ0FBQyw0QkFBNEIsQ0FDN0MsZUFBZSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsRUFDNUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxvQkFBb0IsQ0FDL0MsQ0FDRjtnQkFDRCxHQUFHLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO2FBQzdCLENBQUMsQ0FBQztTQUNKO0lBQ0gsQ0FBQztDQUNGO0FBNUhELG9DQTRIQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyByb3V0ZTUzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzJztcbmltcG9ydCAqIGFzIHJvdXRlNTNUYXJnZXRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1yb3V0ZTUzLXRhcmdldHMnO1xuaW1wb3J0ICogYXMgYWNtIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXInO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBBcGlHYXRld2F5U3RhY2sgfSBmcm9tICcuL2FwaS1nYXRld2F5LXN0YWNrJztcbmltcG9ydCB7IFMzU3RhY2sgfSBmcm9tICcuL3MzLXN0YWNrJztcblxuZXhwb3J0IGludGVyZmFjZSBSb3V0ZTUzU3RhY2tQcm9wcyB7XG4gIGFwaUdhdGV3YXlTdGFjazogQXBpR2F0ZXdheVN0YWNrO1xuICBzM1N0YWNrOiBTM1N0YWNrO1xuICBlbnZpcm9ubWVudDogc3RyaW5nOyAvLyAnZGV2JyB8ICd0ZXN0JyB8ICdwcm9kJ1xufVxuXG5leHBvcnQgY2xhc3MgUm91dGU1M1N0YWNrIGV4dGVuZHMgQ29uc3RydWN0IHtcbiAgcHVibGljIHJlYWRvbmx5IGhvc3RlZFpvbmU6IHJvdXRlNTMuSG9zdGVkWm9uZTtcbiAgcHVibGljIHJlYWRvbmx5IGNlcnRpZmljYXRlOiBhY20uQ2VydGlmaWNhdGU7XG4gIHB1YmxpYyByZWFkb25seSBhcGlEb21haW5OYW1lOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBjdXN0b21lckFwcERvbWFpbjogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgdmVuZG9yQXBwRG9tYWluOiBzdHJpbmc7XG4gIHB1YmxpYyByZWFkb25seSBhZG1pbkRvbWFpbjogc3RyaW5nO1xuICBwcml2YXRlIGFwaUFSZWNvcmQ/OiByb3V0ZTUzLkFSZWNvcmQ7XG4gIHByaXZhdGUgYXBpQWFhYVJlY29yZD86IHJvdXRlNTMuQWFhYVJlY29yZDtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogUm91dGU1M1N0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgY29uc3QgZG9tYWluTmFtZSA9ICd3YXJtcGF3ei5jb20nO1xuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQ7XG5cbiAgICAvLyBMb29rdXAgZXhpc3RpbmcgaG9zdGVkIHpvbmUgKGNvbmZpcm1lZDogd2FybXBhd3ouY29tIGV4aXN0cyBpbiBSb3V0ZSA1MylcbiAgICB0aGlzLmhvc3RlZFpvbmUgPSByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUxvb2t1cCh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgIGRvbWFpbk5hbWU6IGRvbWFpbk5hbWUsXG4gICAgfSkgYXMgcm91dGU1My5Ib3N0ZWRab25lO1xuXG4gICAgLy8gU2V0IGRvbWFpbiBuYW1lcyBiYXNlZCBvbiBlbnZpcm9ubWVudFxuICAgIGlmIChlbnZpcm9ubWVudCA9PT0gJ3Byb2QnKSB7XG4gICAgICB0aGlzLmFwaURvbWFpbk5hbWUgPSBgYXBpLiR7ZG9tYWluTmFtZX1gO1xuICAgICAgdGhpcy5jdXN0b21lckFwcERvbWFpbiA9IGBjdXN0b21lci4ke2RvbWFpbk5hbWV9YDtcbiAgICAgIHRoaXMudmVuZG9yQXBwRG9tYWluID0gYHZlbmRvci4ke2RvbWFpbk5hbWV9YDtcbiAgICAgIHRoaXMuYWRtaW5Eb21haW4gPSBgYWRtaW4uJHtkb21haW5OYW1lfWA7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuYXBpRG9tYWluTmFtZSA9IGBhcGktJHtlbnZpcm9ubWVudH0uJHtkb21haW5OYW1lfWA7XG4gICAgICB0aGlzLmN1c3RvbWVyQXBwRG9tYWluID0gYGN1c3RvbWVyLSR7ZW52aXJvbm1lbnR9LiR7ZG9tYWluTmFtZX1gO1xuICAgICAgdGhpcy52ZW5kb3JBcHBEb21haW4gPSBgdmVuZG9yLSR7ZW52aXJvbm1lbnR9LiR7ZG9tYWluTmFtZX1gO1xuICAgICAgdGhpcy5hZG1pbkRvbWFpbiA9IGBhZG1pbi0ke2Vudmlyb25tZW50fS4ke2RvbWFpbk5hbWV9YDtcbiAgICB9XG5cbiAgICAvLyBDcmVhdGUgU1NMIGNlcnRpZmljYXRlIGZvciBBUEkgR2F0ZXdheSBjdXN0b20gZG9tYWluXG4gICAgdGhpcy5jZXJ0aWZpY2F0ZSA9IG5ldyBhY20uQ2VydGlmaWNhdGUodGhpcywgJ0FwaUNlcnRpZmljYXRlJywge1xuICAgICAgZG9tYWluTmFtZTogdGhpcy5hcGlEb21haW5OYW1lLFxuICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFtcbiAgICAgICAgYCouJHtkb21haW5OYW1lfWAsIC8vIFdpbGRjYXJkIGZvciBhbGwgc3ViZG9tYWluc1xuICAgICAgXSxcbiAgICAgIHZhbGlkYXRpb246IGFjbS5DZXJ0aWZpY2F0ZVZhbGlkYXRpb24uZnJvbURucyh0aGlzLmhvc3RlZFpvbmUpLFxuICAgIH0pO1xuXG4gICAgLy8gQ3VzdG9tZXIgQXBwIENsb3VkRnJvbnQgQSByZWNvcmRcbiAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdDdXN0b21lckFwcEFSZWNvcmQnLCB7XG4gICAgICB6b25lOiB0aGlzLmhvc3RlZFpvbmUsXG4gICAgICByZWNvcmROYW1lOiB0aGlzLmN1c3RvbWVyQXBwRG9tYWluLFxuICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgIG5ldyByb3V0ZTUzVGFyZ2V0cy5DbG91ZEZyb250VGFyZ2V0KHByb3BzLnMzU3RhY2suZGlzdHJpYnV0aW9uKVxuICAgICAgKSxcbiAgICAgIHR0bDogY2RrLkR1cmF0aW9uLm1pbnV0ZXMoNSksXG4gICAgfSk7XG5cbiAgICAvLyBWZW5kb3IgQXBwIENsb3VkRnJvbnQgQSByZWNvcmRcbiAgICBuZXcgcm91dGU1My5BUmVjb3JkKHRoaXMsICdWZW5kb3JBcHBBUmVjb3JkJywge1xuICAgICAgem9uZTogdGhpcy5ob3N0ZWRab25lLFxuICAgICAgcmVjb3JkTmFtZTogdGhpcy52ZW5kb3JBcHBEb21haW4sXG4gICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhcbiAgICAgICAgbmV3IHJvdXRlNTNUYXJnZXRzLkNsb3VkRnJvbnRUYXJnZXQocHJvcHMuczNTdGFjay5kaXN0cmlidXRpb24pXG4gICAgICApLFxuICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICB9KTtcblxuICAgIC8vIEFkbWluIFBvcnRhbCBDbG91ZEZyb250IEEgcmVjb3JkXG4gICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnQWRtaW5BUmVjb3JkJywge1xuICAgICAgem9uZTogdGhpcy5ob3N0ZWRab25lLFxuICAgICAgcmVjb3JkTmFtZTogdGhpcy5hZG1pbkRvbWFpbixcbiAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKFxuICAgICAgICBuZXcgcm91dGU1M1RhcmdldHMuQ2xvdWRGcm9udFRhcmdldChwcm9wcy5zM1N0YWNrLmRpc3RyaWJ1dGlvbilcbiAgICAgICksXG4gICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gQVBLIERvd25sb2FkIHN1YmRvbWFpbnNcbiAgICBjb25zdCBhcGtEb21haW4gPSBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnIFxuICAgICAgPyBgYXBrLiR7ZG9tYWluTmFtZX1gIFxuICAgICAgOiBgYXBrLSR7ZW52aXJvbm1lbnR9LiR7ZG9tYWluTmFtZX1gO1xuXG4gICAgbmV3IHJvdXRlNTMuQVJlY29yZCh0aGlzLCAnQXBrQVJlY29yZCcsIHtcbiAgICAgIHpvbmU6IHRoaXMuaG9zdGVkWm9uZSxcbiAgICAgIHJlY29yZE5hbWU6IGFwa0RvbWFpbixcbiAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKFxuICAgICAgICBuZXcgcm91dGU1M1RhcmdldHMuQ2xvdWRGcm9udFRhcmdldChwcm9wcy5zM1N0YWNrLmFwa0Rpc3RyaWJ1dGlvbilcbiAgICAgICksXG4gICAgICB0dGw6IGNkay5EdXJhdGlvbi5taW51dGVzKDUpLFxuICAgIH0pO1xuXG4gICAgLy8gQVBJIEdhdGV3YXkgRE5TIHJlY29yZHMgd2lsbCBiZSBjcmVhdGVkIHZpYSBjcmVhdGVBcGlHYXRld2F5UmVjb3JkcygpXG4gICAgLy8gQ2FsbGVkIGZyb20gd2FybXBhd3otc3RhY2sudHMgYWZ0ZXIgYXBpRG9tYWluIGlzIGF2YWlsYWJsZVxuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBBUEkgR2F0ZXdheSBETlMgcmVjb3Jkc1xuICAgKiBDYWxsZWQgYWZ0ZXIgQVBJIEdhdGV3YXkgY3VzdG9tIGRvbWFpbiBpcyBjcmVhdGVkXG4gICAqL1xuICBwdWJsaWMgY3JlYXRlQXBpR2F0ZXdheVJlY29yZHMoYXBpR2F0ZXdheVN0YWNrOiBBcGlHYXRld2F5U3RhY2spOiB2b2lkIHtcbiAgICBpZiAoYXBpR2F0ZXdheVN0YWNrLmFwaURvbWFpbikge1xuICAgICAgLy8gQVBJIEdhdGV3YXkgQSByZWNvcmRcbiAgICAgIHRoaXMuYXBpQVJlY29yZCA9IG5ldyByb3V0ZTUzLkFSZWNvcmQodGhpcywgJ0FwaUFSZWNvcmQnLCB7XG4gICAgICAgIHpvbmU6IHRoaXMuaG9zdGVkWm9uZSxcbiAgICAgICAgcmVjb3JkTmFtZTogdGhpcy5hcGlEb21haW5OYW1lLFxuICAgICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhcbiAgICAgICAgICBuZXcgcm91dGU1M1RhcmdldHMuQXBpR2F0ZXdheXYyRG9tYWluUHJvcGVydGllcyhcbiAgICAgICAgICAgIGFwaUdhdGV3YXlTdGFjay5hcGlEb21haW4ucmVnaW9uYWxEb21haW5OYW1lLFxuICAgICAgICAgICAgYXBpR2F0ZXdheVN0YWNrLmFwaURvbWFpbi5yZWdpb25hbEhvc3RlZFpvbmVJZFxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBBUEkgR2F0ZXdheSBBQUFBIHJlY29yZCAoSVB2NilcbiAgICAgIHRoaXMuYXBpQWFhYVJlY29yZCA9IG5ldyByb3V0ZTUzLkFhYWFSZWNvcmQodGhpcywgJ0FwaUFhYWFSZWNvcmQnLCB7XG4gICAgICAgIHpvbmU6IHRoaXMuaG9zdGVkWm9uZSxcbiAgICAgICAgcmVjb3JkTmFtZTogdGhpcy5hcGlEb21haW5OYW1lLFxuICAgICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyhcbiAgICAgICAgICBuZXcgcm91dGU1M1RhcmdldHMuQXBpR2F0ZXdheXYyRG9tYWluUHJvcGVydGllcyhcbiAgICAgICAgICAgIGFwaUdhdGV3YXlTdGFjay5hcGlEb21haW4ucmVnaW9uYWxEb21haW5OYW1lLFxuICAgICAgICAgICAgYXBpR2F0ZXdheVN0YWNrLmFwaURvbWFpbi5yZWdpb25hbEhvc3RlZFpvbmVJZFxuICAgICAgICAgIClcbiAgICAgICAgKSxcbiAgICAgICAgdHRsOiBjZGsuRHVyYXRpb24ubWludXRlcyg1KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19
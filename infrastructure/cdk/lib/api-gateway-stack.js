"use strict";
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
exports.ApiGatewayStack = void 0;
const apigateway = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const authorizers = __importStar(require("aws-cdk-lib/aws-apigatewayv2-authorizers"));
const constructs_1 = require("constructs");
class ApiGatewayStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Create Cognito JWT Authorizers for each user pool
        this.customerAuthorizer = new authorizers.HttpUserPoolAuthorizer('CustomerAuthorizer', props.cognitoStack.customerPool, {
            userPoolClients: [props.cognitoStack.customerPoolClient],
            identitySource: ['$request.header.Authorization'],
        });
        this.vendorAuthorizer = new authorizers.HttpUserPoolAuthorizer('VendorAuthorizer', props.cognitoStack.vendorPool, {
            userPoolClients: [props.cognitoStack.vendorPoolClient],
            identitySource: ['$request.header.Authorization'],
        });
        this.adminAuthorizer = new authorizers.HttpUserPoolAuthorizer('AdminAuthorizer', props.cognitoStack.adminPool, {
            userPoolClients: [props.cognitoStack.adminPoolClient],
            identitySource: ['$request.header.Authorization'],
        });
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
    addAuthorizedRoute(path, methods, integration, authorizer) {
        const selectedAuthorizer = authorizer === 'customer' ? this.customerAuthorizer :
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
    addCustomDomain(route53Stack) {
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
    createApiGatewayRecords(route53Stack) {
        // This will be handled by Route53Stack
        // API Gateway domain is already configured above
    }
}
exports.ApiGatewayStack = ApiGatewayStack;
//# sourceMappingURL=api-gateway-stack.js.map
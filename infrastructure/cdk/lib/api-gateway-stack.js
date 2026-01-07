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
exports.ApiGatewayStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const apigateway = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const apigatewayv2 = __importStar(require("aws-cdk-lib/aws-apigatewayv2"));
const authorizers = __importStar(require("aws-cdk-lib/aws-apigatewayv2-authorizers"));
const constructs_1 = require("constructs");
class ApiGatewayStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Create Cognito JWT Authorizers for each user pool
        // Note: Using HttpUserPoolAuthorizer from aws-apigatewayv2-authorizers
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
        // Create HTTP API
        this.api = new apigateway.HttpApi(this, 'WarmpawzApi', {
            apiName: `warmpawz-api-${props.environment || 'dev'}`,
            description: 'Warmpawz Platform API Gateway',
            corsPreflight: {
                allowOrigins: props.environment === 'prod'
                    ? ['https://warmpawz.com', 'https://www.warmpawz.com']
                    : ['*'],
                allowMethods: [
                    apigateway.CorsHttpMethod.GET,
                    apigateway.CorsHttpMethod.POST,
                    apigateway.CorsHttpMethod.PUT,
                    apigateway.CorsHttpMethod.DELETE,
                    apigateway.CorsHttpMethod.PATCH,
                    apigateway.CorsHttpMethod.OPTIONS,
                ],
                allowHeaders: [
                    'Content-Type',
                    'Authorization',
                    'X-Amz-Date',
                    'X-Api-Key',
                    'X-Amz-Security-Token',
                    'X-Client-Info',
                    'X-User-Role', // For role-based routing
                ],
                maxAge: cdk.Duration.days(1),
            },
            // Note: Default authorizer can be set per route
            // Use customerAuthorizer as default for public endpoints
        });
        // Create custom domain if Route53 stack is provided
        // Note: This will be created after Route53 stack is initialized
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
        // Cognito authorizers are now configured and ready to use
        // Routes can specify which authorizer to use when added
    }
    /**
     * Add a route with Cognito authorization
     * @param path Route path
     * @param methods HTTP methods
     * @param integration Lambda integration
     * @param authorizer Cognito authorizer (customer, vendor, or admin)
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
}
exports.ApiGatewayStack = ApiGatewayStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBpLWdhdGV3YXktc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJhcGktZ2F0ZXdheS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5RUFBMkQ7QUFDM0QsMkVBQTZEO0FBQzdELHNGQUF3RTtBQUN4RSwyQ0FBdUM7QUFVdkMsTUFBYSxlQUFnQixTQUFRLHNCQUFTO0lBTzVDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBMkI7UUFDbkUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixvREFBb0Q7UUFDcEQsdUVBQXVFO1FBQ3ZFLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLFdBQVcsQ0FBQyxzQkFBc0IsQ0FDOUQsb0JBQW9CLEVBQ3BCLEtBQUssQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUMvQjtZQUNFLGVBQWUsRUFBRSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUMsa0JBQWtCLENBQUM7WUFDeEQsY0FBYyxFQUFFLENBQUMsK0JBQStCLENBQUM7U0FDbEQsQ0FDRixDQUFDO1FBRUYsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksV0FBVyxDQUFDLHNCQUFzQixDQUM1RCxrQkFBa0IsRUFDbEIsS0FBSyxDQUFDLFlBQVksQ0FBQyxVQUFVLEVBQzdCO1lBQ0UsZUFBZSxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQztZQUN0RCxjQUFjLEVBQUUsQ0FBQywrQkFBK0IsQ0FBQztTQUNsRCxDQUNGLENBQUM7UUFFRixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksV0FBVyxDQUFDLHNCQUFzQixDQUMzRCxpQkFBaUIsRUFDakIsS0FBSyxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQzVCO1lBQ0UsZUFBZSxFQUFFLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQyxlQUFlLENBQUM7WUFDckQsY0FBYyxF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QUMsV0FBVzthQUN0QyxDQUFDLENBQUM7WUFFSCxxQkFBcUI7WUFDckIsSUFBSSxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxZQUFZLEVBQUU7Z0JBQzlDLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRztnQkFDYixVQUFVLEVBQUUsSUFBSSxDQUFDLFNBQVM7Z0JBQzFCLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLFlBQVk7YUFDN0IsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0NBQ0Y7QUF2SUQsMENBdUlDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJztcbmltcG9ydCAqIGFzIGFwaWdhdGV3YXkgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBhcGlnYXRld2F5djIgZnJvbSAnYXdzLWNkay1saWIvYXdzLWFwaWdhdGV3YXl2Mic7XG5pbXBvcnQgKiBhcyBhdXRob3JpemVycyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtYXBpZ2F0ZXdheXYyLWF1dGhvcml6ZXJzJztcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnO1xuaW1wb3J0IHsgQ29nbml0b1N0YWNrIH0gZnJvbSAnLi9jb2duaXRvLXN0YWNrJztcbmltcG9ydCB7IFJvdXRlNTNTdGFjayB9IGZyb20gJy4vcm91dGU1My1zdGFjayc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXBpR2F0ZXdheVN0YWNrUHJvcHMge1xuICBjb2duaXRvU3RhY2s6IENvZ25pdG9TdGFjaztcbiAgcm91dGU1M1N0YWNrPzogUm91dGU1M1N0YWNrO1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEFwaUdhdGV3YXlTdGFjayBleHRlbmRzIENvbnN0cnVjdCB7XG4gIHB1YmxpYyByZWFkb25seSBhcGk6IGFwaWdhdGV3YXkuSHR0cEFwaTtcbiAgcHVibGljIGFwaURvbWFpbj86IGFwaWdhdGV3YXl2Mi5Eb21haW5OYW1lO1xuICBwdWJsaWMgcmVhZG9ubHkgY3VzdG9tZXJBdXRob3JpemVyOiBhdXRob3JpemVycy5IdHRwVXNlclBvb2xBdXRob3JpemVyO1xuICBwdWJsaWMgcmVhZG9ubHkgdmVuZG9yQXV0aG9yaXplcjogYXV0aG9yaXplcnMuSHR0cFVzZXJQb29sQXV0aG9yaXplcjtcbiAgcHVibGljIHJlYWRvbmx5IGFkbWluQXV0aG9yaXplcjogYXV0aG9yaXplcnMuSHR0cFVzZXJQb29sQXV0aG9yaXplcjtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogQXBpR2F0ZXdheVN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQpO1xuXG4gICAgLy8gQ3JlYXRlIENvZ25pdG8gSldUIEF1dGhvcml6ZXJzIGZvciBlYWNoIHVzZXIgcG9vbFxuICAgIC8vIE5vdGU6IFVzaW5nIEh0dHBVc2VyUG9vbEF1dGhvcml6ZXIgZnJvbSBhd3MtYXBpZ2F0ZXdheXYyLWF1dGhvcml6ZXJzXG4gICAgdGhpcy5jdXN0b21lckF1dGhvcml6ZXIgPSBuZXcgYXV0aG9yaXplcnMuSHR0cFVzZXJQb29sQXV0aG9yaXplcihcbiAgICAgICdDdXN0b21lckF1dGhvcml6ZXInLFxuICAgICAgcHJvcHMuY29nbml0b1N0YWNrLmN1c3RvbWVyUG9vbCxcbiAgICAgIHtcbiAgICAgICAgdXNlclBvb2xDbGllbnRzOiBbcHJvcHMuY29nbml0b1N0YWNrLmN1c3RvbWVyUG9vbENsaWVudF0sXG4gICAgICAgIGlkZW50aXR5U291cmNlOiBbJyRyZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJ10sXG4gICAgICB9XG4gICAgKTtcblxuICAgIHRoaXMudmVuZG9yQXV0aG9yaXplciA9IG5ldyBhdXRob3JpemVycy5IdHRwVXNlclBvb2xBdXRob3JpemVyKFxuICAgICAgJ1ZlbmRvckF1dGhvcml6ZXInLFxuICAgICAgcHJvcHMuY29nbml0b1N0YWNrLnZlbmRvclBvb2wsXG4gICAgICB7XG4gICAgICAgIHVzZXJQb29sQ2xpZW50czogW3Byb3BzLmNvZ25pdG9TdGFjay52ZW5kb3JQb29sQ2xpZW50XSxcbiAgICAgICAgaWRlbnRpdHlTb3VyY2U6IFsnJHJlcXVlc3QuaGVhZGVyLkF1dGhvcml6YXRpb24nXSxcbiAgICAgIH1cbiAgICApO1xuXG4gICAgdGhpcy5hZG1pbkF1dGhvcml6ZXIgPSBuZXcgYXV0aG9yaXplcnMuSHR0cFVzZXJQb29sQXV0aG9yaXplcihcbiAgICAgICdBZG1pbkF1dGhvcml6ZXInLFxuICAgICAgcHJvcHMuY29nbml0b1N0YWNrLmFkbWluUG9vbCxcbiAgICAgIHtcbiAgICAgICAgdXNlclBvb2xDbGllbnRzOiBbcHJvcHMuY29nbml0b1N0YWNrLmFkbWluUG9vbENsaWVudF0sXG4gICAgICAgIGlkZW50aXR5U291cmNlOiBbJyRyZXF1ZXN0LmhlYWRlci5BdXRob3JpemF0aW9uJ10sXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIENyZWF0ZSBIVFRQIEFQSVxuICAgIHRoaXMuYXBpID0gbmV3IGFwaWdhdGV3YXkuSHR0cEFwaSh0aGlzLCAnV2FybXBhd3pBcGknLCB7XG4gICAgICBhcGlOYW1lOiBgd2FybXBhd3otYXBpLSR7cHJvcHMuZW52aXJvbm1lbnQgfHwgJ2Rldid9YCxcbiAgICAgIGRlc2NyaXB0aW9uOiAnV2FybXBhd3ogUGxhdGZvcm0gQVBJIEdhdGV3YXknLFxuICAgICAgY29yc1ByZWZsaWdodDoge1xuICAgICAgICBhbGxvd09yaWdpbnM6IHByb3BzLmVudmlyb25tZW50ID09PSAncHJvZCcgXG4gICAgICAgICAgPyBbJ2h0dHBzOi8vd2FybXBhd3ouY29tJywgJ2h0dHBzOi8vd3d3Lndhcm1wYXd6LmNvbSddXG4gICAgICAgICAgOiBbJyonXSxcbiAgICAgICAgYWxsb3dNZXRob2RzOiBbXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5HRVQsXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5QT1NULFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuUFVULFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuREVMRVRFLFxuICAgICAgICAgIGFwaWdhdGV3YXkuQ29yc0h0dHBNZXRob2QuUEFUQ0gsXG4gICAgICAgICAgYXBpZ2F0ZXdheS5Db3JzSHR0cE1ldGhvZC5PUFRJT05TLFxuICAgICAgICBdLFxuICAgICAgICBhbGxvd0hlYWRlcnM6IFtcbiAgICAgICAgICAnQ29udGVudC1UeXBlJyxcbiAgICAgICAgICAnQXV0aG9yaXphdGlvbicsXG4gICAgICAgICAgJ1gtQW16LURhdGUnLFxuICAgICAgICAgICdYLUFwaS1LZXknLFxuICAgICAgICAgICdYLUFtei1TZWN1cml0eS1Ub2tlbicsXG4gICAgICAgICAgJ1gtQ2xpZW50LUluZm8nLFxuICAgICAgICAgICdYLVVzZXItUm9sZScsIC8vIEZvciByb2xlLWJhc2VkIHJvdXRpbmdcbiAgICAgICAgXSxcbiAgICAgICAgbWF4QWdlOiBjZGsuRHVyYXRpb24uZGF5cygxKSxcbiAgICAgIH0sXG4gICAgICAvLyBOb3RlOiBEZWZhdWx0IGF1dGhvcml6ZXIgY2FuIGJlIHNldCBwZXIgcm91dGVcbiAgICAgIC8vIFVzZSBjdXN0b21lckF1dGhvcml6ZXIgYXMgZGVmYXVsdCBmb3IgcHVibGljIGVuZHBvaW50c1xuICAgIH0pO1xuXG4gICAgLy8gQ3JlYXRlIGN1c3RvbSBkb21haW4gaWYgUm91dGU1MyBzdGFjayBpcyBwcm92aWRlZFxuICAgIC8vIE5vdGU6IFRoaXMgd2lsbCBiZSBjcmVhdGVkIGFmdGVyIFJvdXRlNTMgc3RhY2sgaXMgaW5pdGlhbGl6ZWRcbiAgICBpZiAocHJvcHMucm91dGU1M1N0YWNrICYmIHByb3BzLnJvdXRlNTNTdGFjay5jZXJ0aWZpY2F0ZSkge1xuICAgICAgdGhpcy5hcGlEb21haW4gPSBuZXcgYXBpZ2F0ZXdheXYyLkRvbWFpbk5hbWUodGhpcywgJ0FwaURvbWFpbicsIHtcbiAgICAgICAgZG9tYWluTmFtZTogcHJvcHMucm91dGU1M1N0YWNrLmFwaURvbWFpbk5hbWUsXG4gICAgICAgIGNlcnRpZmljYXRlOiBwcm9wcy5yb3V0ZTUzU3RhY2suY2VydGlmaWNhdGUsXG4gICAgICB9KTtcblxuICAgICAgLy8gQ3JlYXRlIEFQSSBtYXBwaW5nXG4gICAgICBuZXcgYXBpZ2F0ZXdheXYyLkFwaU1hcHBpbmcodGhpcywgJ0FwaU1hcHBpbmcnLCB7XG4gICAgICAgIGFwaTogdGhpcy5hcGksXG4gICAgICAgIGRvbWFpbk5hbWU6IHRoaXMuYXBpRG9tYWluLFxuICAgICAgICBzdGFnZTogdGhpcy5hcGkuZGVmYXVsdFN0YWdlLFxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gQ29nbml0byBhdXRob3JpemVycyBhcmUgbm93IGNvbmZpZ3VyZWQgYW5kIHJlYWR5IHRvIHVzZVxuICAgIC8vIFJvdXRlcyBjYW4gc3BlY2lmeSB3aGljaCBhdXRob3JpemVyIHRvIHVzZSB3aGVuIGFkZGVkXG4gIH1cblxuICAvKipcbiAgICogQWRkIGEgcm91dGUgd2l0aCBDb2duaXRvIGF1dGhvcml6YXRpb25cbiAgICogQHBhcmFtIHBhdGggUm91dGUgcGF0aFxuICAgKiBAcGFyYW0gbWV0aG9kcyBIVFRQIG1ldGhvZHNcbiAgICogQHBhcmFtIGludGVncmF0aW9uIExhbWJkYSBpbnRlZ3JhdGlvblxuICAgKiBAcGFyYW0gYXV0aG9yaXplciBDb2duaXRvIGF1dGhvcml6ZXIgKGN1c3RvbWVyLCB2ZW5kb3IsIG9yIGFkbWluKVxuICAgKi9cbiAgcHVibGljIGFkZEF1dGhvcml6ZWRSb3V0ZShcbiAgICBwYXRoOiBzdHJpbmcsXG4gICAgbWV0aG9kczogYXBpZ2F0ZXdheS5IdHRwTWV0aG9kW10sXG4gICAgaW50ZWdyYXRpb246IGFwaWdhdGV3YXkuSHR0cFJvdXRlSW50ZWdyYXRpb24sXG4gICAgYXV0aG9yaXplcjogJ2N1c3RvbWVyJyB8ICd2ZW5kb3InIHwgJ2FkbWluJ1xuICApOiB2b2lkIHtcbiAgICBjb25zdCBzZWxlY3RlZEF1dGhvcml6ZXIgPSBcbiAgICAgIGF1dGhvcml6ZXIgPT09ICdjdXN0b21lcicgPyB0aGlzLmN1c3RvbWVyQXV0aG9yaXplciA6XG4gICAgICBhdXRob3JpemVyID09PSAndmVuZG9yJyA/IHRoaXMudmVuZG9yQXV0aG9yaXplciA6XG4gICAgICB0aGlzLmFkbWluQXV0aG9yaXplcjtcblxuICAgIHRoaXMuYXBpLmFkZFJvdXRlcyh7XG4gICAgICBwYXRoLFxuICAgICAgbWV0aG9kcyxcbiAgICAgIGludGVncmF0aW9uLFxuICAgICAgYXV0aG9yaXplcjogc2VsZWN0ZWRBdXRob3JpemVyLFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIEFkZCBjdXN0b20gZG9tYWluIHRvIEFQSSBHYXRld2F5XG4gICAqIENhbGxlZCBhZnRlciBSb3V0ZTUzIHN0YWNrIGlzIGNyZWF0ZWRcbiAgICovXG4gIHB1YmxpYyBhZGRDdXN0b21Eb21haW4ocm91dGU1M1N0YWNrOiBSb3V0ZTUzU3RhY2spOiB2b2lkIHtcbiAgICBpZiAoIXRoaXMuYXBpRG9tYWluKSB7XG4gICAgICB0aGlzLmFwaURvbWFpbiA9IG5ldyBhcGlnYXRld2F5djIuRG9tYWluTmFtZSh0aGlzLCAnQXBpRG9tYWluJywge1xuICAgICAgICBkb21haW5OYW1lOiByb3V0ZTUzU3RhY2suYXBpRG9tYWluTmFtZSxcbiAgICAgICAgY2VydGlmaWNhdGU6IHJvdXRlNTNTdGFjay5jZXJ0aWZpY2F0ZSxcbiAgICAgIH0pO1xuXG4gICAgICAvLyBDcmVhdGUgQVBJIG1hcHBpbmdcbiAgICAgIG5ldyBhcGlnYXRld2F5djIuQXBpTWFwcGluZyh0aGlzLCAnQXBpTWFwcGluZycsIHtcbiAgICAgICAgYXBpOiB0aGlzLmFwaSxcbiAgICAgICAgZG9tYWluTmFtZTogdGhpcy5hcGlEb21haW4sXG4gICAgICAgIHN0YWdlOiB0aGlzLmFwaS5kZWZhdWx0U3RhZ2UsXG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuIl19
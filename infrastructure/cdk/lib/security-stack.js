"use strict";
/**
 * AWS CDK STACK - SECURITY
 * Defines security groups for Lambda and API Gateway
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
exports.SecurityStack = void 0;
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const constructs_1 = require("constructs");
class SecurityStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        // Lambda Security Group
        this.lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for Lambda functions',
            allowAllOutbound: true,
        });
        // API Security Group
        this.apiSecurityGroup = new ec2.SecurityGroup(this, 'ApiSecurityGroup', {
            vpc: props.vpc,
            description: 'Security group for API Gateway',
            allowAllOutbound: true,
        });
        // Allow Lambda to communicate with API
        this.lambdaSecurityGroup.addIngressRule(this.apiSecurityGroup, ec2.Port.allTcp(), 'Allow API to communicate with Lambda');
    }
}
exports.SecurityStack = SecurityStack;
//# sourceMappingURL=security-stack.js.map
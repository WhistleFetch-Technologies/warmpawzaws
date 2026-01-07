"use strict";
/**
 * ============================================================================
 * AWS CDK STACK - COGNITO USER POOLS
 * ============================================================================
 *
 * Defines Cognito User Pools for authentication
 * - Customer Pool
 * - Vendor Pool
 * - Admin Pool
 *
 * Date: 2026-01-02
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
exports.CognitoStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const cognito = __importStar(require("aws-cdk-lib/aws-cognito"));
const constructs_1 = require("constructs");
class CognitoStack extends constructs_1.Construct {
    constructor(scope, id) {
        super(scope, id);
        // =========================================================================
        // CUSTOMER USER POOL
        // =========================================================================
        this.customerPool = new cognito.UserPool(this, 'CustomerUserPool', {
            userPoolName: 'warmpawz-customers',
            selfSignUpEnabled: true,
            signInAliases: {
                phone: true,
                email: false,
                username: true,
            },
            autoVerify: {
                phone: true,
            },
            standardAttributes: {
                phoneNumber: {
                    required: true,
                    mutable: false,
                },
                email: {
                    required: false,
                    mutable: true,
                },
                fullname: {
                    required: false,
                    mutable: true,
                },
            },
            customAttributes: {
                user_type: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: false }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.PHONE_ONLY_WITHOUT_MFA,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        this.customerPoolClient = this.customerPool.addClient('CustomerWebClient', {
            authFlows: {
                adminUserPassword: true,
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false,
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30),
        });
        // =========================================================================
        // VENDOR USER POOL
        // =========================================================================
        this.vendorPool = new cognito.UserPool(this, 'VendorUserPool', {
            userPoolName: 'warmpawz-vendors',
            selfSignUpEnabled: true,
            signInAliases: {
                phone: true,
                email: true,
                username: true,
            },
            autoVerify: {
                phone: true,
                email: true,
            },
            standardAttributes: {
                phoneNumber: {
                    required: true,
                    mutable: false,
                },
                email: {
                    required: true,
                    mutable: true,
                },
            },
            customAttributes: {
                user_type: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: false }),
                vendor_id: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: false }),
            },
            passwordPolicy: {
                minLength: 8,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            accountRecovery: cognito.AccountRecovery.PHONE_ONLY_WITHOUT_MFA,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        this.vendorPoolClient = this.vendorPool.addClient('VendorWebClient', {
            authFlows: {
                adminUserPassword: true,
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false,
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(30),
        });
        // =========================================================================
        // ADMIN USER POOL
        // =========================================================================
        this.adminPool = new cognito.UserPool(this, 'AdminUserPool', {
            userPoolName: 'warmpawz-admins',
            selfSignUpEnabled: false, // Admin users must be created manually
            signInAliases: {
                email: true,
                username: true,
            },
            autoVerify: {
                email: true,
            },
            standardAttributes: {
                email: {
                    required: true,
                    mutable: false,
                },
            },
            customAttributes: {
                user_type: new cognito.StringAttribute({ minLen: 1, maxLen: 20, mutable: false }),
                admin_role: new cognito.StringAttribute({ minLen: 1, maxLen: 50, mutable: true }),
            },
            passwordPolicy: {
                minLength: 12,
                requireLowercase: true,
                requireUppercase: true,
                requireDigits: true,
                requireSymbols: true,
            },
            mfa: cognito.Mfa.OPTIONAL,
            accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
            removalPolicy: cdk.RemovalPolicy.RETAIN,
        });
        this.adminPoolClient = this.adminPool.addClient('AdminWebClient', {
            authFlows: {
                adminUserPassword: true,
                userPassword: true,
                userSrp: true,
            },
            generateSecret: false,
            accessTokenValidity: cdk.Duration.hours(1),
            idTokenValidity: cdk.Duration.hours(1),
            refreshTokenValidity: cdk.Duration.days(7), // Shorter for admin
        });
        // Outputs will be created at the parent stack level
    }
}
exports.CognitoStack = CognitoStack;

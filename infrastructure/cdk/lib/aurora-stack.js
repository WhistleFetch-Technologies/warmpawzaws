"use strict";
/**
 * ============================================================================
 * AWS CDK STACK - AURORA RDS (Enhanced - Uses Existing Resources)
 * ============================================================================
 *
 * Enhanced to support existing RDS clusters
 * - Uses existing cluster if clusterIdentifier is provided via context
 * - Creates new cluster only if clusterIdentifier is not provided
 *
 * Date: 2026-01-28
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
exports.AuroraStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const rds = __importStar(require("aws-cdk-lib/aws-rds"));
const ec2 = __importStar(require("aws-cdk-lib/aws-ec2"));
const secretsmanager = __importStar(require("aws-cdk-lib/aws-secretsmanager"));
const constructs_1 = require("constructs");
class AuroraStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props.environment || 'dev';
        const useExisting = !!props.existingClusterIdentifier;
        // ========================================================================
        // SECRET MANAGEMENT
        // ========================================================================
        if (props.existingSecretArn) {
            // Use existing secret
            this.secret = secretsmanager.Secret.fromSecretCompleteArn(this, 'AuroraSecret', props.existingSecretArn);
        }
        else {
            // Create new secret (only if not using existing cluster)
            this.secret = new secretsmanager.Secret(this, 'AuroraSecret', {
                description: 'Aurora RDS database credentials for Warmpawz',
                generateSecretString: {
                    secretStringTemplate: JSON.stringify({ username: 'warmpawz_admin' }),
                    generateStringKey: 'password',
                    excludeCharacters: '"@/\\',
                    passwordLength: 32,
                },
            });
        }
        // ========================================================================
        // RDS CLUSTER - Use Existing or Create New
        // ========================================================================
        if (useExisting && props.existingClusterIdentifier) {
            // Use existing RDS cluster
            console.log(`[AuroraStack] Using existing RDS cluster: ${props.existingClusterIdentifier}`);
            // Get endpoint from props or construct default
            const clusterEndpoint = props.existingClusterEndpoint ||
                `${props.existingClusterIdentifier}.cluster-cpgs0s0iyq8o.ap-south-1.rds.amazonaws.com`;
            this.cluster = rds.DatabaseCluster.fromDatabaseClusterAttributes(this, 'AuroraCluster', {
                clusterIdentifier: props.existingClusterIdentifier,
                clusterEndpointAddress: clusterEndpoint,
                port: 5432,
            });
        }
        else {
            // Create new RDS cluster (only if not using existing)
            console.log('[AuroraStack] Creating new RDS cluster');
            // Create security group for Aurora
            const auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
                vpc: props.vpc,
                description: 'Security group for Aurora RDS cluster',
                allowAllOutbound: false,
            });
            // Allow inbound from VPC
            auroraSecurityGroup.addIngressRule(ec2.Peer.ipv4(props.vpc.vpcCidrBlock), ec2.Port.tcp(5432), 'Allow PostgreSQL from VPC');
            // Create Aurora Serverless v2 cluster
            this.cluster = new rds.DatabaseCluster(this, 'AuroraCluster', {
                engine: rds.DatabaseClusterEngine.auroraPostgres({
                    version: rds.AuroraPostgresEngineVersion.VER_15_14,
                }),
                credentials: rds.Credentials.fromSecret(this.secret),
                writer: rds.ClusterInstance.serverlessV2('writer'),
                serverlessV2MinCapacity: 0.5,
                serverlessV2MaxCapacity: 16,
                defaultDatabaseName: 'warmpawz',
                vpc: props.vpc,
                vpcSubnets: {
                    subnetType: ec2.SubnetType.PUBLIC,
                },
                securityGroups: [auroraSecurityGroup],
                removalPolicy: cdk.RemovalPolicy.RETAIN,
                backup: {
                    retention: cdk.Duration.days(7),
                    preferredWindow: '03:00-04:00',
                },
                storageEncrypted: true,
                enableDataApi: false,
            });
        }
        // ========================================================================
        // RDS PROXY - Use Existing or Create New
        // ========================================================================
        if (useExisting && props.existingProxyName) {
            // Use existing RDS Proxy
            console.log(`[AuroraStack] Using existing RDS Proxy: ${props.existingProxyName}`);
            // Reference existing proxy by ARN (proxy name lookup not supported)
            // For existing infrastructure, we skip creating a new proxy
            this.proxy = undefined;
        }
        else {
            // Create new RDS Proxy (only if not using existing)
            console.log('[AuroraStack] Creating new RDS Proxy');
            // Get security group from cluster or create new one
            const auroraSecurityGroup = useExisting
                ? ec2.SecurityGroup.fromSecurityGroupId(this, 'AuroraSecurityGroup', 'sg-placeholder')
                : new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
                    vpc: props.vpc,
                    description: 'Security group for Aurora RDS cluster',
                    allowAllOutbound: false,
                });
            this.proxy = new rds.DatabaseProxy(this, 'AuroraProxy', {
                proxyTarget: rds.ProxyTarget.fromCluster(this.cluster),
                secrets: [this.secret],
                vpc: props.vpc,
                securityGroups: useExisting ? [] : [auroraSecurityGroup],
                dbProxyName: `warmpawz-${environment}-aurora-proxy`,
                requireTLS: true,
                maxConnectionsPercent: 100,
                maxIdleConnectionsPercent: 50,
            });
        }
    }
}
exports.AuroraStack = AuroraStack;
//# sourceMappingURL=aurora-stack.js.map
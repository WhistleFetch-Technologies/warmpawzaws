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

import * as cdk from 'aws-cdk-lib';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface AuroraStackProps {
  vpc: ec2.IVpc;
  environment?: string;
  // Optional: Use existing cluster
  existingClusterIdentifier?: string;
  existingClusterEndpoint?: string;
  existingSecretArn?: string;
  existingProxyName?: string;
}

export class AuroraStack extends Construct {
  public readonly cluster: rds.IDatabaseCluster;
  public readonly proxy: rds.IDatabaseProxy;
  public readonly secret: secretsmanager.ISecret;

  constructor(scope: Construct, id: string, props: AuroraStackProps) {
    super(scope, id);

    const environment = props.environment || 'dev';
    const useExisting = !!props.existingClusterIdentifier;

    // ========================================================================
    // SECRET MANAGEMENT
    // ========================================================================
    if (props.existingSecretArn) {
      // Use existing secret
      this.secret = secretsmanager.Secret.fromSecretCompleteArn(
        this,
        'AuroraSecret',
        props.existingSecretArn
      );
    } else {
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
    } else {
      // Create new RDS cluster (only if not using existing)
      console.log('[AuroraStack] Creating new RDS cluster');
      
      // Create security group for Aurora
      const auroraSecurityGroup = new ec2.SecurityGroup(this, 'AuroraSecurityGroup', {
        vpc: props.vpc,
        description: 'Security group for Aurora RDS cluster',
        allowAllOutbound: false,
      });

      // Allow inbound from VPC
      auroraSecurityGroup.addIngressRule(
        ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
        ec2.Port.tcp(5432),
        'Allow PostgreSQL from VPC'
      );

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
      this.proxy = undefined as unknown as rds.IDatabaseProxy;
    } else {
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

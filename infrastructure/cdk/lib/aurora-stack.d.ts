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
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
export interface AuroraStackProps {
    vpc: ec2.IVpc;
    environment?: string;
    existingClusterIdentifier?: string;
    existingClusterEndpoint?: string;
    existingSecretArn?: string;
    existingProxyName?: string;
}
export declare class AuroraStack extends Construct {
    readonly cluster: rds.IDatabaseCluster;
    readonly proxy: rds.IDatabaseProxy;
    readonly secret: secretsmanager.ISecret;
    constructor(scope: Construct, id: string, props: AuroraStackProps);
}
//# sourceMappingURL=aurora-stack.d.ts.map
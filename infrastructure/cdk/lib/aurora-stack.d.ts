import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
export interface AuroraStackProps {
    vpc: ec2.IVpc;
}
export declare class AuroraStack extends Construct {
    readonly cluster: rds.DatabaseCluster;
    readonly proxy: rds.DatabaseProxy;
    readonly secret: secretsmanager.Secret;
    constructor(scope: Construct, id: string, props: AuroraStackProps);
}

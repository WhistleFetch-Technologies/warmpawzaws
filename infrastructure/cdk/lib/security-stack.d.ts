import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
export interface SecurityStackProps {
    vpc: ec2.IVpc;
}
export declare class SecurityStack extends Construct {
    readonly lambdaSecurityGroup: ec2.SecurityGroup;
    readonly apiSecurityGroup: ec2.SecurityGroup;
    constructor(scope: Construct, id: string, props: SecurityStackProps);
}

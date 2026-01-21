/**
 * AWS CDK STACK - CHIME
 * Defines resources for AWS Chime SDK integration (video calling)
 */
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';
export interface ChimeStackProps {
    environment?: string;
}
export declare class ChimeStack extends Construct {
    readonly chimeAppInstanceArn: string;
    readonly chimeRole: iam.Role;
    constructor(scope: Construct, id: string, props?: ChimeStackProps);
}
//# sourceMappingURL=chime-stack.d.ts.map
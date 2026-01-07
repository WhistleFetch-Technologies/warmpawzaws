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
exports.ChimeStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
class ChimeStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props?.environment || 'dev';
        // IAM Role for Chime SDK operations
        // Note: Chime App Instance must be created manually or via separate script
        // as CDK doesn't have direct support for Chime App Instance creation
        // This role will be used by Lambda functions to interact with Chime
        this.chimeRole = new iam.Role(this, 'ChimeRole', {
            roleName: `warmpawz-chime-role-${environment}`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Role for AWS Chime SDK operations',
        });
        // Chime SDK permissions
        this.chimeRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'chime:CreateMeeting',
                'chime:GetMeeting',
                'chime:DeleteMeeting',
                'chime:CreateAttendee',
                'chime:GetAttendee',
                'chime:ListAttendees',
                'chime:CreateAppInstance',
                'chime:DescribeAppInstance',
                'chime:ListAppInstances',
                'chime:CreateAppInstanceUser',
                'chime:DescribeAppInstanceUser',
                'chime:ListAppInstanceUsers',
                'chime:CreateChannel',
                'chime:DescribeChannel',
                'chime:ListChannels',
                'chime:SendChannelMessage',
                'chime:ListChannelMessages',
                'chime:CreateChannelMembership',
                'chime:ListChannelMemberships',
            ],
            resources: ['*'], // Chime resources don't support resource-level permissions
        }));
        // Chime Messaging permissions
        this.chimeRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'chime:CreateChannel',
                'chime:DescribeChannel',
                'chime:ListChannels',
                'chime:SendChannelMessage',
                'chime:ListChannelMessages',
                'chime:CreateChannelMembership',
                'chime:ListChannelMemberships',
            ],
            resources: ['*'],
        }));
        // Note: Chime App Instance ARN will be set after manual creation
        // or via CloudFormation custom resource
        // For now, using a placeholder that will be replaced with actual ARN
        this.chimeAppInstanceArn = `arn:aws:chime:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:app-instance/warmpawz-${environment}`;
        // Output for reference
        new cdk.CfnOutput(this, 'ChimeAppInstanceArn', {
            value: this.chimeAppInstanceArn,
            description: 'AWS Chime App Instance ARN (to be created manually or via script)',
            // Note: Export name removed to avoid conflicts across environments
            // Use stack outputs directly instead of cross-stack references
        });
        new cdk.CfnOutput(this, 'ChimeRoleArn', {
            value: this.chimeRole.roleArn,
            description: 'IAM Role ARN for Chime SDK operations',
            // Note: Export name removed to avoid conflicts across environments
        });
    }
}
exports.ChimeStack = ChimeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2hpbWUtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJjaGltZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlEQUFtQztBQUNuQyx5REFBMkM7QUFDM0MsMkNBQXVDO0FBTXZDLE1BQWEsVUFBVyxTQUFRLHNCQUFTO0lBSXZDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDL0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVqQixNQUFNLFdBQVcsR0FBRyxLQUFLLEVBQUUsV0FBVyxJQUFJLEtBQUssQ0FBQztRQUVoRCxvQ0FBb0M7UUFDcEMsMkVBQTJFO1FBQzNFLHFFQUFxRTtRQUNyRSxvRUFBb0U7UUFDcEUsSUFBSSxDQUFDLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLFdBQVcsRUFBRTtZQUMvQyxRQUFRLEVBQUUsdUJBQXVCLFdBQVcsRUFBRTtZQUM5QyxTQUFTLEVBQUUsSUFBSSxHQUFHLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUM7WUFDM0QsV0FBVyxFQUFFLG1DQUFtQztTQUNqRCxDQUFDLENBQUM7UUFFSCx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQ3hCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLGtCQUFrQjtnQkFDbEIscUJBQXFCO2dCQUNyQixzQkFBc0I7Z0JBQ3RCLG1CQUFtQjtnQkFDbkIscUJBQXFCO2dCQUNyQix5QkFBeUI7Z0JBQ3pCLDJCQUEyQjtnQkFDM0Isd0JBQXdCO2dCQUN4Qiw2QkFBNkI7Z0JBQzdCLCtCQUErQjtnQkFDL0IsNEJBQTRCO2dCQUM1QixxQkFBcUI7Z0JBQ3JCLHVCQUF1QjtnQkFDdkIsb0JBQW9CO2dCQUNwQiwwQkFBMEI7Z0JBQzFCLDJCQUEyQjtnQkFDM0IsK0JBQStCO2dCQUMvQiw4QkFBOEI7YUFDL0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSwyREFBMkQ7U0FDOUUsQ0FBQyxDQUNILENBQUM7UUFFRiw4QkFBOEI7UUFDOUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLENBQ3hCLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztZQUN0QixNQUFNLEVBQUUsR0FBRyxDQUFDLE1BQU0sQ0FBQyxLQUFLO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxxQkFBcUI7Z0JBQ3JCLHVCQUF1QjtnQkFDdkIsb0JBQW9CO2dCQUNwQiwwQkFBMEI7Z0JBQzFCLDJCQUEyQjtnQkFDM0IsK0JBQStCO2dCQUMvQiw4QkFBOEI7YUFDL0I7WUFDRCxTQUFTLEVBQUUsQ0FBQyxHQUFHLENBQUM7U0FDakIsQ0FBQyxDQUNILENBQUM7UUFFRixpRUFBaUU7UUFDakUsd0NBQXdDO1FBQ3hDLHFFQUFxRTtRQUNyRSxJQUFJLENBQUMsbUJBQW1CLEdBQUcsaUJBQWlCLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxHQUFHLENBQUMsVUFBVSwwQkFBMEIsV0FBVyxFQUFFLENBQUM7UUFFeEgsdUJBQXVCO1FBQ3ZCLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDN0MsS0FBSyxFQUFFLElBQUksQ0FBQyxtQkFBbUI7WUFDL0IsV0FBVyxFQUFFLG1FQUFtRTtZQUNoRixtRUFBbUU7WUFDbkUsK0RBQStEO1NBQ2hFLENBQUMsQ0FBQztRQUVILElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsY0FBYyxFQUFFO1lBQ3RDLEtBQUssRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU87WUFDN0IsV0FBVyxFQUFFLHVDQUF1QztZQUNwRCxtRUFBbUU7U0FDcEUsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGO0FBcEZELGdDQW9GQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBpYW0gZnJvbSAnYXdzLWNkay1saWIvYXdzLWlhbSc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcblxuZXhwb3J0IGludGVyZmFjZSBDaGltZVN0YWNrUHJvcHMge1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIENoaW1lU3RhY2sgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgY2hpbWVBcHBJbnN0YW5jZUFybjogc3RyaW5nO1xuICBwdWJsaWMgcmVhZG9ubHkgY2hpbWVSb2xlOiBpYW0uUm9sZTtcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IENoaW1lU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHByb3BzPy5lbnZpcm9ubWVudCB8fCAnZGV2JztcblxuICAgIC8vIElBTSBSb2xlIGZvciBDaGltZSBTREsgb3BlcmF0aW9uc1xuICAgIC8vIE5vdGU6IENoaW1lIEFwcCBJbnN0YW5jZSBtdXN0IGJlIGNyZWF0ZWQgbWFudWFsbHkgb3IgdmlhIHNlcGFyYXRlIHNjcmlwdFxuICAgIC8vIGFzIENESyBkb2Vzbid0IGhhdmUgZGlyZWN0IHN1cHBvcnQgZm9yIENoaW1lIEFwcCBJbnN0YW5jZSBjcmVhdGlvblxuICAgIC8vIFRoaXMgcm9sZSB3aWxsIGJlIHVzZWQgYnkgTGFtYmRhIGZ1bmN0aW9ucyB0byBpbnRlcmFjdCB3aXRoIENoaW1lXG4gICAgdGhpcy5jaGltZVJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgJ0NoaW1lUm9sZScsIHtcbiAgICAgIHJvbGVOYW1lOiBgd2FybXBhd3otY2hpbWUtcm9sZS0ke2Vudmlyb25tZW50fWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbCgnbGFtYmRhLmFtYXpvbmF3cy5jb20nKSxcbiAgICAgIGRlc2NyaXB0aW9uOiAnUm9sZSBmb3IgQVdTIENoaW1lIFNESyBvcGVyYXRpb25zJyxcbiAgICB9KTtcblxuICAgIC8vIENoaW1lIFNESyBwZXJtaXNzaW9uc1xuICAgIHRoaXMuY2hpbWVSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnY2hpbWU6Q3JlYXRlTWVldGluZycsXG4gICAgICAgICAgJ2NoaW1lOkdldE1lZXRpbmcnLFxuICAgICAgICAgICdjaGltZTpEZWxldGVNZWV0aW5nJyxcbiAgICAgICAgICAnY2hpbWU6Q3JlYXRlQXR0ZW5kZWUnLFxuICAgICAgICAgICdjaGltZTpHZXRBdHRlbmRlZScsXG4gICAgICAgICAgJ2NoaW1lOkxpc3RBdHRlbmRlZXMnLFxuICAgICAgICAgICdjaGltZTpDcmVhdGVBcHBJbnN0YW5jZScsXG4gICAgICAgICAgJ2NoaW1lOkRlc2NyaWJlQXBwSW5zdGFuY2UnLFxuICAgICAgICAgICdjaGltZTpMaXN0QXBwSW5zdGFuY2VzJyxcbiAgICAgICAgICAnY2hpbWU6Q3JlYXRlQXBwSW5zdGFuY2VVc2VyJyxcbiAgICAgICAgICAnY2hpbWU6RGVzY3JpYmVBcHBJbnN0YW5jZVVzZXInLFxuICAgICAgICAgICdjaGltZTpMaXN0QXBwSW5zdGFuY2VVc2VycycsXG4gICAgICAgICAgJ2NoaW1lOkNyZWF0ZUNoYW5uZWwnLFxuICAgICAgICAgICdjaGltZTpEZXNjcmliZUNoYW5uZWwnLFxuICAgICAgICAgICdjaGltZTpMaXN0Q2hhbm5lbHMnLFxuICAgICAgICAgICdjaGltZTpTZW5kQ2hhbm5lbE1lc3NhZ2UnLFxuICAgICAgICAgICdjaGltZTpMaXN0Q2hhbm5lbE1lc3NhZ2VzJyxcbiAgICAgICAgICAnY2hpbWU6Q3JlYXRlQ2hhbm5lbE1lbWJlcnNoaXAnLFxuICAgICAgICAgICdjaGltZTpMaXN0Q2hhbm5lbE1lbWJlcnNoaXBzJyxcbiAgICAgICAgXSxcbiAgICAgICAgcmVzb3VyY2VzOiBbJyonXSwgLy8gQ2hpbWUgcmVzb3VyY2VzIGRvbid0IHN1cHBvcnQgcmVzb3VyY2UtbGV2ZWwgcGVybWlzc2lvbnNcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIENoaW1lIE1lc3NhZ2luZyBwZXJtaXNzaW9uc1xuICAgIHRoaXMuY2hpbWVSb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAnY2hpbWU6Q3JlYXRlQ2hhbm5lbCcsXG4gICAgICAgICAgJ2NoaW1lOkRlc2NyaWJlQ2hhbm5lbCcsXG4gICAgICAgICAgJ2NoaW1lOkxpc3RDaGFubmVscycsXG4gICAgICAgICAgJ2NoaW1lOlNlbmRDaGFubmVsTWVzc2FnZScsXG4gICAgICAgICAgJ2NoaW1lOkxpc3RDaGFubmVsTWVzc2FnZXMnLFxuICAgICAgICAgICdjaGltZTpDcmVhdGVDaGFubmVsTWVtYmVyc2hpcCcsXG4gICAgICAgICAgJ2NoaW1lOkxpc3RDaGFubmVsTWVtYmVyc2hpcHMnLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFsnKiddLFxuICAgICAgfSlcbiAgICApO1xuXG4gICAgLy8gTm90ZTogQ2hpbWUgQXBwIEluc3RhbmNlIEFSTiB3aWxsIGJlIHNldCBhZnRlciBtYW51YWwgY3JlYXRpb25cbiAgICAvLyBvciB2aWEgQ2xvdWRGb3JtYXRpb24gY3VzdG9tIHJlc291cmNlXG4gICAgLy8gRm9yIG5vdywgdXNpbmcgYSBwbGFjZWhvbGRlciB0aGF0IHdpbGwgYmUgcmVwbGFjZWQgd2l0aCBhY3R1YWwgQVJOXG4gICAgdGhpcy5jaGltZUFwcEluc3RhbmNlQXJuID0gYGFybjphd3M6Y2hpbWU6JHtjZGsuQXdzLlJFR0lPTn06JHtjZGsuQXdzLkFDQ09VTlRfSUR9OmFwcC1pbnN0YW5jZS93YXJtcGF3ei0ke2Vudmlyb25tZW50fWA7XG5cbiAgICAvLyBPdXRwdXQgZm9yIHJlZmVyZW5jZVxuICAgIG5ldyBjZGsuQ2ZuT3V0cHV0KHRoaXMsICdDaGltZUFwcEluc3RhbmNlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuY2hpbWVBcHBJbnN0YW5jZUFybixcbiAgICAgIGRlc2NyaXB0aW9uOiAnQVdTIENoaW1lIEFwcCBJbnN0YW5jZSBBUk4gKHRvIGJlIGNyZWF0ZWQgbWFudWFsbHkgb3IgdmlhIHNjcmlwdCknLFxuICAgICAgLy8gTm90ZTogRXhwb3J0IG5hbWUgcmVtb3ZlZCB0byBhdm9pZCBjb25mbGljdHMgYWNyb3NzIGVudmlyb25tZW50c1xuICAgICAgLy8gVXNlIHN0YWNrIG91dHB1dHMgZGlyZWN0bHkgaW5zdGVhZCBvZiBjcm9zcy1zdGFjayByZWZlcmVuY2VzXG4gICAgfSk7XG5cbiAgICBuZXcgY2RrLkNmbk91dHB1dCh0aGlzLCAnQ2hpbWVSb2xlQXJuJywge1xuICAgICAgdmFsdWU6IHRoaXMuY2hpbWVSb2xlLnJvbGVBcm4sXG4gICAgICBkZXNjcmlwdGlvbjogJ0lBTSBSb2xlIEFSTiBmb3IgQ2hpbWUgU0RLIG9wZXJhdGlvbnMnLFxuICAgICAgLy8gTm90ZTogRXhwb3J0IG5hbWUgcmVtb3ZlZCB0byBhdm9pZCBjb25mbGljdHMgYWNyb3NzIGVudmlyb25tZW50c1xuICAgIH0pO1xuICB9XG59XG5cbiJdfQ==
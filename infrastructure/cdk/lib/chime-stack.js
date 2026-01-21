"use strict";
/**
 * AWS CDK STACK - CHIME
 * Defines resources for AWS Chime SDK integration (video calling)
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
exports.ChimeStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const iam = __importStar(require("aws-cdk-lib/aws-iam"));
const constructs_1 = require("constructs");
class ChimeStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const env = props?.environment || 'dev';
        // Chime App Instance ARN (placeholder - actual instance created via Chime API)
        this.chimeAppInstanceArn = `arn:aws:chime:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:app-instance/warmpawz-${env}`;
        // IAM Role for Chime operations
        this.chimeRole = new iam.Role(this, 'ChimeRole', {
            roleName: `warmpawz-${env}-chime-role`,
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
            description: 'Role for Chime SDK operations',
        });
        // Add Chime permissions
        this.chimeRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'chime:CreateMeeting',
                'chime:CreateMeetingWithAttendees',
                'chime:DeleteMeeting',
                'chime:GetMeeting',
                'chime:ListMeetings',
                'chime:CreateAttendee',
                'chime:BatchCreateAttendee',
                'chime:DeleteAttendee',
                'chime:GetAttendee',
                'chime:ListAttendees',
                'chime:StartMeetingTranscription',
                'chime:StopMeetingTranscription',
            ],
            resources: ['*'],
        }));
        // Add CloudWatch Logs permissions
        this.chimeRole.addToPolicy(new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'logs:CreateLogGroup',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
            resources: ['*'],
        }));
    }
}
exports.ChimeStack = ChimeStack;
//# sourceMappingURL=chime-stack.js.map
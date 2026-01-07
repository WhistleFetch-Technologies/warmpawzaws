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
exports.SqsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const constructs_1 = require("constructs");
class SqsStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props?.environment || 'dev';
        const envSuffix = environment === 'prod' ? '' : `-${environment}`;
        // Dead Letter Queue for notifications
        this.notificationDlq = new sqs.Queue(this, 'NotificationDLQ', {
            queueName: `warmpawz-notification-dlq${envSuffix}`,
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
        });
        // Notification Queue
        this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
            queueName: `warmpawz-notification-queue${envSuffix}`,
            visibilityTimeout: cdk.Duration.seconds(30),
            retentionPeriod: cdk.Duration.days(7),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
            deadLetterQueue: {
                queue: this.notificationDlq,
                maxReceiveCount: 3,
            },
        });
        // Dead Letter Queue for email
        this.emailDlq = new sqs.Queue(this, 'EmailDLQ', {
            queueName: `warmpawz-email-dlq${envSuffix}`,
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
        });
        // Email Queue
        this.emailQueue = new sqs.Queue(this, 'EmailQueue', {
            queueName: `warmpawz-email-queue${envSuffix}`,
            visibilityTimeout: cdk.Duration.seconds(60),
            retentionPeriod: cdk.Duration.days(7),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
            deadLetterQueue: {
                queue: this.emailDlq,
                maxReceiveCount: 3,
            },
        });
        // Dead Letter Queue for SMS
        this.smsDlq = new sqs.Queue(this, 'SmsDLQ', {
            queueName: `warmpawz-sms-dlq${envSuffix}`,
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
        });
        // SMS Queue
        this.smsQueue = new sqs.Queue(this, 'SmsQueue', {
            queueName: `warmpawz-sms-queue${envSuffix}`,
            visibilityTimeout: cdk.Duration.seconds(30),
            retentionPeriod: cdk.Duration.days(7),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
            deadLetterQueue: {
                queue: this.smsDlq,
                maxReceiveCount: 3,
            },
        });
        // Dead Letter Queue for analytics
        this.analyticsDlq = new sqs.Queue(this, 'AnalyticsDLQ', {
            queueName: `warmpawz-analytics-dlq${envSuffix}`,
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
        });
        // Analytics Queue
        this.analyticsQueue = new sqs.Queue(this, 'AnalyticsQueue', {
            queueName: `warmpawz-analytics-queue${envSuffix}`,
            visibilityTimeout: cdk.Duration.seconds(60),
            retentionPeriod: cdk.Duration.days(7),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
            deadLetterQueue: {
                queue: this.analyticsDlq,
                maxReceiveCount: 3,
            },
        });
        // Dead Letter Queue for settlement
        this.settlementDlq = new sqs.Queue(this, 'SettlementDLQ', {
            queueName: `warmpawz-settlement-dlq${envSuffix}`,
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
        });
        // Settlement Queue
        this.settlementQueue = new sqs.Queue(this, 'SettlementQueue', {
            queueName: `warmpawz-settlement-queue${envSuffix}`,
            visibilityTimeout: cdk.Duration.seconds(300),
            retentionPeriod: cdk.Duration.days(14),
            encryption: sqs.QueueEncryption.SQS_MANAGED,
            deadLetterQueue: {
                queue: this.settlementDlq,
                maxReceiveCount: 3,
            },
        });
    }
}
exports.SqsStack = SqsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3FzLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic3FzLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaURBQW1DO0FBQ25DLHlEQUEyQztBQUMzQywyQ0FBdUM7QUFNdkMsTUFBYSxRQUFTLFNBQVEsc0JBQVM7SUFZckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQjtRQUM3RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sV0FBVyxHQUFHLEtBQUssRUFBRSxXQUFXLElBQUksS0FBSyxDQUFDO1FBQ2hELE1BQU0sU0FBUyxHQUFHLFdBQVcsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFXLEVBQUUsQ0FBQztRQUVsRSxzQ0FBc0M7UUFDdEMsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGlCQUFpQixFQUFFO1lBQzVELFNBQVMsRUFBRSw0QkFBNEIsU0FBUyxFQUFFO1lBQ2xELGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDdEMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxlQUFlLENBQUMsV0FBVztTQUM1QyxDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDaEUsU0FBUyxFQUFFLDhCQUE4QixTQUFTLEVBQUU7WUFDcEQsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDO1lBQzNDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDckMsVUFBVSxFQUFFLEdBQUcs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RTtnQkFDZixLQUFLLEVBQUUsSUFBSSxDQUFDLFlBQVk7Z0JBQ3hCLGVBQWUsRUFBRSxDQUFDO2FBQ25CO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxlQUFlLEVBQUU7WUFDeEQsU0FBUyxFQUFFLDBCQUEwQixTQUFTLEVBQUU7WUFDaEQsZUFBZSxFQUFFLEdBQUcsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQztZQUN0QyxVQUFVLEVBQUUsR0FBRyxDQUFDLGVBQWUsQ0FBQyxXQUFXO1NBQzVDLENBQUMsQ0FBQztRQUVILG1CQUFtQjtRQUNuQixJQUFJLENBQUMsZUFBZSxHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLEVBQUU7WUFDNUQsU0FBUyxFQUFFLDRCQUE0QixTQUFTLEVBQUU7WUFDbEQsaUJBQWlCLEVBQUUsR0FBRyxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQzVDLGVBQWUsRUFBRSxHQUFHLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUM7WUFDdEMsVUFBVSxFQUFFLEdBQUcsQ0FBQyxlQUFlLENBQUMsV0FBVztZQUMzQyxlQUFlLEVBQUU7Z0JBQ2YsS0FBSyxFQUFFLElBQUksQ0FBQyxhQUFhO2dCQUN6QixlQUFlLEVBQUUsQ0FBQzthQUNuQjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQWpIRCw0QkFpSEMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgc3FzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zcXMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3FzU3RhY2tQcm9wcyB7XG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU3FzU3RhY2sgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgbm90aWZpY2F0aW9uUXVldWU6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IG5vdGlmaWNhdGlvbkRscTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgZW1haWxRdWV1ZTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgZW1haWxEbHE6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IHNtc1F1ZXVlOiBzcXMuUXVldWU7XG4gIHB1YmxpYyByZWFkb25seSBzbXNEbHE6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IGFuYWx5dGljc1F1ZXVlOiBzcXMuUXVldWU7XG4gIHB1YmxpYyByZWFkb25seSBhbmFseXRpY3NEbHE6IHNxcy5RdWV1ZTtcbiAgcHVibGljIHJlYWRvbmx5IHNldHRsZW1lbnRRdWV1ZTogc3FzLlF1ZXVlO1xuICBwdWJsaWMgcmVhZG9ubHkgc2V0dGxlbWVudERscTogc3FzLlF1ZXVlO1xuXG4gIGNvbnN0cnVjdG9yKHNjb3BlOiBDb25zdHJ1Y3QsIGlkOiBzdHJpbmcsIHByb3BzPzogU3FzU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHByb3BzPy5lbnZpcm9ubWVudCB8fCAnZGV2JztcbiAgICBjb25zdCBlbnZTdWZmaXggPSBlbnZpcm9ubWVudCA9PT0gJ3Byb2QnID8gJycgOiBgLSR7ZW52aXJvbm1lbnR9YDtcblxuICAgIC8vIERlYWQgTGV0dGVyIFF1ZXVlIGZvciBub3RpZmljYXRpb25zXG4gICAgdGhpcy5ub3RpZmljYXRpb25EbHEgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdOb3RpZmljYXRpb25ETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGB3YXJtcGF3ei1ub3RpZmljYXRpb24tZGxxJHtlbnZTdWZmaXh9YCxcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5TUVNfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIE5vdGlmaWNhdGlvbiBRdWV1ZVxuICAgIHRoaXMubm90aWZpY2F0aW9uUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdOb3RpZmljYXRpb25RdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYHdhcm1wYXd6LW5vdGlmaWNhdGlvbi1xdWV1ZSR7ZW52U3VmZml4fWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgIGVuY3J5cHRpb246IHNxcy5RdWV1ZUVuY3J5cHRpb24uU1FTX01BTkFHRUQsXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgICAgcXVldWU6IHRoaXMubm90aWZpY2F0aW9uRGxxLFxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGVhZCBMZXR0ZXIgUXVldWUgZm9yIGVtYWlsXG4gICAgdGhpcy5lbWFpbERscSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ0VtYWlsRExRJywge1xuICAgICAgcXVldWVOYW1lOiBgd2FybXBhd3otZW1haWwtZGxxJHtlbnZTdWZmaXh9YCxcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5TUVNfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIEVtYWlsIFF1ZXVlXG4gICAgdGhpcy5lbWFpbFF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnRW1haWxRdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYHdhcm1wYXd6LWVtYWlsLXF1ZXVlJHtlbnZTdWZmaXh9YCxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcyg2MCksXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5TUVNfTUFOQUdFRCxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogdGhpcy5lbWFpbERscSxcbiAgICAgICAgbWF4UmVjZWl2ZUNvdW50OiAzLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIERlYWQgTGV0dGVyIFF1ZXVlIGZvciBTTVNcbiAgICB0aGlzLnNtc0RscSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1Ntc0RMUScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYHdhcm1wYXd6LXNtcy1kbHEke2VudlN1ZmZpeH1gLFxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgICBlbmNyeXB0aW9uOiBzcXMuUXVldWVFbmNyeXB0aW9uLlNRU19NQU5BR0VELFxuICAgIH0pO1xuXG4gICAgLy8gU01TIFF1ZXVlXG4gICAgdGhpcy5zbXNRdWV1ZSA9IG5ldyBzcXMuUXVldWUodGhpcywgJ1Ntc1F1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiBgd2FybXBhd3otc21zLXF1ZXVlJHtlbnZTdWZmaXh9YCxcbiAgICAgIHZpc2liaWxpdHlUaW1lb3V0OiBjZGsuRHVyYXRpb24uc2Vjb25kcygzMCksXG4gICAgICByZXRlbnRpb25QZXJpb2Q6IGNkay5EdXJhdGlvbi5kYXlzKDcpLFxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5TUVNfTUFOQUdFRCxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogdGhpcy5zbXNEbHEsXG4gICAgICAgIG1heFJlY2VpdmVDb3VudDogMyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBEZWFkIExldHRlciBRdWV1ZSBmb3IgYW5hbHl0aWNzXG4gICAgdGhpcy5hbmFseXRpY3NEbHEgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdBbmFseXRpY3NETFEnLCB7XG4gICAgICBxdWV1ZU5hbWU6IGB3YXJtcGF3ei1hbmFseXRpY3MtZGxxJHtlbnZTdWZmaXh9YCxcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLFxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5TUVNfTUFOQUdFRCxcbiAgICB9KTtcblxuICAgIC8vIEFuYWx5dGljcyBRdWV1ZVxuICAgIHRoaXMuYW5hbHl0aWNzUXVldWUgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdBbmFseXRpY3NRdWV1ZScsIHtcbiAgICAgIHF1ZXVlTmFtZTogYHdhcm1wYXd6LWFuYWx5dGljcy1xdWV1ZSR7ZW52U3VmZml4fWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoNjApLFxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cyg3KSxcbiAgICAgIGVuY3J5cHRpb246IHNxcy5RdWV1ZUVuY3J5cHRpb24uU1FTX01BTkFHRUQsXG4gICAgICBkZWFkTGV0dGVyUXVldWU6IHtcbiAgICAgICAgcXVldWU6IHRoaXMuYW5hbHl0aWNzRGxxLFxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRGVhZCBMZXR0ZXIgUXVldWUgZm9yIHNldHRsZW1lbnRcbiAgICB0aGlzLnNldHRsZW1lbnREbHEgPSBuZXcgc3FzLlF1ZXVlKHRoaXMsICdTZXR0bGVtZW50RExRJywge1xuICAgICAgcXVldWVOYW1lOiBgd2FybXBhd3otc2V0dGxlbWVudC1kbHEke2VudlN1ZmZpeH1gLFxuICAgICAgcmV0ZW50aW9uUGVyaW9kOiBjZGsuRHVyYXRpb24uZGF5cygxNCksXG4gICAgICBlbmNyeXB0aW9uOiBzcXMuUXVldWVFbmNyeXB0aW9uLlNRU19NQU5BR0VELFxuICAgIH0pO1xuXG4gICAgLy8gU2V0dGxlbWVudCBRdWV1ZVxuICAgIHRoaXMuc2V0dGxlbWVudFF1ZXVlID0gbmV3IHNxcy5RdWV1ZSh0aGlzLCAnU2V0dGxlbWVudFF1ZXVlJywge1xuICAgICAgcXVldWVOYW1lOiBgd2FybXBhd3otc2V0dGxlbWVudC1xdWV1ZSR7ZW52U3VmZml4fWAsXG4gICAgICB2aXNpYmlsaXR5VGltZW91dDogY2RrLkR1cmF0aW9uLnNlY29uZHMoMzAwKSwgLy8gNSBtaW51dGVzIGZvciBzZXR0bGVtZW50IHByb2Nlc3NpbmdcbiAgICAgIHJldGVudGlvblBlcmlvZDogY2RrLkR1cmF0aW9uLmRheXMoMTQpLCAvLyBMb25nZXIgcmV0ZW50aW9uIGZvciBmaW5hbmNpYWwgZGF0YVxuICAgICAgZW5jcnlwdGlvbjogc3FzLlF1ZXVlRW5jcnlwdGlvbi5TUVNfTUFOQUdFRCxcbiAgICAgIGRlYWRMZXR0ZXJRdWV1ZToge1xuICAgICAgICBxdWV1ZTogdGhpcy5zZXR0bGVtZW50RGxxLFxuICAgICAgICBtYXhSZWNlaXZlQ291bnQ6IDMsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG59XG5cbiJdfQ==
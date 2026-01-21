"use strict";
/**
 * AWS CDK STACK - SQS QUEUES
 * Defines SQS queues for async processing
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
exports.SqsStack = void 0;
const cdk = __importStar(require("aws-cdk-lib"));
const sqs = __importStar(require("aws-cdk-lib/aws-sqs"));
const constructs_1 = require("constructs");
class SqsStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const env = props?.environment || 'dev';
        // Notification DLQ
        this.notificationDlq = new sqs.Queue(this, 'NotificationDlq', {
            queueName: `warmpawz-${env}-notification-dlq`,
            retentionPeriod: cdk.Duration.days(14),
        });
        // Notification Queue
        this.notificationQueue = new sqs.Queue(this, 'NotificationQueue', {
            queueName: `warmpawz-${env}-notification`,
            visibilityTimeout: cdk.Duration.seconds(300),
            deadLetterQueue: { queue: this.notificationDlq, maxReceiveCount: 3 },
        });
        // Email DLQ
        this.emailDlq = new sqs.Queue(this, 'EmailDlq', {
            queueName: `warmpawz-${env}-email-dlq`,
            retentionPeriod: cdk.Duration.days(14),
        });
        // Email Queue
        this.emailQueue = new sqs.Queue(this, 'EmailQueue', {
            queueName: `warmpawz-${env}-email`,
            visibilityTimeout: cdk.Duration.seconds(300),
            deadLetterQueue: { queue: this.emailDlq, maxReceiveCount: 3 },
        });
        // SMS DLQ
        this.smsDlq = new sqs.Queue(this, 'SmsDlq', {
            queueName: `warmpawz-${env}-sms-dlq`,
            retentionPeriod: cdk.Duration.days(14),
        });
        // SMS Queue
        this.smsQueue = new sqs.Queue(this, 'SmsQueue', {
            queueName: `warmpawz-${env}-sms`,
            visibilityTimeout: cdk.Duration.seconds(300),
            deadLetterQueue: { queue: this.smsDlq, maxReceiveCount: 3 },
        });
        // Analytics DLQ
        this.analyticsDlq = new sqs.Queue(this, 'AnalyticsDlq', {
            queueName: `warmpawz-${env}-analytics-dlq`,
            retentionPeriod: cdk.Duration.days(14),
        });
        // Analytics Queue
        this.analyticsQueue = new sqs.Queue(this, 'AnalyticsQueue', {
            queueName: `warmpawz-${env}-analytics`,
            visibilityTimeout: cdk.Duration.seconds(300),
            deadLetterQueue: { queue: this.analyticsDlq, maxReceiveCount: 3 },
        });
        // Settlement DLQ
        this.settlementDlq = new sqs.Queue(this, 'SettlementDlq', {
            queueName: `warmpawz-${env}-settlement-dlq`,
            retentionPeriod: cdk.Duration.days(14),
        });
        // Settlement Queue
        this.settlementQueue = new sqs.Queue(this, 'SettlementQueue', {
            queueName: `warmpawz-${env}-settlement`,
            visibilityTimeout: cdk.Duration.seconds(300),
            deadLetterQueue: { queue: this.settlementDlq, maxReceiveCount: 3 },
        });
    }
}
exports.SqsStack = SqsStack;
//# sourceMappingURL=sqs-stack.js.map
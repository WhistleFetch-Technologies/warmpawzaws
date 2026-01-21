"use strict";
/**
 * AWS CDK STACK - SNS TOPICS
 * Defines SNS topics for pub/sub messaging
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
exports.SnsStack = void 0;
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subs = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const constructs_1 = require("constructs");
class SnsStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const env = props.environment || 'dev';
        // Booking Created Topic
        this.bookingCreatedTopic = new sns.Topic(this, 'BookingCreatedTopic', {
            topicName: `warmpawz-${env}-booking-created`,
            displayName: 'Booking Created Notifications',
        });
        // Payment Processed Topic
        this.paymentProcessedTopic = new sns.Topic(this, 'PaymentProcessedTopic', {
            topicName: `warmpawz-${env}-payment-processed`,
            displayName: 'Payment Processed Notifications',
        });
        // Vendor Approved Topic
        this.vendorApprovedTopic = new sns.Topic(this, 'VendorApprovedTopic', {
            topicName: `warmpawz-${env}-vendor-approved`,
            displayName: 'Vendor Approved Notifications',
        });
        // General Notification Topic
        this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
            topicName: `warmpawz-${env}-notifications`,
            displayName: 'General Notifications',
        });
        // Analytics Topic
        this.analyticsTopic = new sns.Topic(this, 'AnalyticsTopic', {
            topicName: `warmpawz-${env}-analytics`,
            displayName: 'Analytics Events',
        });
        // Subscribe queues to topics
        this.notificationTopic.addSubscription(new subs.SqsSubscription(props.sqsStack.notificationQueue));
        this.analyticsTopic.addSubscription(new subs.SqsSubscription(props.sqsStack.analyticsQueue));
    }
}
exports.SnsStack = SnsStack;
//# sourceMappingURL=sns-stack.js.map
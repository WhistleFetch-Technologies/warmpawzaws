"use strict";
/**
 * AWS CDK STACK - EVENTBRIDGE
 * Defines EventBridge event bus and rules
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
exports.EventBridgeStack = void 0;
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
class EventBridgeStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const env = props.environment || 'dev';
        // Create EventBus
        this.eventBus = new events.EventBus(this, 'EventBus', {
            eventBusName: `warmpawz-${env}-events`,
            description: 'Warmpawz platform event bus',
        });
        // Rule for booking events
        new events.Rule(this, 'BookingEventsRule', {
            eventBus: this.eventBus,
            ruleName: `warmpawz-${env}-booking-events`,
            description: 'Route booking events to notification queue',
            eventPattern: {
                source: ['warmpawz.booking'],
                detailType: ['BookingCreated', 'BookingConfirmed', 'BookingCancelled'],
            },
            targets: [
                new targets.SqsQueue(props.sqsStack.notificationQueue),
                new targets.SnsTopic(props.snsStack.bookingCreatedTopic),
            ],
        });
        // Rule for payment events
        new events.Rule(this, 'PaymentEventsRule', {
            eventBus: this.eventBus,
            ruleName: `warmpawz-${env}-payment-events`,
            description: 'Route payment events to processing queue',
            eventPattern: {
                source: ['warmpawz.payment'],
                detailType: ['PaymentReceived', 'PaymentFailed', 'RefundProcessed'],
            },
            targets: [
                new targets.SnsTopic(props.snsStack.paymentProcessedTopic),
            ],
        });
        // Rule for analytics events
        new events.Rule(this, 'AnalyticsEventsRule', {
            eventBus: this.eventBus,
            ruleName: `warmpawz-${env}-analytics-events`,
            description: 'Route analytics events to analytics queue',
            eventPattern: {
                source: ['warmpawz'],
                detailType: events.Match.prefix('Analytics'),
            },
            targets: [
                new targets.SqsQueue(props.sqsStack.analyticsQueue),
            ],
        });
        // Rule for settlement events
        new events.Rule(this, 'SettlementEventsRule', {
            eventBus: this.eventBus,
            ruleName: `warmpawz-${env}-settlement-events`,
            description: 'Route settlement events to settlement queue',
            eventPattern: {
                source: ['warmpawz.settlement'],
                detailType: ['SettlementDue', 'SettlementProcessed'],
            },
            targets: [
                new targets.SqsQueue(props.sqsStack.settlementQueue),
            ],
        });
    }
}
exports.EventBridgeStack = EventBridgeStack;
//# sourceMappingURL=eventbridge-stack.js.map
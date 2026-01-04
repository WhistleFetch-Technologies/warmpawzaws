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
exports.SnsStack = void 0;
const sns = __importStar(require("aws-cdk-lib/aws-sns"));
const subscriptions = __importStar(require("aws-cdk-lib/aws-sns-subscriptions"));
const constructs_1 = require("constructs");
class SnsStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props.environment || 'dev';
        const envSuffix = environment === 'prod' ? '' : `-${environment}`;
        // Booking Created Topic
        this.bookingCreatedTopic = new sns.Topic(this, 'BookingCreatedTopic', {
            topicName: `warmpawz-booking-created${envSuffix}`,
            displayName: 'Warmpawz Booking Created Events',
        });
        // Payment Processed Topic
        this.paymentProcessedTopic = new sns.Topic(this, 'PaymentProcessedTopic', {
            topicName: `warmpawz-payment-processed${envSuffix}`,
            displayName: 'Warmpawz Payment Processed Events',
        });
        // Vendor Approved Topic
        this.vendorApprovedTopic = new sns.Topic(this, 'VendorApprovedTopic', {
            topicName: `warmpawz-vendor-approved${envSuffix}`,
            displayName: 'Warmpawz Vendor Approved Events',
        });
        // Notification Topic
        this.notificationTopic = new sns.Topic(this, 'NotificationTopic', {
            topicName: `warmpawz-notification${envSuffix}`,
            displayName: 'Warmpawz Notification Events',
        });
        // Analytics Topic
        this.analyticsTopic = new sns.Topic(this, 'AnalyticsTopic', {
            topicName: `warmpawz-analytics${envSuffix}`,
            displayName: 'Warmpawz Analytics Events',
        });
        // Subscribe SQS queues to SNS topics
        // Booking Created → Notification Queue
        this.bookingCreatedTopic.addSubscription(new subscriptions.SqsSubscription(props.sqsStack.notificationQueue, {
            rawMessageDelivery: false,
        }));
        // Payment Processed → Notification Queue + Analytics Queue
        this.paymentProcessedTopic.addSubscription(new subscriptions.SqsSubscription(props.sqsStack.notificationQueue, {
            rawMessageDelivery: false,
        }));
        this.paymentProcessedTopic.addSubscription(new subscriptions.SqsSubscription(props.sqsStack.analyticsQueue, {
            rawMessageDelivery: false,
        }));
        // Vendor Approved → Notification Queue
        this.vendorApprovedTopic.addSubscription(new subscriptions.SqsSubscription(props.sqsStack.notificationQueue, {
            rawMessageDelivery: false,
        }));
        // Notification Topic → Notification Queue (for direct notifications)
        this.notificationTopic.addSubscription(new subscriptions.SqsSubscription(props.sqsStack.notificationQueue, {
            rawMessageDelivery: false,
        }));
        // Analytics Topic → Analytics Queue
        this.analyticsTopic.addSubscription(new subscriptions.SqsSubscription(props.sqsStack.analyticsQueue, {
            rawMessageDelivery: false,
        }));
    }
}
exports.SnsStack = SnsStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic25zLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsic25zLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQ0EseURBQTJDO0FBRTNDLGlGQUFtRTtBQUNuRSwyQ0FBdUM7QUFRdkMsTUFBYSxRQUFTLFNBQVEsc0JBQVM7SUFPckMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFvQjtRQUM1RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO1FBQy9DLE1BQU0sU0FBUyxHQUFHLFdBQVcsS0FBSyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsSUFBSSxXQUFXLEVBQUUsQ0FBQztRQUVsRSx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDcEUsU0FBUyxFQUFFLDJCQUEyQixTQUFTLEVBQUU7WUFDakQsV0FBVyxFQUFFLGlDQUFpQztTQUMvQyxDQUFDLENBQUM7UUFFSCwwQkFBMEI7UUFDMUIsSUFBSSxDQUFDLHFCQUFxQixHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDeEUsU0FBUyxFQUFFLDZCQUE2QixTQUFTLEVBQUU7WUFDbkQsV0FBVyxFQUFFLG1DQUFtQztTQUNqRCxDQUFDLENBQUM7UUFFSCx3QkFBd0I7UUFDeEIsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUscUJBQXFCLEVBQUU7WUFDcEUsU0FBUyxFQUFFLDJCQUEyQixTQUFTLEVBQUU7WUFDakQsV0FBVyxFQUFFLGlDQUFpQztTQUMvQyxDQUFDLENBQUM7UUFFSCxxQkFBcUI7UUFDckIsSUFBSSxDQUFDLGlCQUFpQixHQUFHLElBQUksR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLEVBQUU7WUFDaEUsU0FBUyxFQUFFLHdCQUF3QixTQUFTLEVBQUU7WUFDOUMsV0FBVyxFQUFFLDhCQUE4QjtTQUM1QyxDQUFDLENBQUM7UUFFSCxrQkFBa0I7UUFDbEIsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGdCQUFnQixFQUFFO1lBQzFELFNBQVMsRUFBRSxxQkFBcUIsU0FBUyxFQUFFO1lBQzNDLFdBQVcsRUFBRSwyQkFBMkI7U0FDekMsQ0FBQyxDQUFDO1FBRUgscUNBQXFDO1FBQ3JDLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUN0QyxJQUFJLGFBQWEsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRTtZQUNsRSxrQkFBa0IsRUFBRSxLQUFLO1NBQzFCLENBQUMsQ0FDSCxDQUFDO1FBRUYsMkRBQTJEO1FBQzNELElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxlQUFlLENBQ3hDLElBQUksYUFBYSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFO1lBQ2xFLGtCQUFrQixFQUFFLEtBQUs7U0FDMUIsQ0FBQyxDQUNILENBQUM7UUFDRixJQUFJLENBQUMscUJBQXFCLENBQUMsZUFBZSxDQUN4QyxJQUFJLGFBQWEsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUU7WUFDL0Qsa0JBQWtCLEVBQUUsS0FBSztTQUMxQixDQUFDLENBQ0gsQ0FBQztRQUVGLHVDQUF1QztRQUN2QyxJQUFJLENBQUMsbUJBQW1CLENBQUMsZUFBZSxDQUN0QyxJQUFJLGFBQWEsQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsRUFBRTtZQUNsRSxrQkFBa0IsRUFBRSxLQUFLO1NBQzFCLENBQUMsQ0FDSCxDQUFDO1FBRUYscUVBQXFFO1FBQ3JFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlLENBQ3BDLElBQUksYUFBYSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGlCQUFpQixFQUFFO1lBQ2xFLGtCQUFrQixFQUFFLEtBQUs7U0FDMUIsQ0FBQyxDQUNILENBQUM7UUFFRixvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxlQUFlLENBQ2pDLElBQUksYUFBYSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLGNBQWMsRUFBRTtZQUMvRCxrQkFBa0IsRUFBRSxLQUFLO1NBQzFCLENBQUMsQ0FDSCxDQUFDO0lBQ0osQ0FBQztDQUNGO0FBcEZELDRCQW9GQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYic7XG5pbXBvcnQgKiBhcyBzbnMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNucyc7XG5pbXBvcnQgKiBhcyBzcXMgZnJvbSAnYXdzLWNkay1saWIvYXdzLXNxcyc7XG5pbXBvcnQgKiBhcyBzdWJzY3JpcHRpb25zIGZyb20gJ2F3cy1jZGstbGliL2F3cy1zbnMtc3Vic2NyaXB0aW9ucyc7XG5pbXBvcnQgeyBDb25zdHJ1Y3QgfSBmcm9tICdjb25zdHJ1Y3RzJztcbmltcG9ydCB7IFNxc1N0YWNrIH0gZnJvbSAnLi9zcXMtc3RhY2snO1xuXG5leHBvcnQgaW50ZXJmYWNlIFNuc1N0YWNrUHJvcHMge1xuICBzcXNTdGFjazogU3FzU3RhY2s7XG4gIGVudmlyb25tZW50Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU25zU3RhY2sgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgYm9va2luZ0NyZWF0ZWRUb3BpYzogc25zLlRvcGljO1xuICBwdWJsaWMgcmVhZG9ubHkgcGF5bWVudFByb2Nlc3NlZFRvcGljOiBzbnMuVG9waWM7XG4gIHB1YmxpYyByZWFkb25seSB2ZW5kb3JBcHByb3ZlZFRvcGljOiBzbnMuVG9waWM7XG4gIHB1YmxpYyByZWFkb25seSBub3RpZmljYXRpb25Ub3BpYzogc25zLlRvcGljO1xuICBwdWJsaWMgcmVhZG9ubHkgYW5hbHl0aWNzVG9waWM6IHNucy5Ub3BpYztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogU25zU3RhY2tQcm9wcykge1xuICAgIHN1cGVyKHNjb3BlLCBpZCk7XG5cbiAgICBjb25zdCBlbnZpcm9ubWVudCA9IHByb3BzLmVudmlyb25tZW50IHx8ICdkZXYnO1xuICAgIGNvbnN0IGVudlN1ZmZpeCA9IGVudmlyb25tZW50ID09PSAncHJvZCcgPyAnJyA6IGAtJHtlbnZpcm9ubWVudH1gO1xuXG4gICAgLy8gQm9va2luZyBDcmVhdGVkIFRvcGljXG4gICAgdGhpcy5ib29raW5nQ3JlYXRlZFRvcGljID0gbmV3IHNucy5Ub3BpYyh0aGlzLCAnQm9va2luZ0NyZWF0ZWRUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYHdhcm1wYXd6LWJvb2tpbmctY3JlYXRlZCR7ZW52U3VmZml4fWAsXG4gICAgICBkaXNwbGF5TmFtZTogJ1dhcm1wYXd6IEJvb2tpbmcgQ3JlYXRlZCBFdmVudHMnLFxuICAgIH0pO1xuXG4gICAgLy8gUGF5bWVudCBQcm9jZXNzZWQgVG9waWNcbiAgICB0aGlzLnBheW1lbnRQcm9jZXNzZWRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1BheW1lbnRQcm9jZXNzZWRUb3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYHdhcm1wYXd6LXBheW1lbnQtcHJvY2Vzc2VkJHtlbnZTdWZmaXh9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnV2FybXBhd3ogUGF5bWVudCBQcm9jZXNzZWQgRXZlbnRzJyxcbiAgICB9KTtcblxuICAgIC8vIFZlbmRvciBBcHByb3ZlZCBUb3BpY1xuICAgIHRoaXMudmVuZG9yQXBwcm92ZWRUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ1ZlbmRvckFwcHJvdmVkVG9waWMnLCB7XG4gICAgICB0b3BpY05hbWU6IGB3YXJtcGF3ei12ZW5kb3ItYXBwcm92ZWQke2VudlN1ZmZpeH1gLFxuICAgICAgZGlzcGxheU5hbWU6ICdXYXJtcGF3eiBWZW5kb3IgQXBwcm92ZWQgRXZlbnRzJyxcbiAgICB9KTtcblxuICAgIC8vIE5vdGlmaWNhdGlvbiBUb3BpY1xuICAgIHRoaXMubm90aWZpY2F0aW9uVG9waWMgPSBuZXcgc25zLlRvcGljKHRoaXMsICdOb3RpZmljYXRpb25Ub3BpYycsIHtcbiAgICAgIHRvcGljTmFtZTogYHdhcm1wYXd6LW5vdGlmaWNhdGlvbiR7ZW52U3VmZml4fWAsXG4gICAgICBkaXNwbGF5TmFtZTogJ1dhcm1wYXd6IE5vdGlmaWNhdGlvbiBFdmVudHMnLFxuICAgIH0pO1xuXG4gICAgLy8gQW5hbHl0aWNzIFRvcGljXG4gICAgdGhpcy5hbmFseXRpY3NUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgJ0FuYWx5dGljc1RvcGljJywge1xuICAgICAgdG9waWNOYW1lOiBgd2FybXBhd3otYW5hbHl0aWNzJHtlbnZTdWZmaXh9YCxcbiAgICAgIGRpc3BsYXlOYW1lOiAnV2FybXBhd3ogQW5hbHl0aWNzIEV2ZW50cycsXG4gICAgfSk7XG5cbiAgICAvLyBTdWJzY3JpYmUgU1FTIHF1ZXVlcyB0byBTTlMgdG9waWNzXG4gICAgLy8gQm9va2luZyBDcmVhdGVkIOKGkiBOb3RpZmljYXRpb24gUXVldWVcbiAgICB0aGlzLmJvb2tpbmdDcmVhdGVkVG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHN1YnNjcmlwdGlvbnMuU3FzU3Vic2NyaXB0aW9uKHByb3BzLnNxc1N0YWNrLm5vdGlmaWNhdGlvblF1ZXVlLCB7XG4gICAgICAgIHJhd01lc3NhZ2VEZWxpdmVyeTogZmFsc2UsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBQYXltZW50IFByb2Nlc3NlZCDihpIgTm90aWZpY2F0aW9uIFF1ZXVlICsgQW5hbHl0aWNzIFF1ZXVlXG4gICAgdGhpcy5wYXltZW50UHJvY2Vzc2VkVG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHN1YnNjcmlwdGlvbnMuU3FzU3Vic2NyaXB0aW9uKHByb3BzLnNxc1N0YWNrLm5vdGlmaWNhdGlvblF1ZXVlLCB7XG4gICAgICAgIHJhd01lc3NhZ2VEZWxpdmVyeTogZmFsc2UsXG4gICAgICB9KVxuICAgICk7XG4gICAgdGhpcy5wYXltZW50UHJvY2Vzc2VkVG9waWMuYWRkU3Vic2NyaXB0aW9uKFxuICAgICAgbmV3IHN1YnNjcmlwdGlvbnMuU3FzU3Vic2NyaXB0aW9uKHByb3BzLnNxc1N0YWNrLmFuYWx5dGljc1F1ZXVlLCB7XG4gICAgICAgIHJhd01lc3NhZ2VEZWxpdmVyeTogZmFsc2UsXG4gICAgICB9KVxuICAgICk7XG5cbiAgICAvLyBWZW5kb3IgQXBwcm92ZWQg4oaSIE5vdGlmaWNhdGlvbiBRdWV1ZVxuICAgIHRoaXMudmVuZG9yQXBwcm92ZWRUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc3Vic2NyaXB0aW9ucy5TcXNTdWJzY3JpcHRpb24ocHJvcHMuc3FzU3RhY2subm90aWZpY2F0aW9uUXVldWUsIHtcbiAgICAgICAgcmF3TWVzc2FnZURlbGl2ZXJ5OiBmYWxzZSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIE5vdGlmaWNhdGlvbiBUb3BpYyDihpIgTm90aWZpY2F0aW9uIFF1ZXVlIChmb3IgZGlyZWN0IG5vdGlmaWNhdGlvbnMpXG4gICAgdGhpcy5ub3RpZmljYXRpb25Ub3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc3Vic2NyaXB0aW9ucy5TcXNTdWJzY3JpcHRpb24ocHJvcHMuc3FzU3RhY2subm90aWZpY2F0aW9uUXVldWUsIHtcbiAgICAgICAgcmF3TWVzc2FnZURlbGl2ZXJ5OiBmYWxzZSxcbiAgICAgIH0pXG4gICAgKTtcblxuICAgIC8vIEFuYWx5dGljcyBUb3BpYyDihpIgQW5hbHl0aWNzIFF1ZXVlXG4gICAgdGhpcy5hbmFseXRpY3NUb3BpYy5hZGRTdWJzY3JpcHRpb24oXG4gICAgICBuZXcgc3Vic2NyaXB0aW9ucy5TcXNTdWJzY3JpcHRpb24ocHJvcHMuc3FzU3RhY2suYW5hbHl0aWNzUXVldWUsIHtcbiAgICAgICAgcmF3TWVzc2FnZURlbGl2ZXJ5OiBmYWxzZSxcbiAgICAgIH0pXG4gICAgKTtcbiAgfVxufVxuXG4iXX0=
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
exports.EventBridgeStack = void 0;
const events = __importStar(require("aws-cdk-lib/aws-events"));
const targets = __importStar(require("aws-cdk-lib/aws-events-targets"));
const constructs_1 = require("constructs");
class EventBridgeStack extends constructs_1.Construct {
    constructor(scope, id, props) {
        super(scope, id);
        const environment = props.environment || 'dev';
        // Custom Event Bus for Warmpawz platform events
        this.eventBus = new events.EventBus(this, 'WarmpawzEventBus', {
            eventBusName: `warmpawz-events-${environment}`,
        });
        // Event Rules for routing events
        // Rule: Booking events → SNS topic
        new events.Rule(this, 'BookingEventRule', {
            eventBus: this.eventBus,
            eventPattern: {
                source: ['warmpawz.booking'],
                detailType: ['Booking Created', 'Booking Updated', 'Booking Cancelled'],
            },
            targets: [
                new targets.SnsTopic(props.snsStack.bookingCreatedTopic),
            ],
        });
        // Rule: Payment events → SNS topic
        new events.Rule(this, 'PaymentEventRule', {
            eventBus: this.eventBus,
            eventPattern: {
                source: ['warmpawz.payment'],
                detailType: ['Payment Processed', 'Payment Failed', 'Refund Processed'],
            },
            targets: [
                new targets.SnsTopic(props.snsStack.paymentProcessedTopic),
            ],
        });
        // Rule: Vendor events → SNS topic
        new events.Rule(this, 'VendorEventRule', {
            eventBus: this.eventBus,
            eventPattern: {
                source: ['warmpawz.vendor'],
                detailType: ['Vendor Approved', 'Vendor Rejected', 'Vendor Updated'],
            },
            targets: [
                new targets.SnsTopic(props.snsStack.vendorApprovedTopic),
            ],
        });
        // Rule: Analytics events → Analytics queue
        new events.Rule(this, 'AnalyticsEventRule', {
            eventBus: this.eventBus,
            eventPattern: {
                source: ['warmpawz.analytics'],
            },
            targets: [
                new targets.SqsQueue(props.sqsStack.analyticsQueue),
            ],
        });
        // Rule: Notification events → Notification queue
        new events.Rule(this, 'NotificationEventRule', {
            eventBus: this.eventBus,
            eventPattern: {
                source: ['warmpawz.notification'],
            },
            targets: [
                new targets.SqsQueue(props.sqsStack.notificationQueue),
            ],
        });
    }
}
exports.EventBridgeStack = EventBridgeStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnRicmlkZ2Utc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJldmVudGJyaWRnZS1zdGFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLCtEQUFpRDtBQUNqRCx3RUFBMEQ7QUFDMUQsMkNBQXVDO0FBVXZDLE1BQWEsZ0JBQWlCLFNBQVEsc0JBQVM7SUFHN0MsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUE0QjtRQUNwRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBRWpCLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxXQUFXLElBQUksS0FBSyxDQUFDO1FBRS9DLGdEQUFnRDtRQUNoRCxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDNUQsWUFBWSxFQUFFLG1CQUFtQixXQUFXLEVBQUU7U0FDL0MsQ0FBQyxDQUFDO1FBRUgsaUNBQWlDO1FBRWpDLG1DQUFtQztRQUNuQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLGtCQUFrQixFQUFFO1lBQ3hDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixZQUFZLEVBQUU7Z0JBQ1osTUFBTSxFQUFFLENBQUMsa0JBQWtCLENBQUM7Z0JBQzVCLFVBQVUsRUFBRSxDQUFDLGlCQUFpQixFQUFFLGlCQUFpQixFQUFFLG1CQUFtQixDQUFDO2FBQ3hFO1lBQ0QsT0FBTyxFQUFFO2dCQUNQLElBQUksT0FBTyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLG1CQUFtQixDQUFDO2FBQ3pEO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsbUNBQW1DO1FBQ25DLElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsa0JBQWtCLEVBQUU7WUFDeEMsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLFlBQVksRUFBRTtnQkFDWixNQUFNLEVBQUUsQ0FBQyxrQkFBa0IsQ0FBQztnQkFDNUIsVUFBVSxFQUFFLENBQUMsbUJBQW1CLEVBQUUsZ0JBQWdCLEVBQUUsa0JBQWtCLENBQUM7YUFDeEU7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMscUJBQXFCLENBQUM7YUFDM0Q7U0FDRixDQUFDLENBQUM7UUFFSCxrQ0FBa0M7UUFDbEMsSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRTtZQUN2QyxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdkIsWUFBWSxFQUFFO2dCQUNaLE1BQU0sRUFBRSxDQUFDLGlCQUFpQixDQUFDO2dCQUMzQixVQUFVLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxnQkFBZ0IsQ0FBQzthQUNyRTtZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxtQkFBbUIsQ0FBQzthQUN6RDtTQUNGLENBQUMsQ0FBQztRQUVILDJDQUEyQztRQUMzQyxJQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLG9CQUFvQixFQUFFO1lBQzFDLFFBQVEsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN2QixZQUFZLEVBQUU7Z0JBQ1osTUFBTSxFQUFFLENBQUMsb0JBQW9CLENBQUM7YUFDL0I7WUFDRCxPQUFPLEVBQUU7Z0JBQ1AsSUFBSSxPQUFPLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDO2FBQ3BEO1NBQ0YsQ0FBQyxDQUFDO1FBRUgsaURBQWlEO1FBQ2pELElBQUksTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsdUJBQXVCLEVBQUU7WUFDN0MsUUFBUSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3ZCLFlBQVksRUFBRTtnQkFDWixNQUFNLEVBQUUsQ0FBQyx1QkFBdUIsQ0FBQzthQUNsQztZQUNELE9BQU8sRUFBRTtnQkFDUCxJQUFJLE9BQU8sQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxpQkFBaUIsQ0FBQzthQUN2RDtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7Q0FDRjtBQXpFRCw0Q0F5RUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBjZGsgZnJvbSAnYXdzLWNkay1saWInO1xuaW1wb3J0ICogYXMgZXZlbnRzIGZyb20gJ2F3cy1jZGstbGliL2F3cy1ldmVudHMnO1xuaW1wb3J0ICogYXMgdGFyZ2V0cyBmcm9tICdhd3MtY2RrLWxpYi9hd3MtZXZlbnRzLXRhcmdldHMnO1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cyc7XG5pbXBvcnQgeyBTcXNTdGFjayB9IGZyb20gJy4vc3FzLXN0YWNrJztcbmltcG9ydCB7IFNuc1N0YWNrIH0gZnJvbSAnLi9zbnMtc3RhY2snO1xuXG5leHBvcnQgaW50ZXJmYWNlIEV2ZW50QnJpZGdlU3RhY2tQcm9wcyB7XG4gIHNxc1N0YWNrOiBTcXNTdGFjaztcbiAgc25zU3RhY2s6IFNuc1N0YWNrO1xuICBlbnZpcm9ubWVudD86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEV2ZW50QnJpZGdlU3RhY2sgZXh0ZW5kcyBDb25zdHJ1Y3Qge1xuICBwdWJsaWMgcmVhZG9ubHkgZXZlbnRCdXM6IGV2ZW50cy5FdmVudEJ1cztcblxuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wczogRXZlbnRCcmlkZ2VTdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkKTtcblxuICAgIGNvbnN0IGVudmlyb25tZW50ID0gcHJvcHMuZW52aXJvbm1lbnQgfHwgJ2Rldic7XG5cbiAgICAvLyBDdXN0b20gRXZlbnQgQnVzIGZvciBXYXJtcGF3eiBwbGF0Zm9ybSBldmVudHNcbiAgICB0aGlzLmV2ZW50QnVzID0gbmV3IGV2ZW50cy5FdmVudEJ1cyh0aGlzLCAnV2FybXBhd3pFdmVudEJ1cycsIHtcbiAgICAgIGV2ZW50QnVzTmFtZTogYHdhcm1wYXd6LWV2ZW50cy0ke2Vudmlyb25tZW50fWAsXG4gICAgfSk7XG5cbiAgICAvLyBFdmVudCBSdWxlcyBmb3Igcm91dGluZyBldmVudHNcblxuICAgIC8vIFJ1bGU6IEJvb2tpbmcgZXZlbnRzIOKGkiBTTlMgdG9waWNcbiAgICBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ0Jvb2tpbmdFdmVudFJ1bGUnLCB7XG4gICAgICBldmVudEJ1czogdGhpcy5ldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnd2FybXBhd3ouYm9va2luZyddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ0Jvb2tpbmcgQ3JlYXRlZCcsICdCb29raW5nIFVwZGF0ZWQnLCAnQm9va2luZyBDYW5jZWxsZWQnXSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIG5ldyB0YXJnZXRzLlNuc1RvcGljKHByb3BzLnNuc1N0YWNrLmJvb2tpbmdDcmVhdGVkVG9waWMpLFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIFJ1bGU6IFBheW1lbnQgZXZlbnRzIOKGkiBTTlMgdG9waWNcbiAgICBuZXcgZXZlbnRzLlJ1bGUodGhpcywgJ1BheW1lbnRFdmVudFJ1bGUnLCB7XG4gICAgICBldmVudEJ1czogdGhpcy5ldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnd2FybXBhd3oucGF5bWVudCddLFxuICAgICAgICBkZXRhaWxUeXBlOiBbJ1BheW1lbnQgUHJvY2Vzc2VkJywgJ1BheW1lbnQgRmFpbGVkJywgJ1JlZnVuZCBQcm9jZXNzZWQnXSxcbiAgICAgIH0sXG4gICAgICB0YXJnZXRzOiBbXG4gICAgICAgIG5ldyB0YXJnZXRzLlNuc1RvcGljKHByb3BzLnNuc1N0YWNrLnBheW1lbnRQcm9jZXNzZWRUb3BpYyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gUnVsZTogVmVuZG9yIGV2ZW50cyDihpIgU05TIHRvcGljXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdWZW5kb3JFdmVudFJ1bGUnLCB7XG4gICAgICBldmVudEJ1czogdGhpcy5ldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnd2FybXBhd3oudmVuZG9yJ10sXG4gICAgICAgIGRldGFpbFR5cGU6IFsnVmVuZG9yIEFwcHJvdmVkJywgJ1ZlbmRvciBSZWplY3RlZCcsICdWZW5kb3IgVXBkYXRlZCddLFxuICAgICAgfSxcbiAgICAgIHRhcmdldHM6IFtcbiAgICAgICAgbmV3IHRhcmdldHMuU25zVG9waWMocHJvcHMuc25zU3RhY2sudmVuZG9yQXBwcm92ZWRUb3BpYyksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gUnVsZTogQW5hbHl0aWNzIGV2ZW50cyDihpIgQW5hbHl0aWNzIHF1ZXVlXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdBbmFseXRpY3NFdmVudFJ1bGUnLCB7XG4gICAgICBldmVudEJ1czogdGhpcy5ldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnd2FybXBhd3ouYW5hbHl0aWNzJ10sXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW1xuICAgICAgICBuZXcgdGFyZ2V0cy5TcXNRdWV1ZShwcm9wcy5zcXNTdGFjay5hbmFseXRpY3NRdWV1ZSksXG4gICAgICBdLFxuICAgIH0pO1xuXG4gICAgLy8gUnVsZTogTm90aWZpY2F0aW9uIGV2ZW50cyDihpIgTm90aWZpY2F0aW9uIHF1ZXVlXG4gICAgbmV3IGV2ZW50cy5SdWxlKHRoaXMsICdOb3RpZmljYXRpb25FdmVudFJ1bGUnLCB7XG4gICAgICBldmVudEJ1czogdGhpcy5ldmVudEJ1cyxcbiAgICAgIGV2ZW50UGF0dGVybjoge1xuICAgICAgICBzb3VyY2U6IFsnd2FybXBhd3oubm90aWZpY2F0aW9uJ10sXG4gICAgICB9LFxuICAgICAgdGFyZ2V0czogW1xuICAgICAgICBuZXcgdGFyZ2V0cy5TcXNRdWV1ZShwcm9wcy5zcXNTdGFjay5ub3RpZmljYXRpb25RdWV1ZSksXG4gICAgICBdLFxuICAgIH0pO1xuICB9XG59XG5cbiJdfQ==
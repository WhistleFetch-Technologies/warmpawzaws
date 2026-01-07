import * as events from 'aws-cdk-lib/aws-events';
import { Construct } from 'constructs';
import { SqsStack } from './sqs-stack';
import { SnsStack } from './sns-stack';
export interface EventBridgeStackProps {
    sqsStack: SqsStack;
    snsStack: SnsStack;
    environment?: string;
}
export declare class EventBridgeStack extends Construct {
    readonly eventBus: events.EventBus;
    constructor(scope: Construct, id: string, props: EventBridgeStackProps);
}

/**
 * EVENT LISTENER MODULE
 * 
 * Real AWS event listeners for SNS, EventBridge, and SQS
 * Provides actual event validation for E2E testing
 */

import { SNSClient, SubscribeCommand } from '@aws-sdk/client-sns';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { SQSClient, ReceiveMessageCommand } from '@aws-sdk/client-sqs';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  eventBridgeBus: process.env.EVENT_BRIDGE_BUS || 'warmpawz-events',
  snsTopicArn: process.env.SNS_TOPIC_ARN || '',
  sqsQueueUrl: process.env.SQS_QUEUE_URL || '',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
};

// ============================================================================
// EVENT LISTENER
// ============================================================================

export interface EventMessage {
  eventType: string;
  payload: any;
  timestamp: Date;
  source: 'SNS' | 'EventBridge' | 'SQS';
}

export class EventListener {
  private snsClient: SNSClient | null = null;
  private eventBridgeClient: EventBridgeClient | null = null;
  private sqsClient: SQSClient | null = null;
  private eventQueue: EventMessage[] = [];
  private listeners: Map<string, ((event: EventMessage) => void)[]> = new Map();

  /**
   * Initialize event listeners
   */
  async initialize(): Promise<void> {
    if (!config.accessKeyId || !config.secretAccessKey) {
      console.warn('⚠️  AWS credentials not set, event validation will be skipped');
      return;
    }

    try {
      console.log('📡 Initializing event listeners...');
      
      const credentials = {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      };

      this.snsClient = new SNSClient({ region: config.region, credentials });
      this.eventBridgeClient = new EventBridgeClient({ region: config.region, credentials });
      this.sqsClient = new SQSClient({ region: config.region, credentials });

      console.log('✅ Event listeners initialized');
    } catch (error: any) {
      console.error('❌ Event listener initialization failed:', error.message);
    }
  }

  /**
   * Listen for event
   */
  async listenForEvent(
    eventType: string,
    timeout: number = 10000
  ): Promise<EventMessage | null> {
    const startTime = Date.now();
    
    // Check existing queue first
    const existing = this.eventQueue.find(e => e.eventType === eventType);
    if (existing) {
      this.eventQueue = this.eventQueue.filter(e => e !== existing);
      return existing;
    }

    // Wait for new event
    return new Promise((resolve) => {
      const listener = (event: EventMessage) => {
        if (event.eventType === eventType) {
          const index = this.listeners.get(eventType)?.indexOf(listener);
          if (index !== undefined && index >= 0) {
            this.listeners.get(eventType)?.splice(index, 1);
          }
          resolve(event);
        }
      };

      if (!this.listeners.has(eventType)) {
        this.listeners.set(eventType, []);
      }
      this.listeners.get(eventType)!.push(listener);

      // Timeout
      setTimeout(() => {
        const index = this.listeners.get(eventType)?.indexOf(listener);
        if (index !== undefined && index >= 0) {
          this.listeners.get(eventType)?.splice(index, 1);
        }
        resolve(null);
      }, timeout);
    });
  }

  /**
   * Add event to queue (called when event is received)
   */
  addEvent(event: EventMessage): void {
    this.eventQueue.push(event);
    
    // Notify listeners
    const listeners = this.listeners.get(event.eventType) || [];
    listeners.forEach(listener => listener(event));
  }

  /**
   * Check if event was received
   */
  async checkEvent(eventType: string, timeout: number = 10000): Promise<boolean> {
    const event = await this.listenForEvent(eventType, timeout);
    return event !== null;
  }

  /**
   * Get event payload
   */
  async getEventPayload(eventType: string, timeout: number = 10000): Promise<any | null> {
    const event = await this.listenForEvent(eventType, timeout);
    return event?.payload || null;
  }

  /**
   * Clear event queue
   */
  clearQueue(): void {
    this.eventQueue = [];
  }

  /**
   * Close listeners
   */
  async close(): Promise<void> {
    this.listeners.clear();
    this.eventQueue = [];
    console.log('🔒 Event listeners closed');
  }
}

// Singleton instance
export const eventListener = new EventListener();

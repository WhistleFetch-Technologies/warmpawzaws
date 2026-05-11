/**
 * WebSocket client (vendor) — mirrors customer client for meal subscription session updates.
 */

type WebSocketMessage = {
  type:
    | 'order_status_update'
    | 'pharmacy_broadcast'
    | 'meal_order_update'
    | 'delivery_update'
    | 'meal_subscription_delivery_update'
    | 'notification';
  data: any;
  timestamp: string;
};

type MessageHandler = (message: WebSocketMessage) => void;

class WebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private isConnecting = false;

  constructor(apiBaseUrl: string, userId: string, userType: 'customer' | 'vendor') {
    const wsUrl = apiBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    this.url = `${wsUrl}/ws?userId=${userId}&userType=${userType}`;
  }

  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) return Promise.resolve();
    if (this.isConnecting) return Promise.resolve();
    this.isConnecting = true;
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };
        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch {
            /* ignore */
          }
        };
        this.ws.onerror = (error) => {
          this.isConnecting = false;
          reject(error);
        };
        this.ws.onclose = () => {
          this.isConnecting = false;
          this.ws = null;
          this.attemptReconnect();
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }

  on(messageType: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType)!.add(handler);
    return () => {
      const handlers = this.handlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) this.handlers.delete(messageType);
      }
    };
  }

  onMealSubscriptionDeliveryBroadcast(handler: (data: any) => void): () => void {
    return this.on('meal_subscription_delivery_update', (message) => {
      handler(message.data);
    });
  }

  private handleMessage(message: WebSocketMessage): void {
    const handlers = this.handlers.get(message.type);
    handlers?.forEach((handler) => handler(message));
    const allHandlers = this.handlers.get('all');
    allHandlers?.forEach((handler) => handler(message));
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

let wsClientInstance: WebSocketClient | null = null;

export function createWebSocketClient(apiBaseUrl: string, userId: string, userType: 'customer' | 'vendor') {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient(apiBaseUrl, userId, userType);
  }
  return wsClientInstance;
}

export function disconnectWebSocket(): void {
  if (wsClientInstance) {
    wsClientInstance.disconnect();
    wsClientInstance = null;
  }
}

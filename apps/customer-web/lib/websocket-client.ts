/**
 * ============================================================================
 * WEBSOCKET CLIENT - REAL-TIME UPDATES
 * ============================================================================
 * 
 * WebSocket client for real-time order status updates
 * Replaces polling with WebSocket connections
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

type WebSocketMessage = {
  type: 'order_status_update' | 'pharmacy_broadcast' | 'meal_order_update' | 'delivery_update' | 'notification';
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
  private connectionId: string | null = null;

  constructor(apiBaseUrl: string, userId: string, userType: 'customer' | 'vendor') {
    // Convert HTTP API URL to WebSocket URL
    const wsUrl = apiBaseUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    this.url = `${wsUrl}/ws?userId=${userId}&userType=${userType}`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }

    if (this.isConnecting) {
      return Promise.resolve();
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WebSocket] Connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.handleMessage(message);
          } catch (error) {
            console.error('[WebSocket] Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WebSocket] Error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[WebSocket] Disconnected');
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

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.handlers.clear();
  }

  /**
   * Subscribe to a specific message type
   */
  on(messageType: string, handler: MessageHandler): () => void {
    if (!this.handlers.has(messageType)) {
      this.handlers.set(messageType, new Set());
    }
    this.handlers.get(messageType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.handlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.handlers.delete(messageType);
        }
      }
    };
  }

  /**
   * Subscribe to order status updates
   */
  onOrderUpdate(orderId: string, handler: (data: any) => void): () => void {
    return this.on('order_status_update', (message) => {
      if (message.data.orderId === orderId) {
        handler(message.data);
      }
    });
  }

  /**
   * Subscribe to pharmacy broadcast updates
   */
  onPharmacyBroadcast(handler: (data: any) => void): () => void {
    return this.on('pharmacy_broadcast', (message) => {
      handler(message.data);
    });
  }

  /**
   * Subscribe to delivery updates
   */
  onDeliveryUpdate(orderId: string, handler: (data: any) => void): () => void {
    return this.on('delivery_update', (message) => {
      if (message.data.orderId === orderId) {
        handler(message.data);
      }
    });
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    // Call all handlers for this message type
    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => handler(message));
    }

    // Also call 'all' handlers
    const allHandlers = this.handlers.get('all');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(message));
    }
  }

  /**
   * Attempt to reconnect
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(() => {
        // Reconnection will be attempted again on next close
      });
    }, delay);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Send message to server
   */
  send(message: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('[WebSocket] Cannot send message: not connected');
    }
  }
}

// Export singleton instance factory
let wsClientInstance: WebSocketClient | null = null;

export function createWebSocketClient(
  apiBaseUrl: string,
  userId: string,
  userType: 'customer' | 'vendor'
): WebSocketClient {
  if (!wsClientInstance) {
    wsClientInstance = new WebSocketClient(apiBaseUrl, userId, userType);
  }
  return wsClientInstance;
}

export function getWebSocketClient(): WebSocketClient | null {
  return wsClientInstance;
}

export function disconnectWebSocket(): void {
  if (wsClientInstance) {
    wsClientInstance.disconnect();
    wsClientInstance = null;
  }
}

export default WebSocketClient;

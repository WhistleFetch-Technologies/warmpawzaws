/**
 * ============================================================================
 * WEBSOCKET SERVICE - REAL-TIME UPDATES
 * ============================================================================
 * 
 * WebSocket service for real-time order status updates
 * Replaces polling with WebSocket connections
 * 
 * Uses AWS API Gateway WebSocket API
 * 
 * Date: 2026-01-XX
 * ============================================================================
 */

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { query, insert, select } from '../../database/rds-connection';

// ============================================================================
// CONFIGURATION
// ============================================================================

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const WEBSOCKET_API_ENDPOINT = process.env.WEBSOCKET_API_ENDPOINT || '';

// ============================================================================
// TYPES
// ============================================================================

export interface WebSocketMessage {
  type: 'order_status_update' | 'pharmacy_broadcast' | 'meal_order_update' | 'delivery_update' | 'notification';
  data: any;
  timestamp: string;
}

export interface ConnectionInfo {
  connectionId: string;
  userId: string;
  userType: 'customer' | 'vendor' | 'admin' | 'staff';
  orderIds?: string[];
  createdAt: string;
}

// ============================================================================
// WEBSOCKET SERVICE
// ============================================================================

class WebSocketServiceImpl {
  private apiGatewayClient: ApiGatewayManagementApiClient | null = null;

  constructor() {
    if (WEBSOCKET_API_ENDPOINT) {
      this.apiGatewayClient = new ApiGatewayManagementApiClient({
        region: AWS_REGION,
        endpoint: WEBSOCKET_API_ENDPOINT,
      });
    }
  }

  /**
   * Register a WebSocket connection
   */
  async registerConnection(
    connectionId: string,
    userId: string,
    userType: 'customer' | 'vendor' | 'admin' | 'staff',
    orderIds?: string[]
  ): Promise<boolean> {
    try {
      await insert('websocket_connections', {
        connection_id: connectionId,
        user_id: userId,
        user_type: userType,
        order_ids: orderIds ? JSON.stringify(orderIds) : null,
        is_active: true,
        created_at: new Date().toISOString(),
        last_ping_at: new Date().toISOString(),
      });
      return true;
    } catch (error) {
      console.error('Error registering WebSocket connection:', error);
      return false;
    }
  }

  /**
   * Unregister a WebSocket connection
   */
  async unregisterConnection(connectionId: string): Promise<boolean> {
    try {
      await query(
        `UPDATE websocket_connections 
         SET is_active = false, disconnected_at = NOW() 
         WHERE connection_id = $1`,
        [connectionId]
      );
      return true;
    } catch (error) {
      console.error('Error unregistering WebSocket connection:', error);
      return false;
    }
  }

  /**
   * Send message to a specific connection
   */
  async sendToConnection(connectionId: string, message: WebSocketMessage): Promise<boolean> {
    if (!this.apiGatewayClient) {
      console.log('[WebSocket Mock] Would send:', message);
      return true;
    }

    try {
      await this.apiGatewayClient.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(message),
      }));
      return true;
    } catch (error: any) {
      // Connection may have been closed
      if (error.statusCode === 410) {
        await this.unregisterConnection(connectionId);
      }
      console.error('Error sending WebSocket message:', error);
      return false;
    }
  }

  /**
   * Send message to user (all their connections)
   */
  async sendToUser(
    userId: string,
    userType: 'customer' | 'vendor' | 'admin' | 'staff',
    message: WebSocketMessage
  ): Promise<{ success: number; failed: number }> {
    try {
      const connections = await query(
        `SELECT connection_id FROM websocket_connections 
         WHERE user_id = $1 AND user_type = $2 AND is_active = true`,
        [userId, userType]
      );

      const results = await Promise.all(
        (connections as any).rows.map((row: any) =>
          this.sendToConnection(row.connection_id, message)
        )
      );

      return {
        success: results.filter(r => r).length,
        failed: results.filter(r => !r).length,
      };
    } catch (error) {
      console.error('Error sending to user:', error);
      return { success: 0, failed: 0 };
    }
  }

  /**
   * Send order status update
   */
  async sendOrderStatusUpdate(
    orderId: string,
    orderType: 'pharmacy' | 'meal',
    status: string,
    data?: any
  ): Promise<boolean> {
    try {
      // Get order details
      let order: any;
      if (orderType === 'pharmacy') {
        const orders = await select('pharmacy_orders', { id: orderId });
        order = orders[0];
      } else {
        const orders = await query(
          `SELECT * FROM orders WHERE id = $1 AND (order_type = 'meal_plan_delivery' OR order_type = 'nutrition_delivery')`,
          [orderId]
        );
        order = (orders as any).rows[0];
      }

      if (!order) return false;

      // Send to customer
      await this.sendToUser(
        order.customer_id,
        'customer',
        {
          type: orderType === 'pharmacy' ? 'pharmacy_broadcast' : 'meal_order_update',
          data: {
            orderId,
            status,
            orderType,
            ...data,
          },
          timestamp: new Date().toISOString(),
        }
      );

      // Send to vendor if order is accepted
      if (order.vendor_id || order.pharmacy_id) {
        await this.sendToUser(
          order.vendor_id || order.pharmacy_id,
          'vendor',
          {
            type: orderType === 'pharmacy' ? 'pharmacy_broadcast' : 'meal_order_update',
            data: {
              orderId,
              status,
              orderType,
              ...data,
            },
            timestamp: new Date().toISOString(),
          }
        );
      }

      return true;
    } catch (error) {
      console.error('Error sending order status update:', error);
      return false;
    }
  }

  /**
   * Broadcast pharmacy order to nearby pharmacies
   */
  async broadcastPharmacyOrder(
    orderId: string,
    pharmacyIds: string[],
    orderData: any
  ): Promise<{ success: number; failed: number }> {
    const message: WebSocketMessage = {
      type: 'pharmacy_broadcast',
      data: {
        orderId,
        ...orderData,
      },
      timestamp: new Date().toISOString(),
    };

    const results = await Promise.all(
      pharmacyIds.map(pharmacyId =>
        this.sendToUser(pharmacyId, 'vendor', message)
      )
    );

    return {
      success: results.reduce((sum, r) => sum + r.success, 0),
      failed: results.reduce((sum, r) => sum + r.failed, 0),
    };
  }

  /**
   * Send delivery tracking update
   */
  async sendDeliveryUpdate(
    orderId: string,
    trackingData: {
      status: string;
      location?: { lat: number; lng: number };
      eta?: number;
      deliveryPartner?: string;
    }
  ): Promise<boolean> {
    try {
      // Get order to find customer
      const orders = await query(
        `SELECT customer_id FROM orders WHERE id = $1 
         UNION 
         SELECT customer_id FROM pharmacy_orders WHERE id = $1`,
        [orderId]
      );

      const order = (orders as any).rows[0];
      if (!order) return false;

      await this.sendToUser(
        order.customer_id,
        'customer',
        {
          type: 'delivery_update',
          data: {
            orderId,
            ...trackingData,
          },
          timestamp: new Date().toISOString(),
        }
      );

      return true;
    } catch (error) {
      console.error('Error sending delivery update:', error);
      return false;
    }
  }

  /**
   * Ping connection to keep it alive
   */
  async pingConnection(connectionId: string): Promise<boolean> {
    return await this.sendToConnection(connectionId, {
      type: 'notification',
      data: { action: 'ping' },
      timestamp: new Date().toISOString(),
    });
  }
}

// Export singleton
export const websocketService = new WebSocketServiceImpl();

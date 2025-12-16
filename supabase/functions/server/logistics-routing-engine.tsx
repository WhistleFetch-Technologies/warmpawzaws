/**
 * Logistics Routing Engine for Warmpawz
 * Routes orders to appropriate logistics partners based on delivery rules
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';
import { createShiprocketOrder, getAvailableCouriers as getShiprocketCouriers } from './shiprocket-integration.tsx';
import { createDelhiveryShipment, checkDelhiveryServiceability } from './delhivery-integration.tsx';

// Delivery rule types
export interface DeliveryRule {
  id: string;
  name: string;
  priority: number; // Lower = higher priority
  enabled: boolean;
  conditions: {
    orderType?: ('food' | 'subscription' | 'ecommerce' | 'pharmacy' | 'fresh')[];
    productCategories?: string[];
    deliveryType?: ('hyperlocal' | 'intracity' | 'intercity' | 'pan_india')[];
    regions?: string[]; // Cities/states
    weightRange?: { min: number; max: number }; // in kg
    valueRange?: { min: number; max: number }; // in rupees
    paymentMethod?: ('cod' | 'prepaid')[];
    urgency?: ('instant' | 'same_day' | 'standard' | 'economy')[];
    distanceRange?: { min: number; max: number }; // in km
  };
  logistics: {
    primaryPartner: string; // Partner ID
    fallbackPartners: string[];
    courierPreference?: string[]; // Specific courier IDs if applicable
  };
}

// Order input for routing
export interface OrderRoutingInput {
  orderId: string;
  orderType: string;
  productCategories: string[];
  totalAmount: number;
  totalWeight: number;
  paymentMethod: string;
  urgency?: string;
  pickupAddress: {
    city: string;
    state: string;
    pincode: string;
    coordinates?: { lat: number; lng: number };
  };
  deliveryAddress: {
    city: string;
    state: string;
    pincode: string;
    coordinates?: { lat: number; lng: number };
  };
}

/**
 * Calculate distance between two coordinates (in km)
 */
function calculateDistance(
  lat1: number, 
  lon1: number, 
  lat2: number, 
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/**
 * Determine delivery type based on distance and cities
 */
function determineDeliveryType(order: OrderRoutingInput, distance?: number): string {
  // If coordinates available, use distance
  if (distance !== undefined) {
    if (distance < 10) return 'hyperlocal';
    if (distance < 50) return 'intracity';
    if (distance < 500) return 'intercity';
    return 'pan_india';
  }

  // Fallback to city comparison
  if (order.pickupAddress.city === order.deliveryAddress.city) {
    return 'intracity';
  }
  if (order.pickupAddress.state === order.deliveryAddress.state) {
    return 'intercity';
  }
  return 'pan_india';
}

/**
 * Check if order matches rule conditions
 */
function matchesConditions(order: OrderRoutingInput, rule: DeliveryRule, deliveryType: string, distance?: number): boolean {
  const { conditions } = rule;

  // Check order type
  if (conditions.orderType && !conditions.orderType.includes(order.orderType as any)) {
    return false;
  }

  // Check product categories
  if (conditions.productCategories && conditions.productCategories.length > 0) {
    const hasMatch = order.productCategories.some(cat => 
      conditions.productCategories!.includes(cat)
    );
    if (!hasMatch) return false;
  }

  // Check delivery type
  if (conditions.deliveryType && !conditions.deliveryType.includes(deliveryType as any)) {
    return false;
  }

  // Check regions
  if (conditions.regions && conditions.regions.length > 0) {
    const deliveryCity = order.deliveryAddress.city.toLowerCase();
    const hasRegion = conditions.regions.some(r => 
      deliveryCity.includes(r.toLowerCase()) || r.toLowerCase().includes(deliveryCity)
    );
    if (!hasRegion) return false;
  }

  // Check weight range
  if (conditions.weightRange) {
    if (order.totalWeight < conditions.weightRange.min || 
        order.totalWeight > conditions.weightRange.max) {
      return false;
    }
  }

  // Check value range
  if (conditions.valueRange) {
    if (order.totalAmount < conditions.valueRange.min || 
        order.totalAmount > conditions.valueRange.max) {
      return false;
    }
  }

  // Check payment method
  if (conditions.paymentMethod && !conditions.paymentMethod.includes(order.paymentMethod as any)) {
    return false;
  }

  // Check urgency
  if (conditions.urgency && order.urgency && !conditions.urgency.includes(order.urgency as any)) {
    return false;
  }

  // Check distance range
  if (conditions.distanceRange && distance !== undefined) {
    if (distance < conditions.distanceRange.min || 
        distance > conditions.distanceRange.max) {
      return false;
    }
  }

  return true;
}

/**
 * Find best logistics partner for an order
 */
export async function findBestLogisticsPartner(order: OrderRoutingInput): Promise<{
  partner: string;
  deliveryType: string;
  estimatedCost?: number;
  eta?: string;
  courierInfo?: any;
}> {
  try {
    // Get all delivery rules
    const rules: DeliveryRule[] = await kv.get('admin:settings:delivery_rules') || [];
    const activeRules = rules.filter(r => r.enabled).sort((a, b) => a.priority - b.priority);

    // Calculate distance if coordinates available
    let distance: number | undefined;
    if (order.pickupAddress.coordinates && order.deliveryAddress.coordinates) {
      distance = calculateDistance(
        order.pickupAddress.coordinates.lat,
        order.pickupAddress.coordinates.lng,
        order.deliveryAddress.coordinates.lat,
        order.deliveryAddress.coordinates.lng
      );
    }

    // Determine delivery type
    const deliveryType = determineDeliveryType(order, distance);

    // Find matching rule
    for (const rule of activeRules) {
      if (matchesConditions(order, rule, deliveryType, distance)) {
        console.log(`✅ Order ${order.orderId} matched rule: ${rule.name}`);
        
        // Try primary partner
        const partner = rule.logistics.primaryPartner;
        
        return {
          partner,
          deliveryType,
          estimatedCost: undefined, // Will be calculated by specific partner
          eta: undefined
        };
      }
    }

    // Default fallback: Use shiprocket for ecommerce, delhivery for COD
    console.log(`⚠️ No matching rule for order ${order.orderId}, using default`);
    
    if (order.paymentMethod === 'cod') {
      return { partner: 'delhivery', deliveryType };
    } else {
      return { partner: 'shiprocket', deliveryType };
    }
  } catch (error) {
    console.error('Error finding logistics partner:', error);
    throw error;
  }
}

/**
 * Create shipment with selected partner
 */
export async function createShipmentWithPartner(
  partnerId: string,
  orderData: any
): Promise<any> {
  try {
    console.log(`📦 Creating shipment with ${partnerId} for order ${orderData.orderId}`);

    switch (partnerId) {
      case 'shiprocket':
        return await createShiprocketOrder(orderData);
      
      case 'delhivery':
        return await createDelhiveryShipment(orderData);
      
      case 'hyperlocal_partner':
        // Placeholder for future hyperlocal integration
        return {
          success: true,
          shipmentId: `HYPER_${Date.now()}`,
          awb: `HYP${Math.floor(Math.random() * 1000000)}`,
          status: 'PENDING_PICKUP',
          message: 'Hyperlocal partner integration pending'
        };
      
      default:
        throw new Error(`Unknown logistics partner: ${partnerId}`);
    }
  } catch (error) {
    console.error(`Error creating shipment with ${partnerId}:`, error);
    throw error;
  }
}

/**
 * Track shipment across all partners
 */
export async function trackUniversalShipment(trackingId: string, partnerId?: string): Promise<any> {
  try {
    // If partner not specified, try to find from stored shipments
    if (!partnerId) {
      const shipment = await kv.get(`shipment:${trackingId}`);
      if (shipment) {
        partnerId = shipment.partner;
      }
    }

    if (!partnerId) {
      throw new Error('Partner ID required for tracking');
    }

    // Route to appropriate tracking API
    // Implementation would call specific partner tracking APIs
    return {
      trackingId,
      partner: partnerId,
      status: 'IN_TRANSIT',
      events: [
        {
          timestamp: new Date().toISOString(),
          status: 'ORDER_CREATED',
          location: 'Origin'
        }
      ]
    };
  } catch (error) {
    console.error('Error tracking shipment:', error);
    throw error;
  }
}

/**
 * Register Logistics Routing Endpoints
 */
export function registerLogisticsRoutingEndpoints(app: Hono) {
  
  /**
   * POST /logistics/route-order
   * Find best logistics partner for an order
   */
  app.post('/make-server-3dd53475/logistics/route-order', async (c) => {
    try {
      const order: OrderRoutingInput = await c.req.json();
      const result = await findBestLogisticsPartner(order);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error routing order:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/create-shipment
   * Create shipment with best partner
   */
  app.post('/make-server-3dd53475/logistics/create-shipment', async (c) => {
    try {
      const { order, partnerId } = await c.req.json();
      
      // Find best partner if not specified
      let selectedPartner = partnerId;
      if (!selectedPartner) {
        const routing = await findBestLogisticsPartner(order);
        selectedPartner = routing.partner;
      }
      
      const result = await createShipmentWithPartner(selectedPartner, order);
      
      // Store shipment info
      await kv.set(`shipment:${result.shipmentId || result.order_id}`, {
        orderId: order.orderId,
        partner: selectedPartner,
        trackingId: result.awb || result.waybill,
        createdAt: new Date().toISOString()
      });
      
      return c.json({
        success: true,
        data: result,
        partner: selectedPartner
      });
    } catch (error: any) {
      console.error('Error creating shipment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET /logistics/track/:trackingId
   * Universal tracking endpoint
   */
  app.get('/make-server-3dd53475/logistics/track/:trackingId', async (c) => {
    try {
      const trackingId = c.req.param('trackingId');
      const partnerId = c.req.query('partner');
      
      const result = await trackUniversalShipment(trackingId, partnerId);
      
      return c.json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error tracking shipment:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * GET/POST /logistics/delivery-rules
   * Manage delivery rules
   */
  app.get('/make-server-3dd53475/logistics/delivery-rules', async (c) => {
    try {
      const rules = await kv.get('admin:settings:delivery_rules') || [];
      return c.json({ success: true, rules });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  app.post('/make-server-3dd53475/logistics/delivery-rules', async (c) => {
    try {
      const rules: DeliveryRule[] = await c.req.json();
      await kv.set('admin:settings:delivery_rules', rules);
      return c.json({ success: true });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  /**
   * POST /logistics/test-routing
   * Test which partner would be selected for given order parameters
   */
  app.post('/make-server-3dd53475/logistics/test-routing', async (c) => {
    try {
      const order: OrderRoutingInput = await c.req.json();
      const result = await findBestLogisticsPartner(order);
      
      // Also fetch all rules to show matching logic
      const rules: DeliveryRule[] = await kv.get('admin:settings:delivery_rules') || [];
      
      return c.json({
        success: true,
        selectedPartner: result,
        allRules: rules.map(r => ({
          id: r.id,
          name: r.name,
          priority: r.priority,
          enabled: r.enabled
        }))
      });
    } catch (error: any) {
      return c.json({ error: error.message }, 500);
    }
  });

  console.log('✅ Logistics routing endpoints registered');
}

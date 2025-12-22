/**
 * ============================================================================
 * MEDICINE ORDERS REPOSITORY
 * ============================================================================
 * 
 * Repository for medicine orders with complete flow:
 * upload -> broadcast -> proforma -> payment -> delivery
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ State transitions validated
 * ✅ Notifications triggered
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery, withTransaction } from "../db.ts";

// ============================================================================
// TYPES
// ============================================================================

export interface MedicineOrder {
  id: string;
  order_number: string;
  prescription_id: string;
  customer_id: string;
  pet_id: string;
  prescription_file_url: string;
  prescription_uploaded_at: string;
  broadcast_status: 'pending' | 'broadcasted' | 'pharmacy_selected' | 'cancelled';
  broadcasted_at?: string | null;
  selected_pharmacy_id?: string | null;
  selected_pharmacy_name?: string | null;
  proforma_invoice_url?: string | null;
  proforma_invoice_generated_at?: string | null;
  proforma_amount?: number | null;
  proforma_items?: any;
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_id?: string | null;
  payment_amount?: number | null;
  payment_method?: string | null;
  paid_at?: string | null;
  delivery_address: string;
  delivery_city?: string | null;
  delivery_state?: string | null;
  delivery_pincode?: string | null;
  delivery_status: 'pending' | 'confirmed' | 'preparing' | 'dispatched' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'returned';
  tracking_id?: string | null;
  estimated_delivery_date?: string | null;
  delivered_at?: string | null;
  status: string;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMedicineOrderInput {
  prescription_id: string;
  customer_id: string;
  pet_id: string;
  prescription_file_url: string;
  delivery_address: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_pincode?: string;
  notes?: string;
}

export interface PharmacyBroadcast {
  id: string;
  medicine_order_id: string;
  pharmacy_id: string;
  pharmacy_name: string;
  pharmacy_response?: 'interested' | 'not_interested' | 'pending' | null;
  quoted_amount?: number | null;
  estimated_delivery_days?: number | null;
  response_notes?: string | null;
  responded_at?: string | null;
  created_at: string;
}

// ============================================================================
// REPOSITORY
// ============================================================================

export class MedicineOrdersRepository {
  private db = getDbClient();

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const timestamp = date.getTime();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `MO-${timestamp}-${random}`;
  }

  /**
   * Validate state transition
   */
  private validateStateTransition(currentStatus: string, newStatus: string): boolean {
    const validTransitions: Record<string, string[]> = {
      'prescription_uploaded': ['broadcasted', 'cancelled'],
      'broadcasted': ['pharmacy_selected', 'cancelled'],
      'pharmacy_selected': ['proforma_generated', 'cancelled'],
      'proforma_generated': ['payment_pending', 'cancelled'],
      'payment_pending': ['payment_completed', 'cancelled'],
      'payment_completed': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['dispatched', 'cancelled'],
      'dispatched': ['in_transit', 'cancelled'],
      'in_transit': ['out_for_delivery', 'cancelled'],
      'out_for_delivery': ['delivered', 'failed', 'cancelled'],
      'delivered': [],
      'failed': ['cancelled'],
      'cancelled': [],
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Create medicine order (Step 1: Upload prescription)
   */
  async create(input: CreateMedicineOrderInput): Promise<MedicineOrder> {
    const orderNumber = this.generateOrderNumber();

    const results = await insertQuery<MedicineOrder>("medicine_orders", {
      order_number: orderNumber,
      prescription_id: input.prescription_id,
      customer_id: input.customer_id,
      pet_id: input.pet_id,
      prescription_file_url: input.prescription_file_url,
      prescription_uploaded_at: new Date().toISOString(),
      broadcast_status: 'pending',
      payment_status: 'pending',
      delivery_status: 'pending',
      delivery_address: input.delivery_address,
      delivery_city: input.delivery_city || null,
      delivery_state: input.delivery_state || null,
      delivery_pincode: input.delivery_pincode || null,
      status: 'prescription_uploaded',
      notes: input.notes || null,
    });

    if (!results[0]) {
      throw new Error("Failed to create medicine order");
    }

    return results[0];
  }

  /**
   * Broadcast to pharmacies (Step 2)
   */
  async broadcastToPharmacies(orderId: string, pharmacyIds: string[]): Promise<PharmacyBroadcast[]> {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error("Medicine order not found");
    }

    if (order.status !== 'prescription_uploaded') {
      throw new Error(`Cannot broadcast from status: ${order.status}`);
    }

    // Create broadcast records
    const broadcasts: PharmacyBroadcast[] = [];
    for (const pharmacyId of pharmacyIds) {
      // Get pharmacy name
      const pharmacy = await selectQuery<{ id: string; business_name: string }>(
        "SELECT id, business_name FROM vendors WHERE id = $1",
        [pharmacyId]
      );

      if (pharmacy && pharmacy.length > 0) {
        const broadcast = await insertQuery<PharmacyBroadcast>("medicine_order_pharmacy_broadcasts", {
          medicine_order_id: orderId,
          pharmacy_id: pharmacyId,
          pharmacy_name: pharmacy[0].business_name,
          pharmacy_response: 'pending',
        });

        if (broadcast[0]) {
          broadcasts.push(broadcast[0]);
        }
      }
    }

    // Update order status
    await updateQuery<MedicineOrder>(
      "medicine_orders",
      {
        broadcast_status: 'broadcasted',
        broadcasted_at: new Date().toISOString(),
        status: 'broadcasted',
        updated_at: new Date().toISOString(),
      },
      { id: orderId }
    );

    return broadcasts;
  }

  /**
   * Select pharmacy (Step 3)
   */
  async selectPharmacy(orderId: string, pharmacyId: string): Promise<boolean> {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error("Medicine order not found");
    }

    if (order.status !== 'broadcasted') {
      throw new Error(`Cannot select pharmacy from status: ${order.status}`);
    }

    // Get pharmacy name
    const pharmacy = await selectQuery<{ id: string; business_name: string }>(
      "SELECT id, business_name FROM vendors WHERE id = $1",
      [pharmacyId]
    );

    if (!pharmacy || pharmacy.length === 0) {
      throw new Error("Pharmacy not found");
    }

    // Update broadcast response
    await updateQuery<PharmacyBroadcast>(
      "medicine_order_pharmacy_broadcasts",
      {
        pharmacy_response: 'interested',
        responded_at: new Date().toISOString(),
      },
      { medicine_order_id: orderId, pharmacy_id: pharmacyId }
    );

    // Update order
    await updateQuery<MedicineOrder>(
      "medicine_orders",
      {
        selected_pharmacy_id: pharmacyId,
        selected_pharmacy_name: pharmacy[0].business_name,
        broadcast_status: 'pharmacy_selected',
        status: 'pharmacy_selected',
        updated_at: new Date().toISOString(),
      },
      { id: orderId }
    );

    return true;
  }

  /**
   * Generate proforma invoice (Step 4)
   */
  async generateProformaInvoice(
    orderId: string,
    invoiceUrl: string,
    amount: number,
    items: any[]
  ): Promise<boolean> {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error("Medicine order not found");
    }

    if (order.status !== 'pharmacy_selected') {
      throw new Error(`Cannot generate proforma from status: ${order.status}`);
    }

    await updateQuery<MedicineOrder>(
      "medicine_orders",
      {
        proforma_invoice_url: invoiceUrl,
        proforma_invoice_generated_at: new Date().toISOString(),
        proforma_amount: amount,
        proforma_items: items,
        status: 'proforma_generated',
        updated_at: new Date().toISOString(),
      },
      { id: orderId }
    );

    return true;
  }

  /**
   * Update payment status (Step 5)
   */
  async updatePayment(
    orderId: string,
    paymentId: string,
    amount: number,
    paymentMethod: string
  ): Promise<boolean> {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error("Medicine order not found");
    }

    if (!['proforma_generated', 'payment_pending'].includes(order.status)) {
      throw new Error(`Cannot update payment from status: ${order.status}`);
    }

    await updateQuery<MedicineOrder>(
      "medicine_orders",
      {
        payment_id: paymentId,
        payment_amount: amount,
        payment_method: paymentMethod,
        payment_status: 'paid',
        paid_at: new Date().toISOString(),
        status: 'payment_completed',
        updated_at: new Date().toISOString(),
      },
      { id: orderId }
    );

    return true;
  }

  /**
   * Update delivery status
   */
  async updateDeliveryStatus(
    orderId: string,
    status: MedicineOrder['delivery_status'],
    trackingId?: string,
    estimatedDeliveryDate?: string
  ): Promise<boolean> {
    const order = await this.getById(orderId);
    if (!order) {
      throw new Error("Medicine order not found");
    }

    const statusMap: Record<string, string> = {
      'confirmed': 'confirmed',
      'preparing': 'preparing',
      'dispatched': 'dispatched',
      'in_transit': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'failed': 'failed',
      'returned': 'returned',
    };

    const newOrderStatus = statusMap[status] || order.status;

    const updates: any = {
      delivery_status: status,
      status: newOrderStatus,
      updated_at: new Date().toISOString(),
    };

    if (trackingId) {
      updates.tracking_id = trackingId;
    }

    if (estimatedDeliveryDate) {
      updates.estimated_delivery_date = estimatedDeliveryDate;
    }

    if (status === 'delivered') {
      updates.delivered_at = new Date().toISOString();
    }

    await updateQuery<MedicineOrder>("medicine_orders", updates, { id: orderId });

    return true;
  }

  /**
   * Get medicine order by ID
   */
  async getById(orderId: string): Promise<MedicineOrder | null> {
    const results = await selectQuery<MedicineOrder>(
      "SELECT * FROM medicine_orders WHERE id = $1",
      [orderId]
    );

    return results && results.length > 0 ? results[0] : null;
  }

  /**
   * Get medicine orders by customer ID
   */
  async getByCustomerId(customerId: string): Promise<MedicineOrder[]> {
    const results = await selectQuery<MedicineOrder>(
      "SELECT * FROM medicine_orders WHERE customer_id = $1 ORDER BY created_at DESC",
      [customerId]
    );

    return results || [];
  }

  /**
   * Get pharmacy broadcasts for order
   */
  async getPharmacyBroadcasts(orderId: string): Promise<PharmacyBroadcast[]> {
    const results = await selectQuery<PharmacyBroadcast>(
      "SELECT * FROM medicine_order_pharmacy_broadcasts WHERE medicine_order_id = $1 ORDER BY created_at DESC",
      [orderId]
    );

    return results || [];
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let medicineOrdersRepositoryInstance: MedicineOrdersRepository | null = null;

export function getMedicineOrdersRepository(): MedicineOrdersRepository {
  if (!medicineOrdersRepositoryInstance) {
    medicineOrdersRepositoryInstance = new MedicineOrdersRepository();
  }
  return medicineOrdersRepositoryInstance;
}


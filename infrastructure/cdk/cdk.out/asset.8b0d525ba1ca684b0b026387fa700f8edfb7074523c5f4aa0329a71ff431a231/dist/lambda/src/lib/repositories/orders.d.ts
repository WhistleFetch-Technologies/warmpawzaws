/**
 * ============================================================================
 * ORDERS REPOSITORY
 * ============================================================================
 *
 * Repository for order data access.
 * Replaces: order:{orderId} KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Order {
    id: string;
    customer_id: string;
    vendor_id?: string | null;
    order_number: string;
    order_status: string;
    subtotal: number;
    tax_amount: number;
    shipping_amount: number;
    discount_amount: number;
    total_amount: number;
    shipping_address: string;
    shipping_city: string;
    shipping_state: string;
    shipping_pincode: string;
    shipping_phone: string;
    payment_id?: string | null;
    payment_status: string;
    created_at: string;
    updated_at: string;
    shipped_at?: string | null;
    delivered_at?: string | null;
    cancelled_at?: string | null;
}
export interface CreateOrderInput {
    customer_id: string;
    vendor_id?: string;
    order_number: string;
    subtotal: number;
    tax_amount?: number;
    shipping_amount?: number;
    discount_amount?: number;
    total_amount: number;
    shipping_address: string;
    shipping_city: string;
    shipping_state: string;
    shipping_pincode: string;
    shipping_phone: string;
}
export declare class OrdersRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(orderId: string): Promise<Order | null>;
    findByOrderNumber(orderNumber: string): Promise<Order | null>;
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Order[]>;
    create(input: CreateOrderInput): Promise<Order>;
    update(orderId: string, input: Partial<CreateOrderInput & {
        order_status?: string;
        payment_status?: string;
    }>): Promise<Order>;
}
export declare function getOrdersRepository(): OrdersRepository;
//# sourceMappingURL=orders.d.ts.map
/**
 * Schema for public.return_requests
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:21:18.337Z
 */

export const return_requestsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (vendor_id IS NOT NULL) CHECK (customer_id IS NOT NULL) CHECK (order_id IS NOT NULL) CHECK (id IS NOT NULL)',
  order_id: 'uuid NOT NULL CHECK (order_id IS NOT NULL)', // REFERENCES orders(id),
  customer_id: 'uuid NOT NULL CHECK (customer_id IS NOT NULL)', // REFERENCES customers(id),
  vendor_id: 'uuid NOT NULL CHECK (vendor_id IS NOT NULL)', // REFERENCES vendors(id),
  reason: 'text NOT NULL CHECK (reason IS NOT NULL) CHECK (((reason_category = ANY (ARRAY['damaged'::text, 'wrong_item'::text, 'not_as_described'::text, 'defective'::text, 'other'::text]))))',
  reason_category: 'text CHECK (((reason_category = ANY (ARRAY['damaged'::text, 'wrong_item'::text, 'not_as_described'::text, 'defective'::text, 'other'::text]))))',
  description: 'text',
  request_type: 'text DEFAULT 'return' CHECK (((request_type = ANY (ARRAY['return'::text, 'exchange'::text]))))',
  exchange_product_id: 'uuid', // REFERENCES products(id),
  item_ids: 'text[] DEFAULT '{}'',
  quantity: 'integer DEFAULT 1',
  amount: 'numeric(10,2) NOT NULL CHECK (amount IS NOT NULL)',
  images: 'text[] DEFAULT '{}'',
  photos: 'text[] DEFAULT '{}'',
  status: 'text NOT NULL DEFAULT 'pending' CHECK (status IS NOT NULL) CHECK (((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'picked_up'::text, 'refunded'::text, 'exchanged'::text]))))',
  return_method: 'text DEFAULT 'pickup' CHECK (((return_method = ANY (ARRAY['pickup'::text, 'drop'::text]))))',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  approved_at: 'timestamptz',
  rejected_at: 'timestamptz',
  refunded_at: 'timestamptz',
  refund_amount: 'numeric(10,2)',
  refund_method: 'text',
  rejection_reason: 'text',
  admin_notes: 'text'
};

/**
 * Foreign Keys:
 * - order_id -> public.orders.id
 * - customer_id -> public.customers.id
 * - vendor_id -> public.vendors.id
 * - exchange_product_id -> public.products.id
 */

/**
 * Indexes:
 * - idx_return_requests_created_at: CREATE INDEX idx_return_requests_created_at ON public.return_requests USING btree (created_at)
 * - idx_return_requests_customer_id: CREATE INDEX idx_return_requests_customer_id ON public.return_requests USING btree (customer_id)
 * - idx_return_requests_order_id: CREATE INDEX idx_return_requests_order_id ON public.return_requests USING btree (order_id)
 * - idx_return_requests_status: CREATE INDEX idx_return_requests_status ON public.return_requests USING btree (status)
 * - idx_return_requests_vendor_id: CREATE INDEX idx_return_requests_vendor_id ON public.return_requests USING btree (vendor_id)
 */

/**
 * Check Constraints:
 * - 2200_20227_4_not_null: vendor_id IS NOT NULL
 * - 2200_20227_12_not_null: amount IS NOT NULL
 * - 2200_20227_15_not_null: status IS NOT NULL
 * - return_requests_status_check: ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text, 'picked_up'::text, 'refunded'::text, 'exchanged'::text])))
 * - 2200_20227_3_not_null: customer_id IS NOT NULL
 * - return_requests_request_type_check: ((request_type = ANY (ARRAY['return'::text, 'exchange'::text])))
 * - 2200_20227_2_not_null: order_id IS NOT NULL
 * - 2200_20227_1_not_null: id IS NOT NULL
 * - 2200_20227_5_not_null: reason IS NOT NULL
 * - return_requests_reason_category_check: ((reason_category = ANY (ARRAY['damaged'::text, 'wrong_item'::text, 'not_as_described'::text, 'defective'::text, 'other'::text])))
 * - return_requests_return_method_check: ((return_method = ANY (ARRAY['pickup'::text, 'drop'::text])))
 */


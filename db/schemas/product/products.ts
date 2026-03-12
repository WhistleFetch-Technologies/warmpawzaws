/**
 * Schema for public.products
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:18:32.150Z
 */

export const productsSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  vendor_id: 'uuid', // REFERENCES vendors(id),
  category_id: 'uuid', // REFERENCES ecommerce_categories(id),
  name: 'text NOT NULL CHECK (name IS NOT NULL)',
  description: 'text',
  sku: 'text UNIQUE',
  price: 'numeric(10,2) NOT NULL CHECK (price IS NOT NULL)',
  stock: 'integer DEFAULT 0',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  compare_at_price: 'numeric(10,2)',
  cost_price: 'numeric(10,2)',
  min_stock: 'integer DEFAULT 0',
  subcategory: 'text',
  barcode: 'text',
  weight: 'numeric(10,2)',
  dimensions: 'text',
  images: 'jsonb DEFAULT '[]'',
  tags: 'jsonb DEFAULT '[]'',
  is_featured: 'boolean DEFAULT false',
  hsn_code: 'text',
  gst_rate: 'numeric(5,2)',
  category: 'text',
  status: 'text DEFAULT 'active' CHECK (((status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'inactive'::text, 'rejected'::text]))))'
};

/**
 * Foreign Keys:
 * - vendor_id -> public.vendors.id
 * - category_id -> public.ecommerce_categories.id
 */

/**
 * Indexes:
 * - products_sku_key: CREATE UNIQUE INDEX products_sku_key ON public.products USING btree (sku)
 */

/**
 * Check Constraints:
 * - 2200_17241_1_not_null: id IS NOT NULL
 * - 2200_17241_4_not_null: name IS NOT NULL
 * - 2200_17241_7_not_null: price IS NOT NULL
 * - products_status_check: ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'inactive'::text, 'rejected'::text])))
 */


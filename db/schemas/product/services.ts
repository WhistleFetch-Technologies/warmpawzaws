/**
 * Schema for public.services
 * Extracted from production RDS database
 * Generated: 2026-03-11T18:24:54.633Z
 */

export const servicesSchema = {
  id: 'uuid PRIMARY KEY DEFAULT gen_random_uuid() CHECK (id IS NOT NULL)',
  vendor_id: 'uuid', // REFERENCES vendors(id),
  name: 'text NOT NULL CHECK (name IS NOT NULL)',
  description: 'text',
  category: 'text NOT NULL CHECK (category IS NOT NULL)',
  price: 'numeric(10,2) NOT NULL CHECK (price IS NOT NULL)',
  duration_minutes: 'integer',
  is_active: 'boolean DEFAULT true',
  created_at: 'timestamptz DEFAULT now()',
  updated_at: 'timestamptz DEFAULT now()',
  gst_config_id: 'uuid', // REFERENCES gst_configs(id)
};

/**
 * Foreign Keys:
 * - vendor_id -> public.vendors.id
 * - gst_config_id -> public.gst_configs.id
 */

/**
 * Indexes:
 * - idx_services_category_active: CREATE INDEX idx_services_category_active ON public.services USING btree (category, is_active)
 * - idx_services_vendor_publish: CREATE INDEX idx_services_vendor_publish ON public.services USING btree (vendor_id, is_active)
 */

/**
 * Check Constraints:
 * - 2200_16605_1_not_null: id IS NOT NULL
 * - 2200_16605_3_not_null: name IS NOT NULL
 * - 2200_16605_5_not_null: category IS NOT NULL
 * - 2200_16605_6_not_null: price IS NOT NULL
 */


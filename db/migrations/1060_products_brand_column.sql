-- Ensure products.brand exists on prod/dev (legacy 210_ecommerce_enhancements may not have been applied).

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS brand TEXT;

COMMENT ON COLUMN products.brand IS 'Optional product brand name (vendor catalog / bulk upload)';

-- Hide lab-diagnostics from customer home tiles by marking it as a subcategory of vet
-- Idempotent: safe to re-run
UPDATE service_categories
SET show_on_customer_home = false
WHERE category_id IN ('lab-diagnostics', 'lab_diagnostics', 'diagnostics')
  AND show_on_customer_home IS DISTINCT FROM false;

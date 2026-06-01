-- Ensure meal order numbers are generated when application omits order_number (prod bootstrap 1018 skipped migration 200 triggers).

CREATE OR REPLACE FUNCTION generate_order_number(prefix TEXT)
RETURNS TEXT AS $$
DECLARE
    result TEXT;
BEGIN
    result := prefix || TO_CHAR(NOW(), 'YYMMDD') || LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    RETURN result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_meal_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number('ML');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_meal_order_number ON meal_orders;
CREATE TRIGGER trigger_meal_order_number
    BEFORE INSERT ON meal_orders
    FOR EACH ROW
    EXECUTE FUNCTION set_meal_order_number();

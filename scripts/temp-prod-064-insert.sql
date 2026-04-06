INSERT INTO loyalty_segments (segment_name, segment_type, description, criteria, match_type, priority) VALUES
('Medicine Buyers', 'customer', 'Customers who purchase medicines', '{"service_categories": ["Medicine"]}'::jsonb, 'any', 100),
('Grooming Service Users', 'customer', 'Customers who book grooming services', '{"service_categories": ["Grooming"]}'::jsonb, 'any', 100),
('Vet Consultation Users', 'customer', 'Customers who book vet consultations', '{"service_categories": ["Veterinary", "Consultation"]}'::jsonb, 'any', 100),
('Pet Food Buyers', 'customer', 'Customers who purchase pet food', '{"service_categories": ["Pet Food", "Food"]}'::jsonb, 'any', 100),
('Insurance Buyers', 'customer', 'Customers who purchase pet insurance', '{"service_categories": ["Insurance"]}'::jsonb, 'any', 100),
('Gold Tier Customers', 'customer', 'Gold tier loyalty customers', '{"customer_tiers": ["gold"]}'::jsonb, 'any', 150),
('Platinum Tier Customers', 'customer', 'Platinum tier loyalty customers', '{"customer_tiers": ["platinum"]}'::jsonb, 'any', 150),
('First Time Buyers', 'customer', 'Customers making their first purchase', '{"first_purchase": true}'::jsonb, 'all', 200),
('Birthday Month Customers', 'customer', 'Customers with pets having birthday this month', '{"birthday_month": true}'::jsonb, 'all', 200),
('Regular Customers', 'customer', 'Customers with 5+ purchases', '{"purchase_history": {"min_purchases": 5}}'::jsonb, 'all', 100),
('High Value Customers', 'customer', 'Customers with 10000+ lifetime spend', '{"purchase_history": {"min_amount": 10000}}'::jsonb, 'all', 150),
('Doorstep Service Users', 'customer', 'Customers who use doorstep services', '{"service_types": ["at_home"]}'::jsonb, 'any', 100),
('In-Clinic Service Users', 'customer', 'Customers who use in-clinic services', '{"service_types": ["at_vendor"]}'::jsonb, 'any', 100),
('Online Service Users', 'customer', 'Customers who use online services', '{"service_types": ["online"]}'::jsonb, 'any', 100)
ON CONFLICT (segment_name) DO NOTHING;

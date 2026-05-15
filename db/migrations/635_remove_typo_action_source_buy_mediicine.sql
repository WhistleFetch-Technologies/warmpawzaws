-- Remove mistaken action_sources row: typo "buy-mediicine" on /razorpay/verify-payment
-- duplicates book_vet_consultation (same predicate) and is not a valid loyalty_action_rules action_name.
-- Not created by migration 634 (634 uses buy_medicine + book_vet_consultation only).

DELETE FROM action_sources
WHERE method = 'POST'
  AND route_pattern = '/razorpay/verify-payment'
  AND action_name IN ('buy-mediicine', 'buy-medicine');

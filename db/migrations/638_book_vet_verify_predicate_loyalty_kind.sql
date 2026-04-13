-- 638: POST /razorpay/verify-payment → book_vet_consultation
-- Prior predicate: $.success && $.bookingId && $.loyaltyBookVetConsultationForPayment
-- That flag is true only when loyaltyBookingKind is vet_consultation AND service_type is tele-like.
-- If category or vendor_type resolves vet but service_type is missing or non-tele, the flag stays false
-- while loyaltyBookingKind can still be vet_consultation — no award.
-- New predicate keys off loyaltyBookingKind (always set on booking verify success path from DB joins).
-- Pharmacy verify: bookingId is null → second conjunct fails → no book_vet award.
-- Note: Broader than tele-only — any vet_consultation booking paid via this verify path matches.
--       Create-side rule still uses awardBookVetLoyaltyOnCreate to avoid double prepaid tele in normal flows.

UPDATE action_sources SET
  success_predicate = '$.success && $.bookingId && $.loyaltyBookingKind == ''vet_consultation''',
  notes = 'Razorpay verify booking paid — award when loyaltyBookingKind is vet_consultation [638]',
  updated_at = NOW()
WHERE method = 'POST'
  AND route_pattern = '/razorpay/verify-payment'
  AND action_name = 'book_vet_consultation';

-- ============================================================================
-- Migration 1129: Insurance vendor onboarding form
-- ============================================================================
-- One row in onboarding_forms for the canonical `insurance` role.
-- Idempotent: insert only when the role exists and the row does not.
-- ============================================================================

INSERT INTO onboarding_forms (role_id, fields, sections, status, version, created_at, updated_at)
SELECT
  'insurance',
  '[
    {"id":"legalName","fieldName":"legalName","label":"Legal name","type":"text","section":"business","isMandatory":true,"required":true,"placeholder":"","helpText":"Name on the licence","options":[],"validation":{"minLength":2,"maxLength":200},"displayOrder":1,"isActive":true},
    {"id":"tradeName","fieldName":"tradeName","label":"Trade name","type":"text","section":"business","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{"minLength":2,"maxLength":200},"displayOrder":2,"isActive":true},
    {"id":"entityType","fieldName":"entityType","label":"Entity type","type":"select","section":"business","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":["Individual","Partnership","Private limited","LLP"],"validation":{},"displayOrder":3,"isActive":true},
    {"id":"pan","fieldName":"pan","label":"PAN","type":"text","section":"business","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{"pattern":"^[A-Z]{5}[0-9]{4}[A-Z]$"},"displayOrder":4,"isActive":true},
    {"id":"gst","fieldName":"gst","label":"GST","type":"text","section":"business","isMandatory":false,"required":false,"placeholder":"","helpText":"Optional","options":[],"validation":{},"displayOrder":5,"isActive":true},
    {"id":"address","fieldName":"address","label":"Address","type":"textarea","section":"business","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":6,"isActive":true},
    {"id":"irdaiLicenceNumber","fieldName":"irdaiLicenceNumber","label":"IRDAI licence / registration number","type":"text","section":"licence","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":7,"isActive":true},
    {"id":"licenceType","fieldName":"licenceType","label":"Licence type","type":"radio","section":"licence","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":["POSP","Corporate agent","Broker","Web aggregator"],"validation":{},"displayOrder":8,"isActive":true},
    {"id":"licenceExpiry","fieldName":"licenceExpiry","label":"Licence expiry","type":"date","section":"licence","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":9,"isActive":true},
    {"id":"authorisedInsurers","fieldName":"authorisedInsurers","label":"Authorised insurers","type":"multiselect","section":"licence","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":["Bajaj Allianz","HDFC ERGO","ICICI Lombard","New India","Other"],"validation":{},"displayOrder":10,"isActive":true},
    {"id":"licenceDocument","fieldName":"licenceDocument","label":"Licence document","type":"file","section":"licence","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":11,"isActive":true},
    {"id":"principalOfficerName","fieldName":"principalOfficerName","label":"Principal officer name","type":"text","section":"team","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":12,"isActive":true},
    {"id":"principalOfficerPhone","fieldName":"principalOfficerPhone","label":"Principal officer phone","type":"phone","section":"team","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":13,"isActive":true},
    {"id":"principalOfficerEmail","fieldName":"principalOfficerEmail","label":"Principal officer email","type":"email","section":"team","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":14,"isActive":true},
    {"id":"advisorCount","fieldName":"advisorCount","label":"Number of advisors","type":"number","section":"team","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{"min":0,"max":10000},"displayOrder":15,"isActive":true},
    {"id":"accountHolder","fieldName":"accountHolder","label":"Account holder","type":"text","section":"bank","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":16,"isActive":true},
    {"id":"accountNumber","fieldName":"accountNumber","label":"Account number","type":"text","section":"bank","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":17,"isActive":true},
    {"id":"ifsc","fieldName":"ifsc","label":"IFSC","type":"text","section":"bank","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":18,"isActive":true},
    {"id":"cancelledCheque","fieldName":"cancelledCheque","label":"Cancelled cheque","type":"file","section":"bank","isMandatory":true,"required":true,"placeholder":"","helpText":"","options":[],"validation":{},"displayOrder":19,"isActive":true}
  ]'::jsonb,
  '[
    {"id":"business","title":"Business","order":1},
    {"id":"licence","title":"Licence","order":2},
    {"id":"team","title":"Team","order":3},
    {"id":"bank","title":"Bank","order":4}
  ]'::jsonb,
  'active',
  1,
  NOW(),
  NOW()
WHERE EXISTS (SELECT 1 FROM roles WHERE name = 'insurance' AND is_active = true)
  AND NOT EXISTS (SELECT 1 FROM onboarding_forms WHERE role_id = 'insurance');

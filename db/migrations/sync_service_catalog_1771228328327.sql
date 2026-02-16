-- ============================================================================
-- SERVICE CATALOG SYNC: DEV → PROD
-- ============================================================================
-- Generated: 2026-02-16T07:52:08.958Z
-- Missing records in PROD: 38
--
-- ⚠️  WARNING: REVIEW THIS SCRIPT BEFORE EXECUTION
-- ⚠️  This script will INSERT missing records from DEV to PROD
-- ⚠️  DO NOT execute without reviewing each INSERT statement
-- ⚠️  Check foreign key dependencies before running
--
-- STRICT RULES:
-- - Uses ON CONFLICT DO NOTHING to avoid duplicates
-- - Preserves IDs exactly as in DEV
-- - Wrapped in transaction for safety
-- - No updates, no deletes, only inserts
-- ============================================================================

BEGIN;

-- Service: Anal Glad Expression Manual
-- ID: 5043f1fb-ff9b-4a31-be53-9f053624c34e
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '499.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:41:06.401Z', 'Includes
Physical examination of anal glands
Manual expression of anal glands
Cleaning of gland area
Basic assessment of gland health', 'Anal Glad Expression Manual', 0, 15, '5043f1fb-ff9b-4a31-be53-9f053624c34e', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771119666396_nbg60yi7q', 'Anal Glad Expression Manual', 'at_center', ARRAY['medicine']::text[], 'active', '', '', '2026-02-15T01:41:06.401Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Anal Gland Expression (Medial Infected/Impacted)
-- ID: 6dc10043-1b4e-4b29-90f9-c00e3c0e1d26
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1499.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:45:06.235Z', 'Manual expression of anal glands to relieve discomfort, prevent infection, and restore normal gland function.
Infection treatment
Sedation (if aggressive dog)
Antibiotics
Pain medication
Abscess treatment

Excluded Services:
Surgery
Post Operative Medicines', 'Anal Gland Expression (Medial Infected/Impacted)', 0, 45, '6dc10043-1b4e-4b29-90f9-c00e3c0e1d26', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771119906228_eu4wsyv12', 'Anal Gland Expression (Medial Infected/Impacted)', 'at_center', ARRAY['medicine', 'surgery']::text[], 'active', '', '', '2026-02-15T01:45:06.235Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Cardiac Diagnostics (2D Echo + Doppler)
-- ID: d7b40436-45cb-4374-b11f-bb4e5b70f2ac
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['diagnostics_center', 'vet_clinic', 'vet_solo']::text[], '11000.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T05:30:42.804Z', 'Echo and Doppler- moving images of heart''s structure (2D) measurement of blood flow velocity and direction (Doppler)', 'Cardiac Diagnostics (2D Echo + Doppler)', 0, 45, 'd7b40436-45cb-4374-b11f-bb4e5b70f2ac', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771219842799_p80ij5wwy', 'Cardiac Diagnostics (2D Echo + Doppler)', 'at_center', ARRAY['diagnostics', 'cardiology', 'surgery']::text[], 'active', '', '', '2026-02-16T05:30:42.804Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Cardiac Diagnostics (ECG)
-- ID: 56fe4745-23fe-4cde-b89a-719dd209ed05
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['diagnostics_center', 'vet_clinic', 'vet_solo']::text[], '1500.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T05:27:58.616Z', 'Electrocardiogram: Records electrical heart activity, costing around', 'Cardiac Diagnostics (ECG)', 0, 15, '56fe4745-23fe-4cde-b89a-719dd209ed05', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771219678602_k1xhdlu04', 'Cardiac Diagnostics (ECG)', 'at_center', ARRAY['diagnostics', 'cardiology', 'surgery']::text[], 'active', '', '', '2026-02-16T05:27:58.616Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Ear Cleaning
-- ID: 94d11796-f557-4940-8260-33a0228021cc
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '399.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:48:40.527Z', 'Professional veterinary services of Ear cleaning 

Includes:
Physical examination
Symptom assessment
Ear Cleaning
Care guidance
Excludes:
Medicines
Lab tests
', 'Ear Cleaning', 0, 15, '94d11796-f557-4940-8260-33a0228021cc', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771120120523_65d5k919w', 'Ear Cleaning', 'at_center', ARRAY['medicine']::text[], 'active', '', '', '2026-02-15T01:48:40.527Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Health Certificate 
-- ID: 19141757-30d4-4f41-8397-689df93bf030
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '799.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:36:46.331Z', 'Certificate of Veterinary Inspection (CVI) or Pet Health Certificate issues for fitness to travel, Vaccination Certificate and  Medical Records Certificate for specific Medications- Includes domestic and international travel.

Includes:
Physical examination
Review of Medical records
Time bound Certificate issued as per government regulations

Excludes:
Medicines
Lab tests
Procedures', 'Health Certificate ', 0, 45, '19141757-30d4-4f41-8397-689df93bf030', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771119406324_7sitfp2je', 'Health Certificate ', 'at_center', ARRAY['medicine']::text[], 'active', '', '', '2026-02-15T01:36:46.331Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Hernia Surgeries by Vet at Clinic (Major-Perineal/Diaphragmatic)
-- ID: b658f121-7dfd-47eb-ad0f-f6481e58acd4
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '25000.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T05:07:30.701Z', 'Done under expert supervision by vet at clinic-

Includes:
Preparation: Diagnostics, Blood tests and administering general anesthesia. 
Correction Surgery
Repair (Herniorrhaphy)
Recovery: Observation for 1 day at hospital. An Elizabethan collar (cone) is mandatory to prevent them from licking or biting the stitches

Excludes:
Post operative Medications
Hospitalization expenses ', 'Hernia Surgeries by Vet at Clinic (Major-Perineal/Diaphragmatic)', 0, 240, 'b658f121-7dfd-47eb-ad0f-f6481e58acd4', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771218450696_zgplaredz', 'Hernia Surgeries by Vet at Clinic (Major-Perineal/Diaphragmatic)', 'at_center', ARRAY['diagnostics', 'surgery']::text[], 'active', '', '', '2026-02-16T05:07:30.701Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Neutering for Cats by Vet at Clinic
-- ID: 9c45f7e1-6234-441a-ab84-b6ec4f053461
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '2599.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T04:50:39.570Z', 'Neutering services offered by certified vet at clinic.

Includes:
Pre-operative checkup: Consultations to ensure the pet is fit for surgery.
Anesthesia and Surgical Procedure: Removal of reproductive organs (castration for males).
Pain Management & Medication: Post-operative antibiotics and pain relief.
Post-operative Care: Follow-up visits, stitch removal.

Excludes:
Hospitalization: 1–3 days of stay for observation, particularly for females.
Any post operative Medicines', 'Neutering for Cats by Vet at Clinic', 0, 120, '9c45f7e1-6234-441a-ab84-b6ec4f053461', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771217439565_9ag5isk9n', 'Neutering for Cats by Vet at Clinic', 'at_center', ARRAY['reproductive', 'surgery']::text[], 'active', '', '', '2026-02-16T04:50:39.570Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Neutering for Dogs by Vet and Clinic
-- ID: cde8830d-8f47-4a38-b00e-b5a179a61370
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '5999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T04:52:43.942Z', 'Neutering services for Dogs under supervision of a vet at the clinic

Includes:
Pre-operative checkup: Consultations to ensure the pet is fit for surgery.
Anesthesia and Surgical Procedure: Removal of reproductive organs (castration for males).
Pain Management & Medication: Post-operative antibiotics and pain relief.
Post-operative Care: Follow-up visits, stitch removal

Excludes:
Hospitalization: 1–3 days of stay for observation
Post operative Medicines', 'Neutering for Dogs by Vet and Clinic', 0, 120, 'cde8830d-8f47-4a38-b00e-b5a179a61370', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771217563938_rz2m5lp89', 'Neutering for Dogs by Vet and Clinic', 'at_center', ARRAY['reproductive', 'surgery']::text[], 'active', '', '', '2026-02-16T04:52:43.942Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Spay for Dogs Service by Vet at Clinic
-- ID: 2e02fd10-957b-421e-ae5d-a15333b06f4f
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '8500.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T04:48:48.134Z', 'Spay services for Dogs at clinic-

Includes
Pre-operative checkup: Consultations to ensure the pet is fit for surgery.
Anesthesia and Surgical Procedure: Removal of reproductive organs (ovariohysterectomy for females).
Pain Management & Medication: Post-operative antibiotics and pain relief.
Post-operative Care: Follow-up visits, stitch removal, and ear-notching (specifically for community/stray cats). 

Excludes:
Hospitalization: 1–3 days of stay for observation, particularly for females.
Any post operative Medicines ', 'Spay for Dogs Service by Vet at Clinic', 0, 120, '2e02fd10-957b-421e-ae5d-a15333b06f4f', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771217328128_yh19zr0sq', 'Spay for Dogs Service by Vet at Clinic', 'at_center', ARRAY['reproductive', 'surgery']::text[], 'active', '', '', '2026-02-16T04:48:48.134Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Tick and Flea Treatment at Clinic
-- ID: 2f0ca13d-9d0c-4ba4-93f3-5c4c42a8d12a
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '899.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:53:49.300Z', 'Routine preventive services to maintain long-term health.
Includes:
Physical exam
Administration of Tick and Flea Preventive Treatment
Preventive guidance
Excludes:
Medicines', 'Tick and Flea Treatment at Clinic', 0, 30, '2f0ca13d-9d0c-4ba4-93f3-5c4c42a8d12a', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771077229297_ppth60xgx', 'Tick and Flea Treatment at Clinic', 'at_center', ARRAY['medicine']::text[], 'active', '', '', '2026-02-14T13:53:49.300Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Tumor/Lump Removal Surgery (Major-Malignant and Complex Surgeries)
-- ID: 8efa5cd8-38d2-46e2-833e-f7aae888ae72
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '25000.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-16T05:16:44.476Z', 'Surgery conducted under supervision of certified vet at clinic.

Includes:
Tumour or lump removal surgery under Vet supervision at clinic.

Includes:
Pre-anesthetic diagnostic: CBC; X Ray and MRI Scans
Anesthesia: General anesthesia
Surgery:
Closure:

Excludes:
Medicines for post operative recovery
Hospitalization if any.', 'Tumor/Lump Removal Surgery (Major-Malignant and Complex Surgeries)', 0, 240, '8efa5cd8-38d2-46e2-833e-f7aae888ae72', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771219004472_fdgawr6nu', 'Tumor/Lump Removal Surgery (Major-Malignant and Complex Surgeries)', 'at_center', ARRAY['diagnostics', 'surgery']::text[], 'active', '', '', '2026-02-16T05:16:44.476Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic
-- ID: 76e16643-5a51-4321-bb5a-5b986f0a1131
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '750.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T12:39:09.093Z', '7-in-1 / 9-in-1 (DHPPi) Vaccination', 'Vaccination at Clinic', 0, 30, '76e16643-5a51-4321-bb5a-5b986f0a1131', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771072749090_s2e9i3wav', 'Vaccination at Clinic', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T12:39:09.093Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (Anti Rabies)
-- ID: 02ac4c22-da87-4698-bae3-4b959d5ba136
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '499.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:24:45.643Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions"', 'Vaccination at Clinic (Anti Rabies)', 0, 30, '02ac4c22-da87-4698-bae3-4b959d5ba136', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771075485640_l16087qq2', 'Vaccination at Clinic (Anti Rabies)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:24:45.643Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (Cat- FeLV)
-- ID: 1cfb282b-f4e0-4f82-b1b8-e9e13bc2cca4
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1799.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:35:09.434Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Clinic (Cat- FeLV)', 0, 30, '1cfb282b-f4e0-4f82-b1b8-e9e13bc2cca4', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771076109431_k8byjxp4r', 'Vaccination at Clinic (Cat- FeLV)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:35:09.434Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (Cat-FVRCP Booster)
-- ID: c69b83b0-943e-4f9d-a056-4eed28b73a4e
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:34:23.469Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Clinic (Cat-FVRCP Booster)', 0, 15, 'c69b83b0-943e-4f9d-a056-4eed28b73a4e', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771076063465_floft7nmj', 'Vaccination at Clinic (Cat-FVRCP Booster)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:34:23.469Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (Cats- FVRCP/CRP)
-- ID: f513cb31-ef9d-4fe0-9cb8-e659ed2d7fee
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:33:29.498Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Clinic (Cats- FVRCP/CRP)', 0, 15, 'f513cb31-ef9d-4fe0-9cb8-e659ed2d7fee', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771076009494_az5g8c4sb', 'Vaccination at Clinic (Cats- FVRCP/CRP)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:33:29.498Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (DHPPi (7-in-1)/9-in-1)
-- ID: 7205b0d1-69a6-417b-9053-a149631c02b6
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '899.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:21:24.741Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Clinic (DHPPi (7-in-1)/9-in-1)', 0, 30, '7205b0d1-69a6-417b-9053-a149631c02b6', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771075284737_kygcx36x9', 'Vaccination at Clinic (DHPPi (7-in-1)/9-in-1)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:21:24.741Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (DHPPi Booster)
-- ID: 32ee8dd1-a0a7-4360-849c-b6b4af91450e
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '899.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:23:52.337Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions"', 'Vaccination at Clinic (DHPPi Booster)', 0, 30, '32ee8dd1-a0a7-4360-849c-b6b4af91450e', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771075432332_9zie3f1a1', 'Vaccination at Clinic (DHPPi Booster)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:23:52.337Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (Kennel Cough)
-- ID: 0ca82f5e-f75a-47cf-b1bd-d8f63f2df705
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '899.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:26:14.316Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions"', 'Vaccination at Clinic (Kennel Cough)', 0, 30, '0ca82f5e-f75a-47cf-b1bd-d8f63f2df705', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771075574314_1mojglsxd', 'Vaccination at Clinic (Kennel Cough)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:26:14.316Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Clinic (Leptospirosis)
-- ID: 779b74e3-d099-4937-a1e6-ca6d051cae88
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '699.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:25:38.267Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions"', 'Vaccination at Clinic (Leptospirosis)', 0, 30, '779b74e3-d099-4937-a1e6-ca6d051cae88', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771075538264_1q0yzh7w4', 'Vaccination at Clinic (Leptospirosis)', 'at_center', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:25:38.267Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home
-- ID: 6199011c-f72e-45cd-b0d6-2f351d160157
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_solo', 'vet_clinic']::text[], '1950.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T12:33:00.527Z', 'Vaccination Administration at Home.', 'Vaccination at Home', 0, 60, '6199011c-f72e-45cd-b0d6-2f351d160157', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771072380506_t0onsqyo7', 'Vaccination at Home', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T12:33:00.527Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Anti Rabies) 
-- ID: 63560f1b-b3dc-4b70-87ac-160b0996545a
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:30:14.232Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Home (Anti Rabies) ', 0, 30, '63560f1b-b3dc-4b70-87ac-160b0996545a', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771075814229_cm65w80ql', 'Vaccination at Home (Anti Rabies) ', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:30:14.232Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Cat- FeLV)
-- ID: f643db75-6d68-4ff5-b031-065539114700
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '2999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:37:23.669Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Home (Cat- FeLV)', 0, 15, 'f643db75-6d68-4ff5-b031-065539114700', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771076243666_yfxce3u52', 'Vaccination at Home (Cat- FeLV)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:37:23.669Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Cat-FVRCP Booster)
-- ID: ca69f954-494f-450d-8bda-abcfdf1bdb0a
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1699.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:38:11.322Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Home (Cat-FVRCP Booster)', 0, 30, 'ca69f954-494f-450d-8bda-abcfdf1bdb0a', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771076291318_d9dyyqrv2', 'Vaccination at Home (Cat-FVRCP Booster)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:38:11.322Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Cat-FVRCP/CRP)
-- ID: d1cbcb9a-a993-4dd9-99a5-a7c403456a05
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1699.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:36:42.331Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Home (Cat-FVRCP/CRP)', 0, 15, 'd1cbcb9a-a993-4dd9-99a5-a7c403456a05', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771076202326_265z7vt7v', 'Vaccination at Home (Cat-FVRCP/CRP)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:36:42.331Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (DHPPi Booster)
-- ID: 06d59368-3b1e-42b9-b6c0-6fc0f4106fd9
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1499.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:29:01.788Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Travel Fees

Excludes:
Consultation (if separate)
Treatment of vaccine reactions
', 'Vaccination at Home (DHPPi Booster)', 0, 30, '06d59368-3b1e-42b9-b6c0-6fc0f4106fd9', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771075741784_amtp1n3eg', 'Vaccination at Home (DHPPi Booster)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:29:01.788Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Distemper + Parvo)
-- ID: 5245489e-ac0e-467d-acb8-da7d767f956b
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1399.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:18:42.229Z', 'Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update

Excludes:
Consultation (if separate)
Treatment of vaccine reactions', 'Vaccination at Home (Distemper + Parvo)', 0, 45, '5245489e-ac0e-467d-acb8-da7d767f956b', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771075122225_f4l8m08m4', 'Vaccination at Home (Distemper + Parvo)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:18:42.229Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Kennel Cough)
-- ID: 9cca0d52-4d48-45ca-9897-9401698f5aae
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1599.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:31:58.211Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions"', 'Vaccination at Home (Kennel Cough)', 0, 30, '9cca0d52-4d48-45ca-9897-9401698f5aae', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771075918209_bkv3js601', 'Vaccination at Home (Kennel Cough)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:31:58.212Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vaccination at Home (Leptospirosis)
-- ID: 97413e61-2dc4-46a3-9520-2b99b17355e0
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1299.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:31:18.484Z', '"Administration of preventive vaccines for infectious diseases.

Includes:
Vaccine dose
Administration
Vaccination record update
Excludes:
Consultation (if separate)
Treatment of vaccine reactions"', 'Vaccination at Home (Leptospirosis)', 0, 30, '97413e61-2dc4-46a3-9520-2b99b17355e0', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771075878482_szuog878t', 'Vaccination at Home (Leptospirosis)', 'at_home', ARRAY['vaccination']::text[], 'active', '', '', '2026-02-14T13:31:18.484Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vet End of Life (Euthenesia) at Clinic Service
-- ID: f4bb29bd-75a3-4d36-8bb6-cf492c239732
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '2999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T02:04:45.680Z', 'Administered by licensed Veterinary Doctor 

Includes-
Physical Assessment
Administering of drug
Completion of procedure and assessment of closure
Medical Certificate', 'Vet End of Life (Euthenesia) at Clinic Service', 0, 45, 'f4bb29bd-75a3-4d36-8bb6-cf492c239732', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771121085639_r0159psmr', 'Vet End of Life (Euthenesia) at Clinic Service', 'at_center', ARRAY['palliative', 'emergency']::text[], 'active', '', '', '2026-02-15T02:04:45.680Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vet End of Life (Euthenesia) at Home Service
-- ID: c704138e-6eea-465f-8fed-fda48312a960
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '4999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T02:05:27.721Z', 'Administered by licensed Veterinary Doctor 

Includes-
Physical Assessment
Administering of drug
Completion of procedure and assessment of closure
Medical Certificate', 'Vet End of Life (Euthenesia) at Home Service', 0, 45, 'c704138e-6eea-465f-8fed-fda48312a960', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771121127718_e9lbbj9jd', 'Vet End of Life (Euthenesia) at Home Service', 'at_home', ARRAY['palliative', 'emergency']::text[], 'active', '', '', '2026-02-15T02:05:27.721Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vet IV Fluid
-- ID: 1cdea7d8-0f85-40c7-b4a8-f7107d4fc6e3
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1299.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:58:18.176Z', 'Professional veterinary administration of IV Fluids for specific medical conditions

Includes
Physical examination
Symptom assessment
Administering IV Fluids
Care guidance

Excludes:
Medicines
Lab tests', 'Vet IV Fluid', 0, 45, '1cdea7d8-0f85-40c7-b4a8-f7107d4fc6e3', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771120698171_qysr6696t', 'Vet IV Fluid', 'at_center', ARRAY['medicine', 'emergency']::text[], 'active', '', '', '2026-02-15T01:58:18.176Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vet Palliative Care Visit
-- ID: f8499b4d-183c-4c45-878f-44a04d896ce3
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1999.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T03:00:41.052Z', 'Physical Examination
Weight measurement
Temperature check
Heart and lung examination
Skin and coat inspection
Eye, ear, oral examination

Excluded:
Medicines
Any Procedures', 'Vet Palliative Care Visit', 0, 45, 'f8499b4d-183c-4c45-878f-44a04d896ce3', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771124441047_03voa30lb', 'Vet Palliative Care Visit', 'at_home', ARRAY['palliative']::text[], 'active', '', '', '2026-02-15T03:00:41.052Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vet Tele-Consultation Early Morning Premium 
-- ID: 1a8b0fa8-8a40-47f4-a450-4dc18b9938a0
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '699.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:44:57.098Z', 'Vet Tele consultation furing early morning hours 05:30 - 08:30
15-minute video consultation for advice and preliminary diagnosis.

Includes:
Video consultation
Vet advice
Treatment guidance
Excludes:
Physical examination
Diagnostics
Prescriptions for restricted drugs
Emergency procedures', 'Vet Tele-Consultation Early Morning Premium ', 0, 15, '1a8b0fa8-8a40-47f4-a450-4dc18b9938a0', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_tele_1771076697093_7n594qifj', 'Vet Tele-Consultation Early Morning Premium ', 'tele', ARRAY['medicine']::text[], 'active', '', '', '2026-02-14T13:44:57.098Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Vet Tele-Consultation Late Night Premium
-- ID: 1339efde-2274-4f90-a518-3e13446e518c
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '699.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-14T13:42:52.685Z', 'Includes Vet Tele/Video consultations during 21:00 - 23:00
15-minute video consultation for advice and preliminary diagnosis.

Includes:
Video consultation
Vet advice
Treatment guidance
Excludes:
Physical examination
Diagnostics
Prescriptions for restricted drugs
Emergency procedures', 'Vet Tele-Consultation Late Night Premium', 0, 15, '1339efde-2274-4f90-a518-3e13446e518c', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_tele_1771076572681_p8mqlcc8l', 'Vet Tele-Consultation Late Night Premium', 'tele', ARRAY['medicine']::text[], 'active', '', '', '2026-02-14T13:42:52.685Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Wound Dressing at Clinic
-- ID: e30010ce-ef80-4a69-864f-7c27f9def2e7
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '499.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:30:13.265Z', 'Veterinary evaluation and dressing of minor wounds not requiring surgeries.

Includes:
Physical examination
Symptom assessment
Treatment recommendation
Dressing of Wound
Care guidance
Excludes:
Medicines
Lab tests', 'Wound Dressing at Clinic', 0, 30, 'e30010ce-ef80-4a69-864f-7c27f9def2e7', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_center_1771119013072_z7ym1gtly', 'Wound Dressing at Clinic', 'at_center', ARRAY['medicine', 'emergency']::text[], 'active', '', '', '2026-02-15T01:30:13.265Z')
ON CONFLICT (id) DO NOTHING;

-- Service: Wound Dressing at Home
-- ID: 3d12e9de-adef-4a33-8fb7-e15e058f2ed3
INSERT INTO service_catalog (applicable_roles, base_price, category_id, category_name, created_at, description, display_name, display_order, duration_minutes, id, metadata, publish_status, service_id, service_name, service_style, specialization_ids, status, sub_category_id, sub_category_name, updated_at)
VALUES (ARRAY['vet_clinic', 'vet_solo']::text[], '1299.00', '63d34efd-76b0-4e2e-8aa0-4465ddef6620', 'General', '2026-02-15T01:31:53.482Z', 'Veterinary evaluation of dressing of wounds for minor injuries not requiring a surgery.

Includes:
Physical examination
Symptom assessment
Treatment recommendation
Dressing of Wound 
Care guidance
Travel Fee to doorstep
Excludes:
Medicines
Lab tests', 'Wound Dressing at Home', 0, 45, '3d12e9de-adef-4a33-8fb7-e15e058f2ed3', '{"isPackage":false}'::jsonb, 'published', 'svc_admin_at_home_1771119113476_y3czxh87c', 'Wound Dressing at Home', 'at_home', ARRAY['medicine', 'emergency']::text[], 'active', '', '', '2026-02-15T01:31:53.482Z')
ON CONFLICT (id) DO NOTHING;

COMMIT;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
-- ============================================================================
-- MIGRATION 1110: Veterinary catalogue descriptions from comprehensive SOP
-- ============================================================================
-- Source: Warmpawz Comprehensive Veterinary Service Catalogue.
-- Updates service_catalog.description only (display names unchanged).
-- Idempotent: each UPDATE skips rows already on the target text.
-- Split SKUs (vaccines, spay/neuter, imaging, wound/IV/euthanasia variants)
-- share the matching numbered service description.
-- Unmatched SOP rows (no catalogue SKU): 13.1 Laboratory Diagnostics,
-- 14.1 Standard Recovery Boarding, 15.3 Vaccination Certificate.
-- ============================================================================

-- 1.1 Puppy / Kitten First Visit
-- Maps to: Puppy / Kitten First Visit
UPDATE service_catalog
SET description = 'Initial wellness consultation for puppies and kittens focused on developmental assessment, nutrition guidance, vaccination planning, parasite prevention, behavioural guidance, and parent education. Includes: Physical examination; Weight assessment; Growth milestone review; Feeding guidance; Basic behavioural guidance; Vaccination schedule planning; Deworming schedule planning; Basic hygiene counselling. Excludes: Vaccination costs; Diagnostic tests; Medications; Emergency treatment; Surgical procedures; Speciality referrals.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Puppy / Kitten First Visit'
  )
  AND description IS DISTINCT FROM 'Initial wellness consultation for puppies and kittens focused on developmental assessment, nutrition guidance, vaccination planning, parasite prevention, behavioural guidance, and parent education. Includes: Physical examination; Weight assessment; Growth milestone review; Feeding guidance; Basic behavioural guidance; Vaccination schedule planning; Deworming schedule planning; Basic hygiene counselling. Excludes: Vaccination costs; Diagnostic tests; Medications; Emergency treatment; Surgical procedures; Speciality referrals.';

-- 1.2 General Health Check-up
-- Maps to: Complete physical examination
UPDATE service_catalog
SET description = 'Routine preventive consultation for healthy pets aimed at identifying early health concerns and maintaining long-term wellness. Includes: General physical examination; Vitals assessment; Weight monitoring; Coat and skin evaluation; Ear and eye examination; Oral cavity examination; Preventive healthcare recommendations. Excludes: Advanced diagnostics; Blood tests; Imaging; Procedures; Medication costs.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Complete physical examination'
  )
  AND description IS DISTINCT FROM 'Routine preventive consultation for healthy pets aimed at identifying early health concerns and maintaining long-term wellness. Includes: General physical examination; Vitals assessment; Weight monitoring; Coat and skin evaluation; Ear and eye examination; Oral cavity examination; Preventive healthcare recommendations. Excludes: Advanced diagnostics; Blood tests; Imaging; Procedures; Medication costs.';

-- 1.3 Sick Pet Consultation
-- Maps to: Sick Pet Consultation
UPDATE service_catalog
SET description = 'Consultation for pets displaying symptoms of illness, discomfort, behavioural changes, appetite loss, or acute medical conditions. Includes: Symptom assessment; Physical examination; Preliminary diagnosis; Treatment planning; Prescription generation; Referral recommendation if required. Excludes: Hospitalisation; ICU admission; Surgical intervention; Diagnostic testing charges; Pharmacy charges.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Sick Pet Consultation'
  )
  AND description IS DISTINCT FROM 'Consultation for pets displaying symptoms of illness, discomfort, behavioural changes, appetite loss, or acute medical conditions. Includes: Symptom assessment; Physical examination; Preliminary diagnosis; Treatment planning; Prescription generation; Referral recommendation if required. Excludes: Hospitalisation; ICU admission; Surgical intervention; Diagnostic testing charges; Pharmacy charges.';

-- 1.4 Follow-Up Consultation
-- Maps to: Follow-up Consultation
UPDATE service_catalog
SET description = 'Review consultation after prior diagnosis, treatment, surgery, or therapy. Includes: Progress assessment; Medication adjustment; Recovery monitoring; Repeat physical examination; Ongoing care planning. Excludes: New unrelated condition treatment; Repeat diagnostics unless prescribed; Emergency interventions.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Follow-up Consultation'
  )
  AND description IS DISTINCT FROM 'Review consultation after prior diagnosis, treatment, surgery, or therapy. Includes: Progress assessment; Medication adjustment; Recovery monitoring; Repeat physical examination; Ongoing care planning. Excludes: New unrelated condition treatment; Repeat diagnostics unless prescribed; Emergency interventions.';

-- 1.5 Second Opinion Consultation
-- Maps to: Second Opinion Consultation
UPDATE service_catalog
SET description = 'Independent veterinary review of diagnosis, treatment plans, imaging, diagnostics, or surgical recommendations provided elsewhere. Includes: Medical history review; Existing report evaluation; Clinical reassessment; Alternate treatment recommendations. Excludes: Repeat diagnostics unless requested; Procedures; Emergency care.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Second Opinion Consultation'
  )
  AND description IS DISTINCT FROM 'Independent veterinary review of diagnosis, treatment plans, imaging, diagnostics, or surgical recommendations provided elsewhere. Includes: Medical history review; Existing report evaluation; Clinical reassessment; Alternate treatment recommendations. Excludes: Repeat diagnostics unless requested; Procedures; Emergency care.';

-- 2.1 Vaccination Services
-- Maps to: Vaccination at Clinic (Anti Rabies) | Vaccination at Clinic (Cat- FeLV) | Vaccination at Clinic (Cat-FVRCP Booster) | Vaccination at Clinic (Cats- FVRCP/CRP) | Vaccination at Clinic (DHPPi) | Vaccination at Clinic (DHPPi (7-in-1)/9-in-1) | Vaccination at Clinic (DHPPi Booster) | Vaccination at Clinic (Kennel Cough) | Vaccination at Clinic (Leptospirosis) | Vaccination at Home (Anti Rabies) | Vaccination at Home (Cat- FeLV) | Vaccination at Home (Cat-FVRCP Booster) | Vaccination at Home (Cat-FVRCP/CRP) | Vaccination at Home (DHPPi Booster) | Vaccination at Home (Distemper + Parvo) | Vaccination at Home (Kennel Cough) | Vaccination at Home (Leptospirosis)
UPDATE service_catalog
SET description = 'Administration of core and non-core vaccines for disease prevention in dogs and cats. Includes: Vaccine administration; Vaccine card updates; Vaccine counselling; Observation for immediate adverse reactions. Excludes: Treatment of vaccine reactions beyond observation period; Consultation for unrelated illnesses; Diagnostic testing.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Vaccination at Clinic (Anti Rabies)',
    'Vaccination at Clinic (Cat- FeLV)',
    'Vaccination at Clinic (Cat-FVRCP Booster)',
    'Vaccination at Clinic (Cats- FVRCP/CRP)',
    'Vaccination at Clinic (DHPPi)',
    'Vaccination at Clinic (DHPPi (7-in-1)/9-in-1)',
    'Vaccination at Clinic (DHPPi Booster)',
    'Vaccination at Clinic (Kennel Cough)',
    'Vaccination at Clinic (Leptospirosis)',
    'Vaccination at Home (Anti Rabies)',
    'Vaccination at Home (Cat- FeLV)',
    'Vaccination at Home (Cat-FVRCP Booster)',
    'Vaccination at Home (Cat-FVRCP/CRP)',
    'Vaccination at Home (DHPPi Booster)',
    'Vaccination at Home (Distemper + Parvo)',
    'Vaccination at Home (Kennel Cough)',
    'Vaccination at Home (Leptospirosis)'
  )
  AND description IS DISTINCT FROM 'Administration of core and non-core vaccines for disease prevention in dogs and cats. Includes: Vaccine administration; Vaccine card updates; Vaccine counselling; Observation for immediate adverse reactions. Excludes: Treatment of vaccine reactions beyond observation period; Consultation for unrelated illnesses; Diagnostic testing.';

-- 2.2 Deworming Services
-- Maps to: Deworming
UPDATE service_catalog
SET description = 'Internal parasite prevention and treatment service for dogs and cats. Includes: Weight assessment; Deworming dosage recommendation; Deworming administration guidance; Preventive schedule planning. Excludes: Stool diagnostics; Hospitalisation for severe infestations; Medication for unrelated illnesses.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Deworming'
  )
  AND description IS DISTINCT FROM 'Internal parasite prevention and treatment service for dogs and cats. Includes: Weight assessment; Deworming dosage recommendation; Deworming administration guidance; Preventive schedule planning. Excludes: Stool diagnostics; Hospitalisation for severe infestations; Medication for unrelated illnesses.';

-- 2.3 External Parasite Control
-- Maps to: External Parasite Control (Ticks/Fleas/Mites) | Tick and Flea Treatment at Clinic
UPDATE service_catalog
SET description = 'Prevention and treatment of ticks, fleas, mites, and external parasites. Includes: Parasite assessment; Preventive recommendations; Spot-on/oral preventive guidance; Environmental control guidance. Excludes: Severe dermatology management; Advanced allergy treatment; Hospitalisation.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'External Parasite Control (Ticks/Fleas/Mites)',
    'Tick and Flea Treatment at Clinic'
  )
  AND description IS DISTINCT FROM 'Prevention and treatment of ticks, fleas, mites, and external parasites. Includes: Parasite assessment; Preventive recommendations; Spot-on/oral preventive guidance; Environmental control guidance. Excludes: Severe dermatology management; Advanced allergy treatment; Hospitalisation.';

-- 3.1 Fever & Infection Management
-- Maps to: Fever & Infection Management
UPDATE service_catalog
SET description = 'Medical evaluation and treatment planning for infectious diseases and fever-related conditions. Includes: Clinical assessment; Fever management; Medication planning; Monitoring recommendations. Excludes: ICU care; Diagnostic lab costs; IV hospitalisation.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Fever & Infection Management'
  )
  AND description IS DISTINCT FROM 'Medical evaluation and treatment planning for infectious diseases and fever-related conditions. Includes: Clinical assessment; Fever management; Medication planning; Monitoring recommendations. Excludes: ICU care; Diagnostic lab costs; IV hospitalisation.';

-- 3.2 Gastrointestinal Disorder Treatment
-- Maps to: Gastrointestinal Disorders
UPDATE service_catalog
SET description = 'Treatment of gastrointestinal disorders including vomiting, diarrhoea, gastritis, constipation, and appetite loss. Includes: Clinical assessment; Diet guidance; Medication planning; Hydration recommendations. Excludes: Endoscopy; Surgery; Hospitalisation.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Gastrointestinal Disorders'
  )
  AND description IS DISTINCT FROM 'Treatment of gastrointestinal disorders including vomiting, diarrhoea, gastritis, constipation, and appetite loss. Includes: Clinical assessment; Diet guidance; Medication planning; Hydration recommendations. Excludes: Endoscopy; Surgery; Hospitalisation.';

-- 3.3 Respiratory Condition Management
-- Maps to: Respiratory Conditions
UPDATE service_catalog
SET description = 'Management of respiratory conditions including coughing, sneezing, nasal discharge, and mild breathing distress. Excludes: Oxygen cage therapy; Ventilator support; ICU admission.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Respiratory Conditions'
  )
  AND description IS DISTINCT FROM 'Management of respiratory conditions including coughing, sneezing, nasal discharge, and mild breathing distress. Excludes: Oxygen cage therapy; Ventilator support; ICU admission.';

-- 3.4 Skin & Allergy Treatment
-- Maps to: Skin & Allergy Treatment
UPDATE service_catalog
SET description = 'Assessment and treatment of skin and allergy conditions. Includes: Skin examination; Allergy assessment; Medication planning; Basic dermatology guidance. Excludes: Advanced allergy panels; Long-term immunotherapy; Biopsy procedures.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Skin & Allergy Treatment'
  )
  AND description IS DISTINCT FROM 'Assessment and treatment of skin and allergy conditions. Includes: Skin examination; Allergy assessment; Medication planning; Basic dermatology guidance. Excludes: Advanced allergy panels; Long-term immunotherapy; Biopsy procedures.';

-- 4.1 Spaying (Female Sterilisation)
-- Maps to: Spay for Dogs Service by Vet at Clinic | Spay for Cats Service by Vet at Clinic
UPDATE service_catalog
SET description = 'Elective sterilisation surgery for female pets. Includes: Pre-operative consultation; Anaesthesia; Surgical procedure; Basic monitoring; Standard recovery guidance; Suture review guidance. Excludes: Pre-anaesthetic blood work; Extended hospitalisation; Complication management; Advanced imaging; Post-op boarding beyond standard period.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Spay for Dogs Service by Vet at Clinic',
    'Spay for Cats Service by Vet at Clinic'
  )
  AND description IS DISTINCT FROM 'Elective sterilisation surgery for female pets. Includes: Pre-operative consultation; Anaesthesia; Surgical procedure; Basic monitoring; Standard recovery guidance; Suture review guidance. Excludes: Pre-anaesthetic blood work; Extended hospitalisation; Complication management; Advanced imaging; Post-op boarding beyond standard period.';

-- 4.2 Neutering (Male Sterilisation)
-- Maps to: Neutering for Dogs by Vet and Clinic | Neutering for Cats by Vet at Clinic
UPDATE service_catalog
SET description = 'Elective sterilisation surgery for male pets. Includes: Surgical procedure; Anaesthesia; Basic monitoring; Recovery guidance. Excludes: Blood work; Hospitalisation beyond routine recovery; Complication treatment.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Neutering for Dogs by Vet and Clinic',
    'Neutering for Cats by Vet at Clinic'
  )
  AND description IS DISTINCT FROM 'Elective sterilisation surgery for male pets. Includes: Surgical procedure; Anaesthesia; Basic monitoring; Recovery guidance. Excludes: Blood work; Hospitalisation beyond routine recovery; Complication treatment.';

-- 4.3 Tumour / Lump Removal
-- Maps to: Tumor/Lump Removal Surgery (Major-Malignant and Complex Surgeries)
UPDATE service_catalog
SET description = 'Surgical excision of tumours or lumps. Includes: Surgical excision; Basic monitoring; Wound closure. Excludes: Histopathology; Oncology treatment; Chemotherapy; ICU stay.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Tumor/Lump Removal Surgery (Major-Malignant and Complex Surgeries)'
  )
  AND description IS DISTINCT FROM 'Surgical excision of tumours or lumps. Includes: Surgical excision; Basic monitoring; Wound closure. Excludes: Histopathology; Oncology treatment; Chemotherapy; ICU stay.';

-- 4.4 Hernia Repair
-- Maps to: Hernia Repair
UPDATE service_catalog
SET description = 'Surgical correction of hernia. Includes: Surgical correction; Anaesthesia; Standard monitoring. Excludes: Advanced imaging; Complication management; ICU care.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Hernia Repair'
  )
  AND description IS DISTINCT FROM 'Surgical correction of hernia. Includes: Surgical correction; Anaesthesia; Standard monitoring. Excludes: Advanced imaging; Complication management; ICU care.';

-- 4.5 Emergency Surgery
-- Maps to: Emergency Surgery
UPDATE service_catalog
SET description = 'Emergency surgical intervention for critical conditions. Includes: Emergency surgical intervention; Stabilisation; Anaesthesia; Surgical consumables. Excludes: Extended ICU charges; Blood transfusions; Specialist surgical implants.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Emergency Surgery'
  )
  AND description IS DISTINCT FROM 'Emergency surgical intervention for critical conditions. Includes: Emergency surgical intervention; Stabilisation; Anaesthesia; Surgical consumables. Excludes: Extended ICU charges; Blood transfusions; Specialist surgical implants.';

-- 5.1 Fracture Treatment
-- Maps to: Fracture Treatment
UPDATE service_catalog
SET description = 'Orthopaedic evaluation, stabilisation guidance, and treatment planning for fractures. Includes: Orthopaedic evaluation; Stabilisation guidance; Surgical planning. Excludes: Implant costs; Rehabilitation therapy; Physiotherapy.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Fracture Treatment'
  )
  AND description IS DISTINCT FROM 'Orthopaedic evaluation, stabilisation guidance, and treatment planning for fractures. Includes: Orthopaedic evaluation; Stabilisation guidance; Surgical planning. Excludes: Implant costs; Rehabilitation therapy; Physiotherapy.';

-- 5.2 Bone Plating / Pinning
-- Maps to: Bone Plating / Pinning
UPDATE service_catalog
SET description = 'Surgical bone fixation using plating or pinning. Includes: Surgical fixation; Anaesthesia; Standard monitoring. Excludes: Implant costs; Advanced imaging; Long-term rehabilitation.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Bone Plating / Pinning'
  )
  AND description IS DISTINCT FROM 'Surgical bone fixation using plating or pinning. Includes: Surgical fixation; Anaesthesia; Standard monitoring. Excludes: Implant costs; Advanced imaging; Long-term rehabilitation.';

-- 6.1 Dental Check-up
-- Maps to: Dental Check-up | Dental Checkup
UPDATE service_catalog
SET description = 'Oral examination and dental health assessment. Includes: Oral examination; Gum assessment; Dental recommendations. Excludes: Sedation; Scaling; Extraction.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Dental Check-up',
    'Dental Checkup'
  )
  AND description IS DISTINCT FROM 'Oral examination and dental health assessment. Includes: Oral examination; Gum assessment; Dental recommendations. Excludes: Sedation; Scaling; Extraction.';

-- 6.2 Scaling & Polishing
-- Maps to: Scaling & Polishing
UPDATE service_catalog
SET description = 'Professional dental scaling and polishing under anaesthesia. Includes: Anaesthesia; Ultrasonic scaling; Polishing; Basic oral assessment. Excludes: Tooth extraction; Dental X-rays; Oral surgery.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Scaling & Polishing'
  )
  AND description IS DISTINCT FROM 'Professional dental scaling and polishing under anaesthesia. Includes: Anaesthesia; Ultrasonic scaling; Polishing; Basic oral assessment. Excludes: Tooth extraction; Dental X-rays; Oral surgery.';

-- 6.3 Tooth Extraction
-- Maps to: Tooth Extraction
UPDATE service_catalog
SET description = 'Tooth extraction with anaesthesia and pain-management guidance. Includes: Extraction procedure; Anaesthesia; Pain management guidance. Excludes: Advanced oral reconstruction; Specialist dental imaging.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Tooth Extraction'
  )
  AND description IS DISTINCT FROM 'Tooth extraction with anaesthesia and pain-management guidance. Includes: Extraction procedure; Anaesthesia; Pain management guidance. Excludes: Advanced oral reconstruction; Specialist dental imaging.';

-- 7.1 Emergency Consultation
-- Maps to: Emergency Consultation
UPDATE service_catalog
SET description = 'Urgent consultation for critical symptoms requiring immediate veterinary attention. Includes: Rapid assessment; Stabilisation recommendations; Emergency treatment planning. Excludes: ICU boarding; Emergency surgery charges; Advanced diagnostics.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Emergency Consultation'
  )
  AND description IS DISTINCT FROM 'Urgent consultation for critical symptoms requiring immediate veterinary attention. Includes: Rapid assessment; Stabilisation recommendations; Emergency treatment planning. Excludes: ICU boarding; Emergency surgery charges; Advanced diagnostics.';

-- 7.2 Trauma & Accident Care
-- Maps to: Trauma & Accident Care
UPDATE service_catalog
SET description = 'Emergency evaluation and stabilisation of trauma and accident cases. Includes: Wound stabilisation; Pain management guidance; Emergency evaluation. Excludes: Orthopaedic implants; Surgery; ICU monitoring.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Trauma & Accident Care'
  )
  AND description IS DISTINCT FROM 'Emergency evaluation and stabilisation of trauma and accident cases. Includes: Wound stabilisation; Pain management guidance; Emergency evaluation. Excludes: Orthopaedic implants; Surgery; ICU monitoring.';

-- 7.3 Poisoning / Toxicity Management
-- Maps to: Poisoning / Toxicity Management
UPDATE service_catalog
SET description = 'Emergency management of poisoning or toxicity. Includes: Emergency stabilisation; Decontamination guidance; Immediate medical management. Excludes: Toxicology panels; ICU stay; Long-term organ support.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Poisoning / Toxicity Management'
  )
  AND description IS DISTINCT FROM 'Emergency management of poisoning or toxicity. Includes: Emergency stabilisation; Decontamination guidance; Immediate medical management. Excludes: Toxicology panels; ICU stay; Long-term organ support.';

-- 8.1 Skin Infection Treatment
-- Maps to: Skin Infection Treatment
UPDATE service_catalog
SET description = 'Treatment of skin infections with examination and medication planning. Includes: Skin examination; Medication guidance; Topical treatment planning. Excludes: Long-term allergy protocols; Advanced diagnostics.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Skin Infection Treatment'
  )
  AND description IS DISTINCT FROM 'Treatment of skin infections with examination and medication planning. Includes: Skin examination; Medication guidance; Topical treatment planning. Excludes: Long-term allergy protocols; Advanced diagnostics.';

-- 8.2 Mange Treatment
-- Maps to: Mange Treatment
UPDATE service_catalog
SET description = 'Diagnosis and treatment planning for mange. Includes: Skin scraping guidance; Medication planning; Follow-up recommendations. Excludes: Chronic dermatology management.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Mange Treatment'
  )
  AND description IS DISTINCT FROM 'Diagnosis and treatment planning for mange. Includes: Skin scraping guidance; Medication planning; Follow-up recommendations. Excludes: Chronic dermatology management.';

-- 9.1 Pregnancy Diagnosis
-- Maps to: Pregnancy Diagnosis
UPDATE service_catalog
SET description = 'Clinical pregnancy diagnosis and confirmation. Includes: Physical examination; Pregnancy confirmation; Ultrasound recommendation. Excludes: Caesarean surgery; Neonatal care.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Pregnancy Diagnosis'
  )
  AND description IS DISTINCT FROM 'Clinical pregnancy diagnosis and confirmation. Includes: Physical examination; Pregnancy confirmation; Ultrasound recommendation. Excludes: Caesarean surgery; Neonatal care.';

-- 9.2 Antenatal Care
-- Maps to: Antenatal Care
UPDATE service_catalog
SET description = 'Pregnancy monitoring and antenatal guidance. Includes: Pregnancy monitoring; Nutritional guidance; Delivery planning. Excludes: Emergency intervention; Surgical delivery.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Antenatal Care'
  )
  AND description IS DISTINCT FROM 'Pregnancy monitoring and antenatal guidance. Includes: Pregnancy monitoring; Nutritional guidance; Delivery planning. Excludes: Emergency intervention; Surgical delivery.';

-- 9.3 Assisted Delivery
-- Maps to: Assisted Delivery
UPDATE service_catalog
SET description = 'Assisted delivery support with maternal and neonatal assessment. Includes: Delivery support; Maternal stabilisation; Neonatal assessment. Excludes: Neonatal ICU; Caesarean surgery.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Assisted Delivery'
  )
  AND description IS DISTINCT FROM 'Assisted delivery support with maternal and neonatal assessment. Includes: Delivery support; Maternal stabilisation; Neonatal assessment. Excludes: Neonatal ICU; Caesarean surgery.';

-- 10.1 Puppy / Kitten Growth Monitoring
-- Maps to: Puppy / Kitten Growth Monitoring
UPDATE service_catalog
SET description = 'Growth monitoring and developmental guidance for puppies and kittens. Includes: Growth tracking; Nutritional guidance; Behavioural counselling. Excludes: Vaccination charges; Diagnostic testing.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Puppy / Kitten Growth Monitoring'
  )
  AND description IS DISTINCT FROM 'Growth monitoring and developmental guidance for puppies and kittens. Includes: Growth tracking; Nutritional guidance; Behavioural counselling. Excludes: Vaccination charges; Diagnostic testing.';

-- 10.2 Senior Pet Health Screening
-- Maps to: Senior Pet Health Screening
UPDATE service_catalog
SET description = 'Health screening for senior pets including mobility, organ health, and pain evaluation. Includes: Mobility assessment; Organ health review; Pain evaluation. Excludes: Imaging; Advanced diagnostics.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Senior Pet Health Screening'
  )
  AND description IS DISTINCT FROM 'Health screening for senior pets including mobility, organ health, and pain evaluation. Includes: Mobility assessment; Organ health review; Pain evaluation. Excludes: Imaging; Advanced diagnostics.';

-- 11.1 Quality of Life Consultation
-- Maps to: Quality of Life Consultation
UPDATE service_catalog
SET description = 'Quality-of-life consultation covering pain, comfort, prognosis, and family counselling. Includes: Pain assessment; Comfort evaluation; Prognosis discussion; Family counselling. Excludes: Curative treatment; Hospitalisation.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Quality of Life Consultation'
  )
  AND description IS DISTINCT FROM 'Quality-of-life consultation covering pain, comfort, prognosis, and family counselling. Includes: Pain assessment; Comfort evaluation; Prognosis discussion; Family counselling. Excludes: Curative treatment; Hospitalisation.';

-- 11.2 Humane Euthanasia
-- Maps to: Humane Euthanasia | Vet End of Life (Euthenesia) at Clinic Service | Vet End of Life (Euthenesia) at Home Service
UPDATE service_catalog
SET description = 'Humane euthanasia procedure with sedation and compassion support. Includes: Sedation; Humane euthanasia procedure; Compassion support guidance. Excludes: Cremation; Burial services; Memorial products.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Humane Euthanasia',
    'Vet End of Life (Euthenesia) at Clinic Service',
    'Vet End of Life (Euthenesia) at Home Service'
  )
  AND description IS DISTINCT FROM 'Humane euthanasia procedure with sedation and compassion support. Includes: Sedation; Humane euthanasia procedure; Compassion support guidance. Excludes: Cremation; Burial services; Memorial products.';

-- 11.3 Palliative Care
-- Maps to: Palliative Care | Vet Palliative Care Visit
UPDATE service_catalog
SET description = 'Comfort-focused palliative care including pain management and nutritional guidance. Includes: Comfort-focused treatment; Pain management; Nutritional support guidance. Excludes: Curative interventions; ICU care.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Palliative Care',
    'Vet Palliative Care Visit'
  )
  AND description IS DISTINCT FROM 'Comfort-focused palliative care including pain management and nutritional guidance. Includes: Comfort-focused treatment; Pain management; Nutritional support guidance. Excludes: Curative interventions; ICU care.';

-- 12.1 Wound Dressing
-- Maps to: Wound Dressing | Wound Dressing at Clinic | Wound Dressing at Home
UPDATE service_catalog
SET description = 'Wound cleaning, dressing replacement, and healing assessment. Includes: Wound cleaning; Dressing replacement; Healing assessment. Excludes: Surgical revision; Sedation unless necessary.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Wound Dressing',
    'Wound Dressing at Clinic',
    'Wound Dressing at Home'
  )
  AND description IS DISTINCT FROM 'Wound cleaning, dressing replacement, and healing assessment. Includes: Wound cleaning; Dressing replacement; Healing assessment. Excludes: Surgical revision; Sedation unless necessary.';

-- 12.2 IV Fluid Therapy
-- Maps to: IV Fluid Therapy | Vet IV Fluid
UPDATE service_catalog
SET description = 'IV catheter placement and fluid administration with basic monitoring. Includes: IV catheter placement; Fluid administration; Basic monitoring. Excludes: Overnight monitoring; ICU care; Advanced infusion therapy.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'IV Fluid Therapy',
    'Vet IV Fluid'
  )
  AND description IS DISTINCT FROM 'IV catheter placement and fluid administration with basic monitoring. Includes: IV catheter placement; Fluid administration; Basic monitoring. Excludes: Overnight monitoring; ICU care; Advanced infusion therapy.';

-- 12.3 Injection Administration
-- Maps to: Injection Administration
UPDATE service_catalog
SET description = 'Administration of injections with observation for immediate reactions. Includes: Injection administration; Observation for immediate reactions. Excludes: Medication cost; Emergency management of severe reactions.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Injection Administration'
  )
  AND description IS DISTINCT FROM 'Administration of injections with observation for immediate reactions. Includes: Injection administration; Observation for immediate reactions. Excludes: Medication cost; Emergency management of severe reactions.';

-- 12.4 Microchipping
-- Maps to: Micro-Chipping Service | Microchipping
UPDATE service_catalog
SET description = 'Microchip implantation with registration guidance. Includes: Microchip implantation; Registration guidance. Excludes: International registry fees.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Micro-Chipping Service',
    'Microchipping'
  )
  AND description IS DISTINCT FROM 'Microchip implantation with registration guidance. Includes: Microchip implantation; Registration guidance. Excludes: International registry fees.';

-- 13.2 Imaging Diagnostics
-- Maps to: Imaging- Radiology | Imaging- Advanced | Imaging- Ultrasonography | Ultrasound | Abdominal Ultrasound | Doppler Ultrasound | X-Ray (Single View) | X-Ray (Multiple Views) | Cardiac Diagnostics (2D Echo + Doppler)
UPDATE service_catalog
SET description = 'Imaging diagnostics including X-ray, ultrasound, echocardiography, CT, and MRI. Includes: Imaging procedure; Basic reporting. Excludes: Sedation charges; Specialist interpretation.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Imaging- Radiology',
    'Imaging- Advanced',
    'Imaging- Ultrasonography',
    'Ultrasound',
    'Abdominal Ultrasound',
    'Doppler Ultrasound',
    'X-Ray (Single View)',
    'X-Ray (Multiple Views)',
    'Cardiac Diagnostics (2D Echo + Doppler)'
  )
  AND description IS DISTINCT FROM 'Imaging diagnostics including X-ray, ultrasound, echocardiography, CT, and MRI. Includes: Imaging procedure; Basic reporting. Excludes: Sedation charges; Specialist interpretation.';

-- 13.3 Rapid In-Clinic Tests
-- Maps to: Rapid Tick Fever Panel
UPDATE service_catalog
SET description = 'Rapid in-clinic tests including tick fever panel, pregnancy test, and viral disease screening. Includes: Rapid test kit usage; Same-day reporting. Excludes: Confirmatory laboratory testing.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Rapid Tick Fever Panel'
  )
  AND description IS DISTINCT FROM 'Rapid in-clinic tests including tick fever panel, pregnancy test, and viral disease screening. Includes: Rapid test kit usage; Same-day reporting. Excludes: Confirmatory laboratory testing.';

-- 15.1 Health Certificate
-- Maps to: Health Certificate
UPDATE service_catalog
SET description = 'Physical examination and health certificate issuance. Includes: Physical examination; Certificate issuance. Excludes: Government endorsement fees; Export clearance.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Health Certificate'
  )
  AND description IS DISTINCT FROM 'Physical examination and health certificate issuance. Includes: Physical examination; Certificate issuance. Excludes: Government endorsement fees; Export clearance.';

-- 15.2 Fitness Certificate
-- Maps to: Fitness Certificate
UPDATE service_catalog
SET description = 'Clinical assessment and fitness certificate issuance. Includes: Clinical assessment; Certificate issuance. Excludes: Travel approvals.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Fitness Certificate'
  )
  AND description IS DISTINCT FROM 'Clinical assessment and fitness certificate issuance. Includes: Clinical assessment; Certificate issuance. Excludes: Travel approvals.';

-- 15.4 Pet Travel Documentation
-- Maps to: Pet Travel Documentation (Domestic / International)
UPDATE service_catalog
SET description = 'Pet travel documentation guidance and health review. Includes: Documentation guidance; Health review. Excludes: Government approvals; International quarantine support.',
    updated_at = NOW()
WHERE TRIM(display_name) IN (
    'Pet Travel Documentation (Domestic / International)'
  )
  AND description IS DISTINCT FROM 'Pet travel documentation guidance and health review. Includes: Documentation guidance; Health review. Excludes: Government approvals; International quarantine support.';

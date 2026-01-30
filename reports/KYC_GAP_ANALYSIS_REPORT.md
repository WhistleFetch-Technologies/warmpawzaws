# KYC Gap Analysis Report - Warmpawz Platform

**Generated:** January 28, 2026  
**Purpose:** Compare business KYC requirements against current onboarding forms  
**Scope:** All active service provider roles

---

## Executive Summary

This report analyzes the gap between the business-mandated KYC requirements and the current state of onboarding forms in the Warmpawz platform. The analysis covers:

1. **Field-by-field gap analysis** for each service provider type
2. **Automation opportunities** for KYC verification
3. **Hard blocks vs. soft blocks** implementation status
4. **Recommended changes** to match compliance requirements

### Key Findings

| Category | Current State | Required State | Gap Level |
|----------|---------------|----------------|-----------|
| Aadhaar Collection | ❌ Missing in most roles | ✅ Mandatory for all | **CRITICAL** |
| PAN Verification | ⚠️ Document upload only | ✅ API verification needed | **HIGH** |
| Bank Proof | ✅ Implemented | ✅ Verification exists | Low |
| Police Verification | ❌ Not implemented | ✅ Required for doorstep services | **CRITICAL** |
| Professional Registration | ⚠️ Partial | ✅ Role-specific needed | **MEDIUM** |
| Address Proof | ❌ Missing | ✅ Preferred for all | **MEDIUM** |
| Photo Upload | ⚠️ Optional | ✅ Mandatory for most | **MEDIUM** |

---

## Legend

| Symbol | Meaning |
|--------|---------|
| **M** | Mandatory - Hard block if not provided |
| **P** | Preferred - Soft block (allow onboarding, restrict visibility) |
| **C** | Conditional - Required based on turnover/registration status |
| **–** | Not Required |
| ✅ | Currently implemented |
| ❌ | Missing - needs to be added |
| ⚠️ | Partial implementation |

---

## Role-by-Role Gap Analysis

### 1. Dog Walker / Pet Walker (`pet_walker`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add aadhaar field + OTP verification | **CRITICAL** |
| PAN | **M** | ✅ `panCard` (file) | Add PAN number text field for API validation | HIGH |
| Bank Proof | **M** | ✅ `bankAccount` (bank-details type) | ✅ Complete | - |
| Photo | **M** | ❌ Missing | Add `profilePhoto` (file) | **HIGH** |
| Address Proof | **P** | ❌ Missing | Add `addressProof` (file) | MEDIUM |
| Police Verification | **M** | ❌ Missing | Add `policeVerificationDoc` (file) + status tracking | **CRITICAL** |
| Self-Declaration (No Criminal Record) | **M** | ❌ Missing | Add checkbox declaration | **HIGH** |

**Current Fields:** businessName, ownerName, phone, email, experience, maxDogsPerWalk, panCard, address, location, serviceArea, bankAccount

**Fields to Add:**
```json
[
  {"id": "aadhaarNumber", "label": "Aadhaar Number", "type": "text", "required": true, "validation": {"pattern": "^[0-9]{12}$"}, "section": "documents"},
  {"id": "aadhaarDoc", "label": "Aadhaar Card (Front & Back)", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "validation": {"pattern": "^[A-Z]{5}[0-9]{4}[A-Z]{1}$"}, "section": "documents"},
  {"id": "profilePhoto", "label": "Profile Photo (Passport Size)", "type": "file", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Address Proof", "type": "file", "required": false, "section": "documents"},
  {"id": "policeVerificationDoc", "label": "Police Verification Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "noCriminalRecordDeclaration", "label": "I declare that I have no criminal record", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 2. Pet Groomer - Solo (`pet_groomer` - solo)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add aadhaar field + OTP verification | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN number + document | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **M** | ❌ Missing | Add `profilePhoto` | **HIGH** |
| Address Proof | **P** | ❌ Missing | Add `addressProof` | MEDIUM |
| Police Verification | **M** | ❌ Missing | Add `policeVerificationDoc` | **CRITICAL** |
| Training Certificate | **P** | ⚠️ `groomingCertification` text only | Add document upload | MEDIUM |

**Fields to Add:**
```json
[
  {"id": "aadhaarNumber", "label": "Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "aadhaarDoc", "label": "Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "profilePhoto", "label": "Profile Photo", "type": "file", "required": true, "section": "documents"},
  {"id": "policeVerificationDoc", "label": "Police Verification Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "trainingCertificateDoc", "label": "Training Certificate (Recommended)", "type": "file", "required": false, "section": "documents"}
]
```

---

### 3. Pet Grooming Business (`pet_groomer` - business)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar (Owner) | **M** | ❌ Missing | Add owner's aadhaar | **CRITICAL** |
| PAN | **M** | ⚠️ Has `panNumber`/`panCard` in some configs | Standardize across all | HIGH |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **P** | ❌ Missing | Add business photo | MEDIUM |
| Address Proof | **P** | ❌ Missing | Add `addressProof` | MEDIUM |
| Business Registration / Shop Act | **M** | ⚠️ `gstCertificate` only | Add `shopActLicense` | **CRITICAL** |
| GST | **C** | ✅ `gstNumber` + `gstCertificate` | ✅ Complete (conditional) | - |
| Training Certificate | **P** | ⚠️ Text field only | Add document upload | MEDIUM |
| Municipal/Local Permission | **P** | ❌ Missing | Add `municipalPermission` | MEDIUM |
| Premises Hygiene Declaration | **M** | ❌ Missing | Add checkbox declaration | **HIGH** |

**Fields to Add:**
```json
[
  {"id": "ownerAadhaarNumber", "label": "Owner's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ownerAadhaarDoc", "label": "Owner's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "shopActLicense", "label": "Shop & Establishment License Number", "type": "text", "required": true, "section": "documents"},
  {"id": "shopActLicenseDoc", "label": "Shop & Establishment License", "type": "file", "required": true, "section": "documents"},
  {"id": "municipalPermission", "label": "Municipal/Local Permission (if applicable)", "type": "file", "required": false, "section": "documents"},
  {"id": "premisesHygieneDeclaration", "label": "I declare that premises meet hygiene standards", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 4. Veterinary Clinic (`veterinary_clinic`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar (Owner) | **M** | ❌ Missing | Add owner's aadhaar | **CRITICAL** |
| PAN | **M** | ⚠️ Has `panCard` file | Add PAN number text field | HIGH |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **P** | ❌ Missing | Add clinic/owner photo | MEDIUM |
| Address Proof | **M** | ❌ Missing | Add `addressProof` | **HIGH** |
| Business Registration / Shop Act | **M** | ❌ Missing | Add `shopActLicense` | **CRITICAL** |
| GST | **C** | ✅ `gstNumber` | ✅ Complete (conditional) | - |
| VCI Registration | **M** | ⚠️ `clinicLicense` only | Add `vciRegistrationNumber` + State Council | **CRITICAL** |
| State Council Registration | **M** | ❌ Missing | Add `stateCouncilRegistration` | **CRITICAL** |
| Degree Certificate | **M** | ❌ Missing | Add `degreeDoc` for owner/primary vet | **CRITICAL** |
| Municipal/Local Permission | **P** | ❌ Missing | Add `municipalPermission` | MEDIUM |

**Fields to Add:**
```json
[
  {"id": "ownerAadhaarNumber", "label": "Owner's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ownerAadhaarDoc", "label": "Owner's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Address Proof (Utility Bill/Rent Agreement)", "type": "file", "required": true, "section": "documents"},
  {"id": "shopActLicense", "label": "Shop & Establishment License", "type": "text", "required": true, "section": "documents"},
  {"id": "shopActLicenseDoc", "label": "Shop & Establishment Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "vciRegistrationNumber", "label": "VCI Registration Number", "type": "text", "required": true, "section": "professional"},
  {"id": "vciRegistrationDoc", "label": "VCI Registration Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "stateCouncilRegistration", "label": "State Veterinary Council Registration Number", "type": "text", "required": true, "section": "professional"},
  {"id": "stateCouncilDoc", "label": "State Council Registration Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "primaryVetDegree", "label": "Primary Veterinarian Degree Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "municipalPermission", "label": "Municipal/Local Permission (if applicable)", "type": "file", "required": false, "section": "documents"}
]
```

---

### 5. Pharmacy (`pet_pharmacy`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add owner's aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Address Proof | **M** | ❌ Missing | Add `addressProof` | **HIGH** |
| Business Registration / Shop Act | **M** | ❌ Missing | Add `shopActLicense` | **CRITICAL** |
| GST | **M** | ✅ `gstNumber` | ✅ Complete | - |
| Pharmacy License | **M** | ✅ `pharmacyLicense` + `pharmacyLicenseDoc` | ✅ Complete | - |
| Drug License | **M** | ❌ Missing | Add `drugLicense` | **CRITICAL** |
| Municipal Permission | **M** | ❌ Missing | Add `municipalPermission` | **HIGH** |

**Fields to Add:**
```json
[
  {"id": "ownerAadhaarNumber", "label": "Owner's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ownerAadhaarDoc", "label": "Owner's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Address Proof", "type": "file", "required": true, "section": "documents"},
  {"id": "shopActLicense", "label": "Shop & Establishment License", "type": "text", "required": true, "section": "documents"},
  {"id": "shopActLicenseDoc", "label": "Shop & Establishment Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "drugLicenseNumber", "label": "Drug License Number", "type": "text", "required": true, "section": "professional"},
  {"id": "drugLicenseDoc", "label": "Drug License Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "municipalPermission", "label": "Municipal Permission", "type": "file", "required": true, "section": "documents"}
]
```

---

### 6. Ethical Breeder (`pet_breeder`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar (Owner) | **M** | ❌ Missing | Add owner's aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Address Proof | **M** | ❌ Missing | Add `addressProof` | **HIGH** |
| Police Verification | **P** (Strongly Recommended) | ❌ Missing | Add `policeVerificationDoc` | **HIGH** |
| Business Registration | **C** | ❌ Missing | Add `businessRegistration` | MEDIUM |
| GST | **C** | ❌ Missing | Add `gstNumber` (conditional) | MEDIUM |
| AWBI/State Animal Welfare Registration | **M** | ❌ Missing | Add `awbiRegistration` | **CRITICAL** |
| Degree/Certification | **P** | ❌ Missing | Add breeding certification | MEDIUM |
| Local Body Permission | **P** | ❌ Missing | Add `localBodyPermission` | MEDIUM |
| Litter Registration | **M** | ❌ Missing | Add litter tracking | **CRITICAL** |
| Breeding Limits Declaration | **M** | ❌ Missing | Add declaration checkbox | **CRITICAL** |
| No Third-Party Sales Declaration | **M** | ❌ Missing | Add declaration checkbox | **CRITICAL** |

**Special Requirements:**
- Manual review required for approval
- Annual revalidation required
- Litter registration system needed

**Fields to Add:**
```json
[
  {"id": "ownerAadhaarNumber", "label": "Owner's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ownerAadhaarDoc", "label": "Owner's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Address Proof", "type": "file", "required": true, "section": "documents"},
  {"id": "policeVerificationDoc", "label": "Police Verification Certificate (Strongly Recommended)", "type": "file", "required": false, "section": "documents"},
  {"id": "awbiRegistration", "label": "AWBI / State Animal Welfare Registration Number", "type": "text", "required": true, "section": "professional"},
  {"id": "awbiRegistrationDoc", "label": "AWBI / State Animal Welfare Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "localBodyPermission", "label": "Local Body / Panchayat Permission (if applicable)", "type": "file", "required": false, "section": "documents"},
  {"id": "breedingExperience", "label": "Breeding Experience (Years)", "type": "number", "required": true, "section": "professional"},
  {"id": "breedingLimitsDeclaration", "label": "I agree to follow ethical breeding limits as per platform guidelines", "type": "checkbox", "required": true, "section": "declarations"},
  {"id": "noThirdPartySalesDeclaration", "label": "I declare that I will not engage in third-party reselling or brokering of pets", "type": "checkbox", "required": true, "section": "declarations"},
  {"id": "annualRevalidationConsent", "label": "I consent to annual revalidation of my registration", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 7. Veterinarian - Solo (`veterinarian`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add aadhaar | **CRITICAL** |
| PAN | **M** | ✅ `panCard` | Add PAN number text field | HIGH |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **M** | ❌ Missing | Add `profilePhoto` | **HIGH** |
| Address Proof | **P** | ❌ Missing | Add `addressProof` | MEDIUM |
| VCI Registration | **M** | ⚠️ `vetLicense` only | Need separate VCI + State Council | **CRITICAL** |
| State Council Registration | **M** | ❌ Missing | Add `stateCouncilRegistration` | **CRITICAL** |
| Degree Certificate | **M** | ❌ Missing | Add `degreeDoc` | **CRITICAL** |
| Indemnity Insurance | **P** (Recommended) | ❌ Missing | Add `indemnityInsurance` | MEDIUM |

**Fields to Add:**
```json
[
  {"id": "aadhaarNumber", "label": "Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "aadhaarDoc", "label": "Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "profilePhoto", "label": "Profile Photo", "type": "file", "required": true, "section": "documents"},
  {"id": "vciRegistrationNumber", "label": "VCI Registration Number", "type": "text", "required": true, "section": "professional"},
  {"id": "vciRegistrationDoc", "label": "VCI Registration Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "stateCouncilRegistration", "label": "State Veterinary Council Registration", "type": "text", "required": true, "section": "professional"},
  {"id": "stateCouncilDoc", "label": "State Council Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "degreeDoc", "label": "Veterinary Degree Certificate (BVSc/MVSc)", "type": "file", "required": true, "section": "documents"},
  {"id": "indemnityInsuranceDoc", "label": "Professional Indemnity Insurance (Recommended)", "type": "file", "required": false, "section": "documents"}
]
```

---

### 8. Pet Boarding / Kennel (`pet_boarding`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar (Owner) | **M** | ❌ Missing | Add owner's aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Address Proof | **M** | ❌ Missing | Add `addressProof` | **HIGH** |
| Business Registration / Shop Act | **M** | ⚠️ `businessLicense` | Need `shopActLicense` specifically | HIGH |
| GST | **C** | ✅ `gstNumber` | ✅ Complete (conditional) | - |
| Municipal/Local Permission | **P** | ❌ Missing | Add `municipalPermission` | MEDIUM |
| Vet Tie-up Declaration | **M** | ❌ Missing | Add declaration + vet details | **CRITICAL** |

**Fields to Add:**
```json
[
  {"id": "ownerAadhaarNumber", "label": "Owner's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ownerAadhaarDoc", "label": "Owner's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Address Proof (Utility Bill/Rent Agreement)", "type": "file", "required": true, "section": "documents"},
  {"id": "shopActLicense", "label": "Shop & Establishment License", "type": "text", "required": true, "section": "documents"},
  {"id": "shopActLicenseDoc", "label": "Shop & Establishment Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "municipalPermission", "label": "Municipal/Local Permission (if applicable)", "type": "file", "required": false, "section": "documents"},
  {"id": "vetTieUpName", "label": "Associated Veterinarian Name", "type": "text", "required": true, "section": "professional"},
  {"id": "vetTieUpContact", "label": "Associated Veterinarian Contact", "type": "tel", "required": true, "section": "professional"},
  {"id": "vetTieUpDeclaration", "label": "I confirm we have a tie-up with a licensed veterinarian for emergency care", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 9. Pet Nutritionist - Non-Medical (`nutritionist`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **M** | ❌ Missing | Add `profilePhoto` | **HIGH** |
| Address Proof | **P** | ❌ Missing | Add `addressProof` | MEDIUM |
| Degree/Certification | **P** | ✅ `certification` + `certificationDoc` | ✅ Complete | - |
| Non-Medical Advice Declaration | **M** | ❌ Missing | Add declaration | **CRITICAL** |

**Fields to Add:**
```json
[
  {"id": "aadhaarNumber", "label": "Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "aadhaarDoc", "label": "Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "profilePhoto", "label": "Profile Photo", "type": "file", "required": true, "section": "documents"},
  {"id": "nonMedicalAdviceDeclaration", "label": "I declare that I provide non-medical nutritional advice only and will not make clinical claims", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 10. Pet Nutritionist - Medical (Requires VCI)

**Note:** This is a sub-variant requiring veterinary qualification. Consider creating a separate role `nutritionist_medical` or adding conditional fields based on service type selection.

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| All of Non-Medical | **M** | - | Same as above | - |
| VCI Registration | **M** | ❌ Missing | Add VCI fields | **CRITICAL** |
| Medical Degree | **M** | ❌ Missing | Add `degreeDoc` | **CRITICAL** |
| Vet Association Declaration | **M** | ❌ Missing | Add declaration | **CRITICAL** |

---

### 11. Pet Trainer - Solo (`pet_trainer`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **M** | ❌ Missing | Add `profilePhoto` | **HIGH** |
| Address Proof | **P** | ❌ Missing | Add `addressProof` | MEDIUM |
| Police Verification | **P** | ❌ Missing | Add `policeVerificationDoc` | **HIGH** |
| Degree/Certification | **P** | ✅ `trainingCertification` + `certificationDoc` | ✅ Complete | - |
| Experience Declaration | **M** | ⚠️ Has `experience` field | Add declaration checkbox | MEDIUM |

**Fields to Add:**
```json
[
  {"id": "aadhaarNumber", "label": "Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "aadhaarDoc", "label": "Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "profilePhoto", "label": "Profile Photo", "type": "file", "required": true, "section": "documents"},
  {"id": "policeVerificationDoc", "label": "Police Verification Certificate (Recommended)", "type": "file", "required": false, "section": "documents"},
  {"id": "experienceDeclaration", "label": "I declare that my stated experience is accurate and can provide references if required", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 12. Pet Behaviourist - Non-Medical (`pet_behaviorist`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar | **M** | ❌ Missing | Add aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **M** | ❌ Missing | Add `profilePhoto` | **HIGH** |
| Address Proof | **P** | ❌ Missing | Add `addressProof` | MEDIUM |
| Degree/Certification | **P** | ❌ Missing | Add certification fields | MEDIUM |
| No Clinical Claims Declaration | **M** | ❌ Missing | Add declaration | **CRITICAL** |

**Fields to Add:**
```json
[
  {"id": "aadhaarNumber", "label": "Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "aadhaarDoc", "label": "Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "profilePhoto", "label": "Profile Photo", "type": "file", "required": true, "section": "documents"},
  {"id": "behaviorCertificationDoc", "label": "Behavior Certification (if any)", "type": "file", "required": false, "section": "documents"},
  {"id": "noClinicalClaimsDeclaration", "label": "I declare that I will not make clinical claims or provide medical diagnosis", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

### 13. Pet Adoption NGO / Shelter (`pet_shelter`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar (Authorized Signatory) | **M** | ❌ Missing | Add signatory's aadhaar | **CRITICAL** |
| PAN (NGO) | **M** | ❌ Missing | Add NGO PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Address Proof | **M** | ❌ Missing | Add `addressProof` | **HIGH** |
| NGO Registration (Trust/Society/Sec 8) | **M** | ⚠️ `registrationNumber` + `registrationDoc` | Specify registration type | HIGH |
| AWBI Registration | **P** | ❌ Missing | Add `awbiRegistration` | **HIGH** |
| Adoption Policy Document | **M** | ❌ Missing | Add `adoptionPolicyDoc` | **CRITICAL** |

**Note:** NGOs cannot onboard as individuals - must be organization type.

**Fields to Add:**
```json
[
  {"id": "authorizedSignatoryAadhaar", "label": "Authorized Signatory's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "authorizedSignatoryAadhaarDoc", "label": "Authorized Signatory's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "ngoPanNumber", "label": "NGO PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ngoPanDoc", "label": "NGO PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Registered Address Proof", "type": "file", "required": true, "section": "documents"},
  {"id": "ngoRegistrationType", "label": "Registration Type", "type": "select", "required": true, "options": ["Trust", "Society", "Section 8 Company"], "section": "professional"},
  {"id": "awbiRegistration", "label": "AWBI Registration Number (if applicable)", "type": "text", "required": false, "section": "professional"},
  {"id": "awbiRegistrationDoc", "label": "AWBI Registration Certificate", "type": "file", "required": false, "section": "documents"},
  {"id": "adoptionPolicyDoc", "label": "Adoption Policy Document", "type": "file", "required": true, "section": "documents"}
]
```

---

### 14. Pet Funeral Service (`pet_sunset_services`)

| KYC Field | Business Requirement | Current State | Gap | Priority |
|-----------|---------------------|---------------|-----|----------|
| Aadhaar (Owner) | **M** | ❌ Missing | Add owner's aadhaar | **CRITICAL** |
| PAN | **M** | ❌ Missing | Add PAN | **CRITICAL** |
| Bank Proof | **M** | ✅ `bankAccount` | ✅ Complete | - |
| Photo | **P** | ❌ Missing | Add `businessPhoto` | MEDIUM |
| Address Proof | **M** | ❌ Missing | Add `addressProof` | **HIGH** |
| Business Registration / Shop Act | **M** | ❌ Missing | Add `shopActLicense` | **CRITICAL** |
| GST | **C** | ❌ Missing | Add `gstNumber` (conditional) | MEDIUM |
| Municipal Permission | **P** | ❌ Missing | Add `municipalPermission` | **HIGH** |
| Environmental Compliance SOP | **M** | ❌ Missing | Add SOP document | **CRITICAL** |

**Fields to Add:**
```json
[
  {"id": "ownerAadhaarNumber", "label": "Owner's Aadhaar Number", "type": "text", "required": true, "section": "documents"},
  {"id": "ownerAadhaarDoc", "label": "Owner's Aadhaar Card", "type": "file", "required": true, "section": "documents"},
  {"id": "panNumber", "label": "PAN Number", "type": "text", "required": true, "section": "documents"},
  {"id": "panCard", "label": "PAN Card", "type": "file", "required": true, "section": "documents"},
  {"id": "addressProof", "label": "Address Proof", "type": "file", "required": true, "section": "documents"},
  {"id": "shopActLicense", "label": "Shop & Establishment License", "type": "text", "required": true, "section": "documents"},
  {"id": "shopActLicenseDoc", "label": "Shop & Establishment Certificate", "type": "file", "required": true, "section": "documents"},
  {"id": "municipalPermission", "label": "Municipal Permission (for cremation/burial services)", "type": "file", "required": false, "section": "documents"},
  {"id": "environmentalComplianceSOP", "label": "Environmental Compliance SOP Document", "type": "file", "required": true, "section": "documents"},
  {"id": "environmentalComplianceDeclaration", "label": "I declare compliance with environmental regulations for pet cremation/burial", "type": "checkbox", "required": true, "section": "declarations"}
]
```

---

## Automation Opportunities

### 1. Aadhaar OTP Verification (HIGH PRIORITY)

**Implementation:** Integrate with UIDAI API for real-time Aadhaar verification

| Component | Details |
|-----------|---------|
| **API Provider** | UIDAI via licensed ASA (Authentication Service Agency) |
| **Verification Types** | OTP-based, Biometric (optional) |
| **Data Verified** | Name, DOB, Address, Photo matching |
| **Cost** | ~₹5-10 per verification |
| **Integration Partners** | Signzy, Digio, IDfy, Karza |

**Implementation Steps:**
1. Add Aadhaar number field with 12-digit validation
2. On submit, trigger OTP to registered mobile
3. Verify OTP response from UIDAI
4. Store verification status and timestamp
5. Auto-populate name/address from Aadhaar response

**Database Changes Required:**
```sql
ALTER TABLE vendor_documents ADD COLUMN aadhaar_verified BOOLEAN DEFAULT false;
ALTER TABLE vendor_documents ADD COLUMN aadhaar_verified_at TIMESTAMPTZ;
ALTER TABLE vendor_documents ADD COLUMN aadhaar_verification_reference TEXT;
```

---

### 2. PAN Verification API (HIGH PRIORITY)

**Implementation:** Integrate with NSDL/Income Tax API for PAN verification

| Component | Details |
|-----------|---------|
| **API Provider** | NSDL, Karza, Signzy |
| **Data Verified** | PAN number validity, Name matching, Status (active/inactive) |
| **Cost** | ~₹2-5 per verification |
| **Real-time** | Yes |

**Implementation Steps:**
1. Add PAN number field with regex validation (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`)
2. On field blur/submit, call PAN verification API
3. Compare returned name with provided name
4. Flag mismatches for manual review

**Database Changes Required:**
```sql
ALTER TABLE vendors ADD COLUMN pan_verified BOOLEAN DEFAULT false;
ALTER TABLE vendors ADD COLUMN pan_verified_at TIMESTAMPTZ;
ALTER TABLE vendors ADD COLUMN pan_verification_reference TEXT;
ALTER TABLE vendors ADD COLUMN pan_name_match_score DECIMAL(5,2);
```

---

### 3. Bank Account Verification (EXISTING - ENHANCE)

**Current State:** Partial implementation exists via Razorpay Marketplace API

**Enhancement:**
1. Use Penny Drop verification for instant account validation
2. Verify account holder name matches PAN name
3. Store IFSC-validated bank name

**API Providers:** Razorpay, Cashfree, Decentro

---

### 4. GST Verification API (MEDIUM PRIORITY)

**Implementation:** Integrate with GSTN API for GST number verification

| Component | Details |
|-----------|---------|
| **API Provider** | GSTN via licensed GSP, Karza, ClearTax |
| **Data Verified** | GSTIN validity, Legal name, Registration status, State |
| **Cost** | ~₹1-3 per verification |

**Implementation Steps:**
1. Add GSTIN field with regex validation
2. Call GSTIN verification API on submit
3. Auto-populate business name and state
4. Verify status is "Active"

---

### 5. Police Verification Status Tracking (CRITICAL for Doorstep Services)

**Note:** Police verification cannot be fully automated but can be facilitated

**Implementation:**
1. Add police verification document upload
2. Integrate with state police portals where APIs exist (Delhi, Karnataka, Maharashtra)
3. Track verification status (Pending, Submitted, Verified, Rejected)
4. Set soft-block until verified for doorstep service roles

**Workflow:**
```
Provider uploads → Platform verifies document authenticity → 
Status updated → If pending > 30 days, visibility restricted
```

---

### 6. Professional License Verification

**For Veterinarians (VCI):**
- VCI maintains a searchable database at https://www.vci.nic.in/
- Manual verification initially, explore API partnership

**For Pharmacists:**
- State Pharmacy Council databases
- Drug License verification via state drug controller

**Recommendation:** Start with manual verification + document upload, explore API integrations phase 2

---

## Hard Block vs. Soft Block Implementation

### Hard Blocks (Cannot Complete Onboarding Without)

These fields should prevent application submission if not provided:

| Field | Applicable Roles | Implementation |
|-------|-----------------|----------------|
| Aadhaar | All roles | Required field, API verification |
| PAN | All roles | Required field, API verification |
| Bank Account | All roles | Required field, Penny Drop verification |
| VCI + State Council Registration | Veterinarian, Vet Clinic, Medical Nutritionist, Medical Behaviourist | Required field |
| Shop & Establishment | All business/center roles | Required field |
| NGO Registration | Pet Shelter/Adoption NGO | Required field |
| Pharmacy License | Pharmacy | Required field |
| Drug License | Pharmacy | Required field |
| AWBI Registration | Breeder, NGO | Required field for Breeder, Preferred for NGO |

### Soft Blocks (Allow Onboarding, Restrict Visibility/Bookings)

These fields allow onboarding but restrict platform features until provided:

| Field | Applicable Roles | Restriction |
|-------|-----------------|-------------|
| Police Verification | Walker, Groomer (Solo), Trainer, Sitter | Cannot appear in search until verified |
| Training/Experience Certificates | Groomer, Trainer | Lower search ranking |
| Municipal/Local Permissions | All business roles | Warning badge on profile |
| AWBI Registration | NGOs | Limited visibility |
| Address Proof | All roles | Cannot offer doorstep services |

---

## New Database Tables/Columns Required

### 1. Vendor KYC Status Table

```sql
CREATE TABLE vendor_kyc_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    
    -- Aadhaar
    aadhaar_number_encrypted TEXT,
    aadhaar_verified BOOLEAN DEFAULT false,
    aadhaar_verified_at TIMESTAMPTZ,
    aadhaar_verification_reference TEXT,
    
    -- PAN
    pan_number TEXT,
    pan_verified BOOLEAN DEFAULT false,
    pan_verified_at TIMESTAMPTZ,
    pan_name_match_score DECIMAL(5,2),
    
    -- Police Verification
    police_verification_status TEXT DEFAULT 'not_submitted' 
        CHECK (police_verification_status IN ('not_submitted', 'submitted', 'pending', 'verified', 'rejected', 'expired')),
    police_verification_doc_url TEXT,
    police_verification_expiry DATE,
    
    -- Professional Registration
    vci_registration_number TEXT,
    vci_verified BOOLEAN DEFAULT false,
    state_council_registration TEXT,
    state_council_verified BOOLEAN DEFAULT false,
    
    -- Business Registration
    shop_act_license_number TEXT,
    shop_act_verified BOOLEAN DEFAULT false,
    
    -- AWBI (for breeders/NGOs)
    awbi_registration_number TEXT,
    awbi_verified BOOLEAN DEFAULT false,
    
    -- Overall Status
    kyc_status TEXT DEFAULT 'pending' 
        CHECK (kyc_status IN ('pending', 'partial', 'complete', 'expired', 'rejected')),
    kyc_score INTEGER DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vendor_kyc_vendor_id ON vendor_kyc_status(vendor_id);
CREATE INDEX idx_vendor_kyc_status ON vendor_kyc_status(kyc_status);
```

### 2. Vendor Declarations Table

```sql
CREATE TABLE vendor_declarations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    declaration_type TEXT NOT NULL,
    declaration_text TEXT NOT NULL,
    accepted BOOLEAN NOT NULL,
    accepted_at TIMESTAMPTZ,
    ip_address TEXT,
    user_agent TEXT,
    
    UNIQUE(vendor_id, declaration_type)
);

-- Common declaration types:
-- 'no_criminal_record'
-- 'non_medical_advice'
-- 'no_clinical_claims'
-- 'breeding_limits'
-- 'no_third_party_sales'
-- 'premises_hygiene'
-- 'vet_tie_up'
-- 'environmental_compliance'
-- 'annual_revalidation_consent'
```

---

## Implementation Priority Matrix

### Phase 1: Critical (Immediate - 2 weeks)

| Task | Effort | Impact |
|------|--------|--------|
| Add Aadhaar fields to all forms | Medium | High |
| Add PAN number + document fields | Low | High |
| Add Police Verification fields for doorstep roles | Medium | High |
| Add VCI + State Council fields for vets | Low | Critical |
| Add mandatory declarations for all roles | Medium | High |

### Phase 2: High Priority (4 weeks)

| Task | Effort | Impact |
|------|--------|--------|
| Integrate Aadhaar OTP verification API | High | High |
| Integrate PAN verification API | Medium | High |
| Add Shop Act License fields for businesses | Low | High |
| Implement soft-block logic for police verification | Medium | High |
| Add AWBI fields for breeders | Low | Critical |

### Phase 3: Medium Priority (8 weeks)

| Task | Effort | Impact |
|------|--------|--------|
| GST verification API integration | Medium | Medium |
| Address proof collection and verification | Medium | Medium |
| Municipal permission tracking | Low | Medium |
| Professional license verification workflow | High | Medium |
| Annual revalidation system for breeders | Medium | High |

### Phase 4: Enhancement (Ongoing)

| Task | Effort | Impact |
|------|--------|--------|
| VCI database integration | High | Medium |
| State pharmacy council integration | High | Medium |
| Automated document OCR and extraction | High | Medium |
| KYC score dashboard for admin | Medium | Low |

---

## Summary: Fields to Add Per Role

| Role | Missing Critical Fields | Missing Preferred Fields |
|------|------------------------|-------------------------|
| Dog Walker | Aadhaar, Photo, Police Verification, Self-Declaration | Address Proof |
| Pet Groomer (Solo) | Aadhaar, PAN, Photo, Police Verification | Address Proof, Training Cert |
| Pet Grooming Business | Owner Aadhaar, Shop Act License, Hygiene Declaration | Municipal Permission |
| Veterinary Clinic | Owner Aadhaar, VCI, State Council, Degree, Shop Act, Address Proof | Municipal Permission |
| Pharmacy | Owner Aadhaar, PAN, Drug License, Shop Act, Address Proof, Municipal | - |
| Ethical Breeder | Owner Aadhaar, PAN, AWBI, Address Proof, Litter Tracking, Declarations | Police Verification |
| Veterinarian (Solo) | Aadhaar, Photo, VCI, State Council, Degree | Address Proof, Indemnity Insurance |
| Pet Boarding | Owner Aadhaar, PAN, Shop Act, Address Proof, Vet Tie-up Declaration | Municipal Permission |
| Pet Nutritionist | Aadhaar, PAN, Photo, Non-Medical Declaration | Address Proof |
| Pet Trainer | Aadhaar, PAN, Photo, Experience Declaration | Police Verification |
| Pet Behaviourist | Aadhaar, PAN, Photo, No Clinical Claims Declaration | Certification |
| Pet Shelter/NGO | Signatory Aadhaar, NGO PAN, Address Proof, Adoption Policy | AWBI Registration |
| Pet Funeral | Owner Aadhaar, PAN, Shop Act, Address Proof, Environmental SOP | Municipal Permission |

---

## Conclusion

The current onboarding system has significant gaps in KYC compliance compared to the business requirements. The most critical gaps are:

1. **Aadhaar collection and verification** - Missing across all roles
2. **Police verification** - Missing for doorstep service providers
3. **Professional registration (VCI/State Council)** - Incomplete for veterinary roles
4. **Mandatory declarations** - Not implemented
5. **AWBI registration** - Missing for breeders

Implementing these changes will require:
- Form schema updates for all 14 analyzed roles
- New database tables for KYC status tracking
- API integrations for automated verification
- Admin dashboard updates for verification workflow
- Soft-block logic implementation

The recommended approach is a phased rollout starting with critical compliance items (Aadhaar, Police Verification for doorstep services, Professional registrations for healthcare) followed by automation integrations.

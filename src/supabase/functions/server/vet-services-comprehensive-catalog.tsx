/**
 * Comprehensive Veterinary Services Catalog
 * Organized by specializations and service types for Veterinarians and Vet Clinics
 * 
 * This catalog is designed to:
 * 1. Help customers find the right vet based on their need
 * 2. Allow vets to enable only services matching their specialization
 * 3. Organize services hierarchically for better management
 */

export const veterinaryServicesCatalog = {
  categoryId: 'cat_healthcare',
  categoryName: 'Healthcare Service Providers',
  
  // Sub-categories representing different service areas
  subCategories: [
    {
      id: 'sub_preventive_wellness',
      name: 'Preventive & Wellness Care',
      description: 'Routine healthcare and preventive treatments',
      icon: '🏥',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_routine_health',
          groupName: '1.1 Routine Health Care',
          services: [
            {
              code: 'VET-GEN-001',
              serviceName: 'General Health Check-up',
              description: 'Complete physical examination and health assessment',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ANN-002',
              serviceName: 'Annual Wellness Exam',
              description: 'Comprehensive yearly health screening',
              basePrice: 800,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PUP-003',
              serviceName: 'Puppy/Kitten Wellness Program',
              description: 'Complete wellness package for young pets',
              basePrice: 1500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SEN-004',
              serviceName: 'Senior Pet Wellness',
              description: 'Specialized care for senior pets (7+ years)',
              basePrice: 1200,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_preventive_treatments',
          groupName: '1.2 Preventive Treatments',
          services: [
            {
              code: 'VET-VAC-005',
              serviceName: 'Vaccination',
              description: 'Preventive vaccination (DHPP, Rabies, etc.)',
              basePrice: 600,
              duration: '15 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-DEW-006',
              serviceName: 'Deworming',
              description: 'Internal parasite treatment',
              basePrice: 300,
              duration: '15 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-FTP-007',
              serviceName: 'Flea/Tick/Parasite Prevention',
              description: 'External parasite prevention treatment',
              basePrice: 400,
              duration: '15 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HW-008',
              serviceName: 'Heartworm Prevention',
              description: 'Heartworm prevention medication',
              basePrice: 500,
              duration: '15 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_wellness_addons',
          groupName: '1.3 Wellness Add-ons',
          services: [
            {
              code: 'VET-NUT-009',
              serviceName: 'Nutritional Counselling',
              description: 'Diet planning and nutritional advice',
              basePrice: 400,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-WM-010',
              serviceName: 'Weight Management',
              description: 'Weight control and obesity management',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-BEH-011',
              serviceName: 'Behavioural Counselling',
              description: 'Pet behavior assessment and training guidance',
              basePrice: 600,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_diagnostics',
      name: 'Diagnostics',
      description: 'Laboratory tests and imaging services',
      icon: '🔬',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_lab_tests',
          groupName: '2.1 Laboratory Tests',
          services: [
            {
              code: 'VET-CBC-012',
              serviceName: 'Complete Blood Count (CBC)',
              description: 'Comprehensive blood cell analysis',
              basePrice: 800,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-LIV-013',
              serviceName: 'Liver Function Test',
              description: 'Liver enzyme and function analysis',
              basePrice: 1000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-KID-014',
              serviceName: 'Kidney Function Test',
              description: 'Kidney health assessment',
              basePrice: 1000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-THY-015',
              serviceName: 'Thyroid Panel',
              description: 'Thyroid hormone level testing',
              basePrice: 1200,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-URI-016',
              serviceName: 'Urine Test',
              description: 'Urinalysis for kidney and bladder health',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-STO-017',
              serviceName: 'Stool Test',
              description: 'Fecal examination for parasites',
              basePrice: 400,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SKN-018',
              serviceName: 'Skin Scrapings',
              description: 'Skin sample test for parasites/fungi',
              basePrice: 600,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HOR-019',
              serviceName: 'Hormone Panels',
              description: 'Comprehensive hormone level testing',
              basePrice: 1500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_imaging',
          groupName: '2.2 Imaging',
          services: [
            {
              code: 'VET-XRY-020',
              serviceName: 'X-Ray',
              description: 'Digital radiography imaging',
              basePrice: 1500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-USG-021',
              serviceName: 'Ultrasound',
              description: 'Abdominal or cardiac ultrasound',
              basePrice: 2500,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ECG-022',
              serviceName: 'ECG',
              description: 'Electrocardiogram for heart health',
              basePrice: 1200,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-BP-023',
              serviceName: 'Blood Pressure Monitoring',
              description: 'Blood pressure measurement and monitoring',
              basePrice: 500,
              duration: '15 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_special_diagnostics',
          groupName: '2.3 Special Diagnostics',
          services: [
            {
              code: 'VET-ALL-024',
              serviceName: 'Allergy Panel',
              description: 'Comprehensive allergy testing',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-GEN-025',
              serviceName: 'Genetic Testing',
              description: 'DNA testing for breed and health conditions',
              basePrice: 3000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-BIO-026',
              serviceName: 'Biopsy / Cytology',
              description: 'Tissue sample examination',
              basePrice: 2500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_medical_treatment',
      name: 'Medical Treatment (Non-Surgical)',
      description: 'General and specialized medical care',
      icon: '💊',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_general_medical',
          groupName: '3.1 General Medical Care',
          services: [
            {
              code: 'VET-FEV-027',
              serviceName: 'Fever, Infection, Weakness Treatment',
              description: 'Treatment for common ailments',
              basePrice: 600,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-GI-028',
              serviceName: 'GI Treatment (Vomiting, Diarrhea)',
              description: 'Gastrointestinal issue management',
              basePrice: 700,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-EAR-029',
              serviceName: 'Ear/Eye Issues Treatment',
              description: 'Treatment for ear and eye conditions',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-RES-030',
              serviceName: 'Respiratory Issues Treatment',
              description: 'Treatment for breathing and respiratory problems',
              basePrice: 800,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PAIN-031',
              serviceName: 'Pain Management',
              description: 'Pain relief and management',
              basePrice: 600,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_chronic_conditions',
          groupName: '3.2 Chronic Conditions',
          services: [
            {
              code: 'VET-DIA-032',
              serviceName: 'Diabetes Management',
              description: 'Ongoing diabetes care and monitoring',
              basePrice: 1000,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-KDL-033',
              serviceName: 'Kidney/Liver Disease Treatment',
              description: 'Management of kidney and liver conditions',
              basePrice: 1200,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-THYD-034',
              serviceName: 'Thyroid Disorders Treatment',
              description: 'Management of thyroid conditions',
              basePrice: 1000,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ART-035',
              serviceName: 'Arthritis/Joint Treatment',
              description: 'Management of joint pain and arthritis',
              basePrice: 900,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_specialty_medical',
          groupName: '3.3 Specialty Medical Care',
          services: [
            {
              code: 'VET-DERM-036',
              serviceName: 'Dermatology Care',
              description: 'Specialized skin and coat treatment',
              basePrice: 1200,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-CARD-037',
              serviceName: 'Cardiology Care',
              description: 'Heart condition diagnosis and treatment',
              basePrice: 1500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ONC-038',
              serviceName: 'Oncology Consultations',
              description: 'Cancer diagnosis and treatment planning',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-IM-039',
              serviceName: 'Internal Medicine (Complex Cases)',
              description: 'Advanced internal medicine consultation',
              basePrice: 1800,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_surgical_services',
      name: 'Surgical Services',
      description: 'Soft tissue, orthopedic, and emergency surgeries',
      icon: '🏥',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_soft_tissue',
          groupName: '4.1 Soft Tissue Surgeries',
          services: [
            {
              code: 'VET-SPAY-040',
              serviceName: 'Spay (Ovariohysterectomy)',
              description: 'Female pet sterilization surgery',
              basePrice: 3500,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-NEUT-041',
              serviceName: 'Neuter (Castration)',
              description: 'Male pet sterilization surgery',
              basePrice: 2500,
              duration: '1.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-WND-042',
              serviceName: 'Wound Repair',
              description: 'Surgical wound closure and repair',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-TUM-043',
              serviceName: 'Tumor Removal',
              description: 'Surgical removal of tumors/masses',
              basePrice: 5000,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HERN-044',
              serviceName: 'Hernia Repair',
              description: 'Surgical hernia correction',
              basePrice: 4000,
              duration: '1.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_orthopedic',
          groupName: '4.2 Orthopedic Surgeries',
          services: [
            {
              code: 'VET-FRAC-045',
              serviceName: 'Fracture Repair',
              description: 'Bone fracture fixation surgery',
              basePrice: 8000,
              duration: '3 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ACL-046',
              serviceName: 'Cruciate Ligament Surgery',
              description: 'ACL/CCL repair surgery',
              basePrice: 15000,
              duration: '3 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HIP-047',
              serviceName: 'Hip/Joint Surgeries',
              description: 'Hip dysplasia and joint surgeries',
              basePrice: 20000,
              duration: '4 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_dental_surgery',
          groupName: '4.3 Dental Surgery',
          services: [
            {
              code: 'VET-TETH-048',
              serviceName: 'Tooth Extraction',
              description: 'Removal of damaged/diseased teeth',
              basePrice: 1500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ORAL-049',
              serviceName: 'Oral Mass Removal',
              description: 'Surgical removal of oral tumors/masses',
              basePrice: 3500,
              duration: '1.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_emergency_surgery',
          groupName: '4.4 Emergency Surgeries',
          services: [
            {
              code: 'VET-FB-050',
              serviceName: 'Foreign Body Removal',
              description: 'Emergency removal of ingested objects',
              basePrice: 10000,
              duration: '3 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-TRAU-051',
              serviceName: 'Trauma Surgery',
              description: 'Emergency surgery for traumatic injuries',
              basePrice: 12000,
              duration: '3 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-CSEC-052',
              serviceName: 'C-section',
              description: 'Emergency cesarean section',
              basePrice: 8000,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_specialty_services',
      name: 'Specialty Vet Services',
      description: 'Specialized medical services and reproductive care',
      icon: '⚕️',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_system_specialists',
          groupName: '5.1 System Specialists',
          services: [
            {
              code: 'VET-SPEC-DERM-053',
              serviceName: 'Dermatology Specialist Consultation',
              description: 'Advanced skin condition treatment',
              basePrice: 1500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SPEC-CARD-054',
              serviceName: 'Cardiology Specialist Consultation',
              description: 'Advanced heart condition treatment',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SPEC-NEUR-055',
              serviceName: 'Neurology Specialist Consultation',
              description: 'Neurological condition diagnosis and treatment',
              basePrice: 2500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SPEC-ONC-056',
              serviceName: 'Oncology Specialist Consultation',
              description: 'Cancer treatment specialist',
              basePrice: 2500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SPEC-OPH-057',
              serviceName: 'Ophthalmology Specialist Consultation',
              description: 'Eye specialist consultation and treatment',
              basePrice: 1800,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SPEC-ORTH-058',
              serviceName: 'Orthopedics Specialist Consultation',
              description: 'Bone and joint specialist',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SPEC-IM-059',
              serviceName: 'Internal Medicine Specialist',
              description: 'Complex internal medicine cases',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_reproductive',
          groupName: '5.2 Reproductive Services',
          services: [
            {
              code: 'VET-BREED-060',
              serviceName: 'Breeding Consultation',
              description: 'Breeding planning and guidance',
              basePrice: 1000,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PREG-061',
              serviceName: 'Pregnancy Diagnosis',
              description: 'Pregnancy confirmation and monitoring',
              basePrice: 800,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-AI-062',
              serviceName: 'Artificial Insemination',
              description: 'AI procedure for breeding',
              basePrice: 3000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-NEO-063',
              serviceName: 'Neonatal Care',
              description: 'Newborn pet care and monitoring',
              basePrice: 1200,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_dental_care',
          groupName: '5.3 Dental Care',
          services: [
            {
              code: 'VET-DSCALE-064',
              serviceName: 'Dental Scaling & Cleaning',
              description: 'Professional teeth cleaning',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-ORAL-065',
              serviceName: 'Oral Health Assessment',
              description: 'Comprehensive dental examination',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_emergency_critical',
      name: '6. Emergency & Critical Care',
      description: 'Emergency response and critical monitoring',
      icon: '🚑',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_emergency_response',
          groupName: '6.1 Emergency Response',
          services: [
            {
              code: 'VET-ETRAU-066',
              serviceName: 'Trauma Emergency',
              description: 'Emergency care for traumatic injuries',
              basePrice: 3000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-POIS-067',
              serviceName: 'Poisoning Emergency',
              description: 'Emergency treatment for poisoning',
              basePrice: 2500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-SEIZ-068',
              serviceName: 'Seizure Emergency',
              description: 'Emergency seizure management',
              basePrice: 2000,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HEAT-069',
              serviceName: 'Heat Stroke Emergency',
              description: 'Emergency treatment for heat stroke',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_critical_monitoring',
          groupName: '6.2 Critical Monitoring',
          services: [
            {
              code: 'VET-IV-070',
              serviceName: 'IV Fluids Therapy',
              description: 'Intravenous fluid administration',
              basePrice: 1500,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-OXY-071',
              serviceName: 'Oxygen Therapy',
              description: 'Oxygen support for respiratory distress',
              basePrice: 2000,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-POST-072',
              serviceName: 'Post-Operative Monitoring',
              description: '24-hour post-surgery care',
              basePrice: 3000,
              duration: '24 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_vet_home',
      name: '7. Vet at Home Services',
      description: 'Home visit consultations and procedures',
      icon: '🏠',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_home_visit',
          groupName: '7.1 Home Visit Consultation',
          services: [
            {
              code: 'VET-HOME-073',
              serviceName: 'Home General Check-up',
              description: 'At-home health examination',
              basePrice: 800,
              duration: '45 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HSICK-074',
              serviceName: 'Home Sick Visit',
              description: 'At-home consultation for sick pets',
              basePrice: 900,
              duration: '45 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HVAC-075',
              serviceName: 'Home Vaccination',
              description: 'At-home vaccination service',
              basePrice: 800,
              duration: '30 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HTREAT-076',
              serviceName: 'Home Minor Treatments',
              description: 'At-home minor treatment procedures',
              basePrice: 700,
              duration: '30 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_home_procedures',
          groupName: '7.2 Home Procedures',
          services: [
            {
              code: 'VET-HDRESS-077',
              serviceName: 'Home Dressing/Wound Care',
              description: 'At-home wound dressing and care',
              basePrice: 600,
              duration: '30 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HEAR-078',
              serviceName: 'Home Ear/Eye Treatment',
              description: 'At-home ear and eye care',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HFLUID-079',
              serviceName: 'Home Fluid Therapy',
              description: 'At-home subcutaneous fluid administration',
              basePrice: 800,
              duration: '45 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HPOST-080',
              serviceName: 'Post-surgery Home Care',
              description: 'At-home post-operative care',
              basePrice: 700,
              duration: '45 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_home_lab',
          groupName: '7.3 Home Lab Collection',
          services: [
            {
              code: 'VET-HLAB-081',
              serviceName: 'Home Blood Sample Collection',
              description: 'At-home blood sample collection',
              basePrice: 400,
              duration: '20 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-HURI-082',
              serviceName: 'Home Urine Sample Collection',
              description: 'At-home urine sample collection',
              basePrice: 300,
              duration: '15 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_teleconsult',
      name: '8. Tele-Consultation Services',
      description: 'Remote veterinary consultations',
      icon: '💻',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_teleconsult_types',
          groupName: '8.1 Types of Teleconsults',
          services: [
            {
              code: 'VET-TELE-083',
              serviceName: 'Instant Tele-Consult',
              description: 'Immediate online consultation',
              basePrice: 300,
              duration: '15 mins',
              serviceStyle: 'online',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-TSCHED-084',
              serviceName: 'Scheduled Tele-Consult',
              description: 'Pre-scheduled online consultation',
              basePrice: 400,
              duration: '30 mins',
              serviceStyle: 'online',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_teleconsult_topics',
          groupName: '8.2 Tele Topic Specialists',
          services: [
            {
              code: 'VET-TSKIN-085',
              serviceName: 'Tele-Consult: Skin/Allergy',
              description: 'Online consultation for skin issues',
              basePrice: 400,
              duration: '30 mins',
              serviceStyle: 'online',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-TDIET-086',
              serviceName: 'Tele-Consult: Diet & Nutrition',
              description: 'Online nutritional counseling',
              basePrice: 350,
              duration: '30 mins',
              serviceStyle: 'online',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-TBEH-087',
              serviceName: 'Tele-Consult: Behaviour',
              description: 'Online behavioral consultation',
              basePrice: 400,
              duration: '30 mins',
              serviceStyle: 'online',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-TFOLLOW-088',
              serviceName: 'Tele-Consult: Follow-up',
              description: 'Online follow-up consultation',
              basePrice: 250,
              duration: '15 mins',
              serviceStyle: 'online',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_health_programs',
      name: '9. Health Programs & Packages',
      description: 'Comprehensive health and preventive care packages',
      icon: '📋',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_annual_plans',
          groupName: '9.1 Annual Health Plans',
          services: [
            {
              code: 'VET-PKG-PUP-089',
              serviceName: 'Puppy/Kitten Health Plan',
              description: 'Complete first-year care package',
              basePrice: 5000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PKG-ADT-090',
              serviceName: 'Adult Health Plan',
              description: 'Annual care package for adult pets',
              basePrice: 4000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PKG-SEN-091',
              serviceName: 'Senior Pet Plan',
              description: 'Comprehensive senior pet care package',
              basePrice: 6000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_preventive_plans',
          groupName: '9.2 Preventive Plans',
          services: [
            {
              code: 'VET-PKG-VAC-092',
              serviceName: 'Vaccination Package',
              description: 'Complete vaccination program',
              basePrice: 2500,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PKG-PAR-093',
              serviceName: 'Parasite Prevention Package',
              description: 'Complete parasite prevention program',
              basePrice: 2000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PKG-DENT-094',
              serviceName: 'Dental Maintenance Package',
              description: 'Annual dental care package',
              basePrice: 3000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_chronic_programs',
          groupName: '9.3 Chronic Disease Programs',
          services: [
            {
              code: 'VET-PKG-DIA-095',
              serviceName: 'Diabetes Management Plan',
              description: 'Complete diabetes care program',
              basePrice: 8000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-PKG-KID-096',
              serviceName: 'Kidney Care Plan',
              description: 'Comprehensive kidney disease management',
              basePrice: 10000,
              duration: '1 year',
              serviceStyle: 'at-center',
              applicableRoles: ['role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    },
    
    {
      id: 'sub_documents_cert',
      name: '10. Documents & Certification',
      description: 'Certificates and regulatory compliance',
      icon: '📄',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_certificates',
          groupName: '10.1 Certificates',
          services: [
            {
              code: 'VET-CERT-TRV-097',
              serviceName: 'Fit-to-Travel Certificate',
              description: 'Travel health certificate',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-CERT-HLT-098',
              serviceName: 'Health Certificate',
              description: 'General health certificate',
              basePrice: 400,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-CERT-VAC-099',
              serviceName: 'Vaccination Certificate',
              description: 'Vaccination record certificate',
              basePrice: 200,
              duration: '15 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_regulatory',
          groupName: '10.2 Regulatory',
          services: [
            {
              code: 'VET-CHIP-100',
              serviceName: 'Microchipping',
              description: 'Pet microchip implantation',
              basePrice: 800,
              duration: '20 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'VET-REG-101',
              serviceName: 'Pet Registration Support',
              description: 'Assistance with pet registration',
              basePrice: 500,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_veterinarian', 'role_vet_clinic'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        }
      ]
    }
  ]
};

/**
 * Helper function to flatten all services from the catalog
 */
export function getAllVeterinaryServices() {
  const allServices: any[] = [];
  
  veterinaryServicesCatalog.subCategories.forEach(subCategory => {
    subCategory.serviceGroups.forEach((group: any) => {
      group.services.forEach((service: any) => {
        // Normalize serviceStyle: convert 'at-center' to 'at_center', 'at-home' to 'at_home'
        let normalizedServiceStyle = service.serviceStyle;
        if (normalizedServiceStyle === 'at-home') normalizedServiceStyle = 'at_home';
        if (normalizedServiceStyle === 'at-center') normalizedServiceStyle = 'at_center';
        
        allServices.push({
          ...service,
          // Add required fields for admin panel compatibility
          id: service.code || `vet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          catalogId: service.code || `vet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: service.serviceName,
          serviceStyle: normalizedServiceStyle, // Use normalized format
          isPackage: service.isPackage || false, // Default to false if not specified
          // Category information
          categoryId: veterinaryServicesCatalog.categoryId,
          categoryName: veterinaryServicesCatalog.categoryName,
          subCategoryId: subCategory.id,
          subCategoryName: subCategory.name,
          serviceGroupId: group.groupId,
          serviceGroupName: group.groupName
        });
      });
    });
  });
  
  return allServices;
}

/**
 * Helper function to get service groups for a specific subcategory
 */
export function getServiceGroupsBySubCategory(subCategoryId: string) {
  const subCategory = veterinaryServicesCatalog.subCategories.find(
    sub => sub.id === subCategoryId
  );
  return subCategory?.serviceGroups || [];
}

/**
 * Helper function to get all subcategories
 */
export function getAllVeterinarySubCategories() {
  return veterinaryServicesCatalog.subCategories.map(sub => ({
    id: sub.id,
    name: sub.name,
    description: sub.description,
    icon: sub.icon,
    status: sub.status,
    serviceCount: sub.serviceGroups.reduce((acc: number, group: any) => 
      acc + group.services.length, 0
    )
  }));
}

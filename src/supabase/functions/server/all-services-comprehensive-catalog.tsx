/**
 * Comprehensive Services Catalog for ALL Warmpawz Services
 * Unified structure across all categories: Veterinary, Grooming, Training, etc.
 */

// Import veterinary catalog
import { veterinaryServicesCatalog } from './vet-services-comprehensive-catalog.tsx';

/**
 * GROOMING & DAYCARE SERVICES
 */
export const groomingServicesCatalog = {
  categoryId: 'cat_grooming',
  categoryName: 'Grooming & Day-care Services',
  
  subCategories: [
    {
      id: 'sub_grooming_basic',
      name: 'Basic Grooming Services',
      description: 'Essential grooming and hygiene services',
      icon: '✂️',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_bath_brush',
          groupName: '1.1 Bath & Brush',
          services: [
            {
              code: 'GRM-BATH-001',
              serviceName: 'Basic Bath & Brush',
              description: 'Shampooing, conditioning, and brushing',
              basePrice: 500,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-BATH-002',
              serviceName: 'Premium Bath & Brush',
              description: 'Premium products with deep conditioning',
              basePrice: 800,
              duration: '1.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-DBATH-003',
              serviceName: 'De-shedding Bath',
              description: 'Specialized bath for heavy shedding',
              basePrice: 900,
              duration: '1.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-MBATH-004',
              serviceName: 'Medicated Bath',
              description: 'Therapeutic bath for skin conditions',
              basePrice: 1000,
              duration: '1.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_haircut',
          groupName: '1.2 Haircut & Styling',
          services: [
            {
              code: 'GRM-HAIR-005',
              serviceName: 'Full Body Haircut',
              description: 'Complete haircut and styling',
              basePrice: 1200,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-TRIM-006',
              serviceName: 'Trimming & Shaping',
              description: 'Partial trim and shape-up',
              basePrice: 700,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-STYLE-007',
              serviceName: 'Creative Styling',
              description: 'Designer cuts and creative styling',
              basePrice: 1500,
              duration: '2.5 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_nails_paws',
          groupName: '1.3 Nails & Paw Care',
          services: [
            {
              code: 'GRM-NAIL-008',
              serviceName: 'Nail Trimming',
              description: 'Professional nail trim and filing',
              basePrice: 200,
              duration: '20 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-PAW-009',
              serviceName: 'Paw Pad Treatment',
              description: 'Paw pad moisturizing and care',
              basePrice: 300,
              duration: '30 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
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
      id: 'sub_grooming_specialty',
      name: 'Specialty Grooming',
      description: 'Advanced grooming treatments',
      icon: '💅',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_spa',
          groupName: '2.1 Spa Treatments',
          services: [
            {
              code: 'GRM-SPA-010',
              serviceName: 'Spa Package - Basic',
              description: 'Bath, massage, and aromatherapy',
              basePrice: 1500,
              duration: '2 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-SPA-011',
              serviceName: 'Spa Package - Luxury',
              description: 'Full spa with premium treatments',
              basePrice: 2500,
              duration: '3 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-MAS-012',
              serviceName: 'Pet Massage',
              description: 'Therapeutic massage session',
              basePrice: 800,
              duration: '45 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_teeth_ear',
          groupName: '2.2 Teeth & Ear Cleaning',
          services: [
            {
              code: 'GRM-TEETH-013',
              serviceName: 'Teeth Brushing',
              description: 'Professional teeth cleaning',
              basePrice: 300,
              duration: '20 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-EAR-014',
              serviceName: 'Ear Cleaning',
              description: 'Gentle ear cleaning and drying',
              basePrice: 250,
              duration: '20 mins',
              serviceStyle: 'at-center',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
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
      id: 'sub_grooming_mobile',
      name: 'Mobile Grooming',
      description: 'At-home grooming services',
      icon: '🚐',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_mobile_basic',
          groupName: '3.1 Mobile Basic Services',
          services: [
            {
              code: 'GRM-MOB-015',
              serviceName: 'Mobile Bath & Brush',
              description: 'At-home bath and brushing',
              basePrice: 800,
              duration: '1.5 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'GRM-MOB-016',
              serviceName: 'Mobile Full Grooming',
              description: 'Complete grooming at your doorstep',
              basePrice: 1500,
              duration: '2.5 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_groomer', 'role_grooming_center'],
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
      id: 'sub_daycare',
      name: 'Daycare Services',
      description: 'Pet daycare and boarding',
      icon: '🏠',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_daycare',
          groupName: '4.1 Daycare Options',
          services: [
            {
              code: 'DAY-HALF-017',
              serviceName: 'Half Day Daycare',
              description: 'Morning or afternoon daycare (4-6 hours)',
              basePrice: 400,
              duration: '4 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_grooming_center', 'role_boarding'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'DAY-FULL-018',
              serviceName: 'Full Day Daycare',
              description: 'All-day care with activities (8-10 hours)',
              basePrice: 700,
              duration: '8 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_grooming_center', 'role_boarding'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'DAY-BOARD-019',
              serviceName: 'Overnight Boarding',
              description: 'Overnight stay with meals',
              basePrice: 1000,
              duration: '24 hours',
              serviceStyle: 'at-center',
              applicableRoles: ['role_boarding'],
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
 * TRAINING SERVICES
 */
export const trainingServicesCatalog = {
  categoryId: 'cat_training',
  categoryName: 'Training & Behavior Services',
  
  subCategories: [
    {
      id: 'sub_training_basic',
      name: 'Basic Obedience Training',
      description: 'Foundation training for all pets',
      icon: '🎓',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_puppy_training',
          groupName: '1.1 Puppy Training',
          services: [
            {
              code: 'TRN-PUP-001',
              serviceName: 'Puppy Socialization Class',
              description: 'Group class for puppies 8-16 weeks',
              basePrice: 2000,
              duration: '1 hour',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-PUP-002',
              serviceName: 'Puppy Basic Commands',
              description: 'Sit, stay, come, down training',
              basePrice: 3000,
              duration: '4 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-PUP-003',
              serviceName: 'House Training Program',
              description: 'Potty training and house manners',
              basePrice: 2500,
              duration: '3 weeks',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_basic_obedience',
          groupName: '1.2 Basic Obedience',
          services: [
            {
              code: 'TRN-OBD-004',
              serviceName: 'Basic Obedience Course',
              description: '6-week basic training program',
              basePrice: 5000,
              duration: '6 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-OBD-005',
              serviceName: 'Leash Training',
              description: 'Proper leash walking and control',
              basePrice: 2000,
              duration: '2 weeks',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-OBD-006',
              serviceName: 'Recall Training',
              description: 'Come when called training',
              basePrice: 1500,
              duration: '2 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
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
      id: 'sub_training_advanced',
      name: 'Advanced Training',
      description: 'Specialized and advanced skills',
      icon: '🏆',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_advanced_obedience',
          groupName: '2.1 Advanced Obedience',
          services: [
            {
              code: 'TRN-ADV-007',
              serviceName: 'Advanced Obedience Course',
              description: 'Off-leash control and advanced commands',
              basePrice: 8000,
              duration: '8 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-AGI-008',
              serviceName: 'Agility Training',
              description: 'Obstacle course and agility skills',
              basePrice: 6000,
              duration: '6 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            }
          ]
        },
        {
          groupId: 'grp_specialty_training',
          groupName: '2.2 Specialty Training',
          services: [
            {
              code: 'TRN-GUARD-009',
              serviceName: 'Guard Dog Training',
              description: 'Protection and guard training',
              basePrice: 15000,
              duration: '12 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-THER-010',
              serviceName: 'Therapy Dog Training',
              description: 'Training for therapy/service work',
              basePrice: 12000,
              duration: '10 weeks',
              serviceStyle: 'at-center',
              applicableRoles: ['role_trainer'],
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
      id: 'sub_behavior',
      name: 'Behavior Modification',
      description: 'Problem behavior correction',
      icon: '🧠',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_behavior_issues',
          groupName: '3.1 Common Behavior Issues',
          services: [
            {
              code: 'TRN-AGG-011',
              serviceName: 'Aggression Management',
              description: 'Addressing aggressive behavior',
              basePrice: 8000,
              duration: '8 weeks',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-ANX-012',
              serviceName: 'Separation Anxiety Training',
              description: 'Reduce separation stress',
              basePrice: 6000,
              duration: '6 weeks',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-BARK-013',
              serviceName: 'Excessive Barking Control',
              description: 'Barking behavior modification',
              basePrice: 4000,
              duration: '4 weeks',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-FEAR-014',
              serviceName: 'Fear & Phobia Management',
              description: 'Overcome fears and phobias',
              basePrice: 5000,
              duration: '6 weeks',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
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
      id: 'sub_training_private',
      name: 'Private Training Sessions',
      description: 'One-on-one personalized training',
      icon: '👤',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_private',
          groupName: '4.1 Private Sessions',
          services: [
            {
              code: 'TRN-PVT-015',
              serviceName: 'Single Private Session',
              description: 'One-on-one training session',
              basePrice: 1500,
              duration: '1 hour',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-PVT-016',
              serviceName: 'Private Package (5 Sessions)',
              description: '5 private training sessions',
              basePrice: 6500,
              duration: '5 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'TRN-PVT-017',
              serviceName: 'Private Package (10 Sessions)',
              description: '10 private training sessions',
              basePrice: 12000,
              duration: '10 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_trainer'],
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
 * WALKING & SITTING SERVICES
 */
export const walkingServicesCatalog = {
  categoryId: 'cat_walking',
  categoryName: 'Walking & Sitting Services',
  
  subCategories: [
    {
      id: 'sub_walking',
      name: 'Dog Walking',
      description: 'Professional dog walking services',
      icon: '🚶',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_walk_duration',
          groupName: '1.1 Walk Duration Options',
          services: [
            {
              code: 'WLK-30-001',
              serviceName: '30-Minute Walk',
              description: 'Quick walk and potty break',
              basePrice: 200,
              duration: '30 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_walker'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'WLK-60-002',
              serviceName: '60-Minute Walk',
              description: 'Standard exercise walk',
              basePrice: 350,
              duration: '1 hour',
              serviceStyle: 'at-home',
              applicableRoles: ['role_walker'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'WLK-90-003',
              serviceName: '90-Minute Walk',
              description: 'Extended exercise session',
              basePrice: 500,
              duration: '1.5 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_walker'],
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
      id: 'sub_sitting',
      name: 'Pet Sitting',
      description: 'In-home pet care services',
      icon: '🏡',
      status: 'active',
      serviceGroups: [
        {
          groupId: 'grp_sitting_options',
          groupName: '2.1 Sitting Services',
          services: [
            {
              code: 'SIT-VISIT-004',
              serviceName: 'Pet Visit (30 mins)',
              description: 'Quick check-in and care',
              basePrice: 300,
              duration: '30 mins',
              serviceStyle: 'at-home',
              applicableRoles: ['role_sitter'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'SIT-HALF-005',
              serviceName: 'Half-Day Pet Sitting',
              description: '4-6 hours of in-home care',
              basePrice: 800,
              duration: '4 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_sitter'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'SIT-FULL-006',
              serviceName: 'Full-Day Pet Sitting',
              description: '8-10 hours of care',
              basePrice: 1500,
              duration: '8 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_sitter'],
              gstInclusion: 'inclusive',
              gstRate: 18,
              showFinalPrice: true,
              status: 'active'
            },
            {
              code: 'SIT-OVER-007',
              serviceName: 'Overnight Pet Sitting',
              description: '24-hour overnight care',
              basePrice: 2000,
              duration: '24 hours',
              serviceStyle: 'at-home',
              applicableRoles: ['role_sitter'],
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
 * Unified helper to get all services from all catalogs
 */
export function getAllServicesUnified() {
  const allServices: any[] = [];
  
  // Process each catalog
  const catalogs = [
    veterinaryServicesCatalog,
    groomingServicesCatalog,
    trainingServicesCatalog,
    walkingServicesCatalog
  ];
  
  catalogs.forEach(catalog => {
    catalog.subCategories.forEach((subCategory: any) => {
      subCategory.serviceGroups.forEach((group: any) => {
        group.services.forEach((service: any) => {
          // Normalize serviceStyle: convert 'at-home' to 'at_home', 'at-center' to 'at_center'
          let normalizedServiceStyle = service.serviceStyle;
          if (normalizedServiceStyle === 'at-home') normalizedServiceStyle = 'at_home';
          if (normalizedServiceStyle === 'at-center') normalizedServiceStyle = 'at_center';
          
          // Convert duration string to minutes number
          let durationInMinutes = 30; // default
          if (typeof service.duration === 'string') {
            const duration = service.duration.toLowerCase();
            if (duration.includes('hour')) {
              const hours = parseFloat(duration);
              durationInMinutes = hours * 60;
            } else if (duration.includes('min')) {
              durationInMinutes = parseFloat(duration);
            } else if (duration.includes('day')) {
              const days = parseFloat(duration);
              durationInMinutes = days * 24 * 60;
            }
          } else if (typeof service.duration === 'number') {
            durationInMinutes = service.duration;
          }
          
          allServices.push({
            ...service,
            // Add required fields for admin panel compatibility
            id: service.code || `srv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            catalogId: service.code || `srv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: service.serviceName,
            serviceStyle: normalizedServiceStyle, // Use normalized format
            isPackage: service.isPackage || false, // Default to false if not specified
            duration: durationInMinutes, // Convert to minutes
            // Category information
            categoryId: catalog.categoryId,
            categoryName: catalog.categoryName,
            subCategoryId: subCategory.id,
            subCategoryName: subCategory.name,
            serviceGroupId: group.groupId,
            serviceGroupName: group.groupName
          });
        });
      });
    });
  });
  
  return allServices;
}

/**
 * Get all catalogs
 */
export function getAllCatalogs() {
  return [
    veterinaryServicesCatalog,
    groomingServicesCatalog,
    trainingServicesCatalog,
    walkingServicesCatalog
  ];
}
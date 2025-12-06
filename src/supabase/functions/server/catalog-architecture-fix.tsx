/**
 * CATALOG ARCHITECTURE FIX
 * 
 * PROBLEM: Services stored in TWO places causing duplication
 * 
 * CORRECT ARCHITECTURE:
 * 1. catalog:categories - High-level categories + subcategories ONLY (NO services)
 * 2. platform:service_catalog - All actual services with references
 * 
 * Services reference categories via:
 * - categoryId
 * - categoryName  
 * - subCategoryId
 * - subCategoryName
 */

import type { Hono } from "npm:hono@4.6.14";
import * as kv from "./kv_store.tsx";

// Category structure (NO services)
interface Category {
  id: string;
  name: string;
  icon: string;
  vendorType: string;
  serviceStyle: 'at-home' | 'at-center' | 'tele';
  description: string;
  status: 'active' | 'inactive';
  subCategories: SubCategory[];
  createdAt?: string;
  updatedAt?: string;
}

interface SubCategory {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  // NO services array!
}

// Service structure (separate storage)
interface Service {
  catalogId: string;
  serviceName: string;
  code?: string;
  description: string;
  
  // Reference to category
  categoryId: string;
  categoryName: string;
  subCategoryId?: string;
  subCategoryName?: string;
  
  // Service details
  serviceStyle: 'at_home' | 'at_center' | 'tele';
  applicableRoles: string[];
  basePrice: number;
  duration?: string;
  
  // Status
  status: 'active' | 'inactive';
  
  // Optional fields
  gstRate?: number;
  gstInclusion?: 'inclusive' | 'exclusive';
  isPackage?: boolean;
  packageDetails?: any;
  
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Seed data - Categories ONLY (no services)
 */
export const CATEGORY_SEED_DATA: Category[] = [
  // GROOMING
  {
    id: "cat_grooming_athome",
    icon: "grooming",
    name: "Grooming Services - At Home",
    status: "active",
    vendorType: "grooming",
    serviceStyle: "at-home",
    description: "Professional pet grooming services delivered to your doorstep",
    subCategories: [
      {
        id: "sub_grooming_basic",
        name: "Basic Grooming",
        description: "Essential grooming services for everyday care",
        status: "active"
      },
      {
        id: "sub_grooming_full",
        name: "Full Grooming",
        description: "Complete grooming packages",
        status: "active"
      },
      {
        id: "sub_grooming_specialty",
        name: "Specialty Services",
        description: "Premium and specialized grooming",
        status: "active"
      }
    ]
  },
  {
    id: "cat_grooming_atcenter",
    icon: "grooming",
    name: "Grooming Services - At Center",
    status: "active",
    vendorType: "grooming",
    serviceStyle: "at-center",
    description: "Visit our professional grooming salon",
    subCategories: [
      {
        id: "sub_grooming_salon",
        name: "Salon Services",
        description: "Walk-in grooming at our salon",
        status: "active"
      }
    ]
  },

  // TRAINING
  {
    id: "cat_training_athome",
    icon: "training",
    name: "Training Services - At Home",
    status: "active",
    vendorType: "training",
    serviceStyle: "at-home",
    description: "Professional dog training in the comfort of your home",
    subCategories: [
      {
        id: "sub_training_basic",
        name: "Basic Obedience",
        description: "Foundation training for all dogs",
        status: "active"
      },
      {
        id: "sub_training_advanced",
        name: "Advanced Training",
        description: "Specialized and advanced training",
        status: "active"
      },
      {
        id: "sub_training_packages",
        name: "Training Packages",
        description: "Multi-session programs",
        status: "active"
      }
    ]
  },
  {
    id: "cat_training_atcenter",
    icon: "training",
    name: "Training Services - At Center",
    status: "active",
    vendorType: "training",
    serviceStyle: "at-center",
    description: "Group classes at our facility",
    subCategories: [
      {
        id: "sub_training_group",
        name: "Group Classes",
        description: "Socialization and group training",
        status: "active"
      }
    ]
  },

  // SITTING
  {
    id: "cat_sitting",
    icon: "sitting",
    name: "Pet Sitting Services",
    status: "active",
    vendorType: "sitting",
    serviceStyle: "at-home",
    description: "Professional pet care while you're away",
    subCategories: [
      {
        id: "sub_sitting_visits",
        name: "Home Visits",
        description: "Drop-in visits to care for your pet",
        status: "active"
      },
      {
        id: "sub_sitting_overnight",
        name: "Overnight Care",
        description: "Overnight pet sitting",
        status: "active"
      }
    ]
  },

  // TRANSPORT
  {
    id: "cat_transport",
    icon: "transport",
    name: "Pet Transport Services",
    status: "active",
    vendorType: "transport",
    serviceStyle: "at-home",
    description: "Safe and comfortable pet transportation",
    subCategories: [
      {
        id: "sub_transport_local",
        name: "Local Transport",
        description: "Within city transportation",
        status: "active"
      },
      {
        id: "sub_transport_airport",
        name: "Airport Transport",
        description: "Airport transfer services",
        status: "active"
      },
      {
        id: "sub_transport_emergency",
        name: "Emergency Transport",
        description: "Urgent veterinary transport",
        status: "active"
      }
    ]
  },

  // PHOTOGRAPHY
  {
    id: "cat_photography_athome",
    icon: "photography",
    name: "Pet Photography - At Home",
    status: "active",
    vendorType: "photography",
    serviceStyle: "at-home",
    description: "Professional pet photography at your location",
    subCategories: [
      {
        id: "sub_photo_portrait",
        name: "Portrait Sessions",
        description: "Professional pet portraits",
        status: "active"
      },
      {
        id: "sub_photo_special",
        name: "Special Occasions",
        description: "Event photography",
        status: "active"
      }
    ]
  },
  {
    id: "cat_photography_outdoor",
    icon: "photography",
    name: "Pet Photography - Outdoor",
    status: "active",
    vendorType: "photography",
    serviceStyle: "at-center",
    description: "Outdoor photography sessions",
    subCategories: [
      {
        id: "sub_photo_outdoor",
        name: "Outdoor Sessions",
        description: "Natural outdoor photography",
        status: "active"
      }
    ]
  }
];

/**
 * Service seed data (stored separately in platform:service_catalog)
 */
export const SERVICE_SEED_DATA: Omit<Service, 'catalogId' | 'createdAt' | 'updatedAt'>[] = [
  // GROOMING SERVICES
  {
    serviceName: "Bath & Brush",
    code: "GROOM-BB-001",
    categoryId: "cat_grooming_athome",
    categoryName: "Grooming Services - At Home",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 800,
    duration: "45min",
    description: "Complete bath with premium shampoo and thorough brushing",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Nail Trimming",
    code: "GROOM-NT-001",
    categoryId: "cat_grooming_athome",
    categoryName: "Grooming Services - At Home",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 300,
    duration: "15min",
    description: "Safe and gentle nail trimming",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Ear Cleaning",
    code: "GROOM-EC-001",
    categoryId: "cat_grooming_athome",
    categoryName: "Grooming Services - At Home",
    subCategoryId: "sub_grooming_basic",
    subCategoryName: "Basic Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 250,
    duration: "15min",
    description: "Gentle ear cleaning to prevent infections",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Full Grooming - Small Breed",
    code: "GROOM-FG-SMALL",
    categoryId: "cat_grooming_athome",
    categoryName: "Grooming Services - At Home",
    subCategoryId: "sub_grooming_full",
    subCategoryName: "Full Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 1500,
    duration: "1.5hr",
    description: "Complete grooming including bath, brush, nail trim, ear cleaning, and styling",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Full Grooming - Medium Breed",
    code: "GROOM-FG-MEDIUM",
    categoryId: "cat_grooming_athome",
    categoryName: "Grooming Services - At Home",
    subCategoryId: "sub_grooming_full",
    subCategoryName: "Full Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 2000,
    duration: "2hr",
    description: "Complete grooming for medium breeds",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Full Grooming - Large Breed",
    code: "GROOM-FG-LARGE",
    categoryId: "cat_grooming_athome",
    categoryName: "Grooming Services - At Home",
    subCategoryId: "sub_grooming_full",
    subCategoryName: "Full Grooming",
    serviceStyle: "at_home",
    applicableRoles: ["pet_groomer"],
    basePrice: 2500,
    duration: "2.5hr",
    description: "Complete grooming for large breeds",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  
  // TRAINING SERVICES
  {
    serviceName: "Basic Obedience - Single Session",
    code: "TRAIN-BO-001",
    categoryId: "cat_training_athome",
    categoryName: "Training Services - At Home",
    subCategoryId: "sub_training_basic",
    subCategoryName: "Basic Obedience",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 1500,
    duration: "1hr",
    description: "Sit, stay, come, heel - foundation commands",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Potty Training Session",
    code: "TRAIN-PT-001",
    categoryId: "cat_training_athome",
    categoryName: "Training Services - At Home",
    subCategoryId: "sub_training_basic",
    subCategoryName: "Basic Obedience",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 1200,
    duration: "1hr",
    description: "House training and potty behavior correction",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Behavior Correction Session",
    code: "TRAIN-BC-001",
    categoryId: "cat_training_athome",
    categoryName: "Training Services - At Home",
    subCategoryId: "sub_training_advanced",
    subCategoryName: "Advanced Training",
    serviceStyle: "at_home",
    applicableRoles: ["pet_trainer"],
    basePrice: 2000,
    duration: "1.5hr",
    description: "Address aggression, anxiety, excessive barking",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },

  // SITTING SERVICES
  {
    serviceName: "Single Visit - 30 Minutes",
    code: "SIT-VISIT-30",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_visits",
    subCategoryName: "Home Visits",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 400,
    duration: "30min",
    description: "Feeding, playtime, and basic care",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Single Visit - 60 Minutes",
    code: "SIT-VISIT-60",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_visits",
    subCategoryName: "Home Visits",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 700,
    duration: "1hr",
    description: "Extended care with walk and playtime",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Overnight Pet Sitting",
    code: "SIT-OVERNIGHT",
    categoryId: "cat_sitting",
    categoryName: "Pet Sitting Services",
    subCategoryId: "sub_sitting_overnight",
    subCategoryName: "Overnight Care",
    serviceStyle: "at_home",
    applicableRoles: ["pet_sitter"],
    basePrice: 2500,
    duration: "12hr",
    description: "Overnight care at your home (8pm-8am)",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },

  // TRANSPORT SERVICES
  {
    serviceName: "Local Transport - Up to 5km",
    code: "TRANS-LOCAL-5KM",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_local",
    subCategoryName: "Local Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transport"],
    basePrice: 500,
    duration: "30min",
    description: "Pick up and drop within 5km radius",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Local Transport - Up to 10km",
    code: "TRANS-LOCAL-10KM",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_local",
    subCategoryName: "Local Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transport"],
    basePrice: 800,
    duration: "45min",
    description: "Pick up and drop within 10km radius",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Airport Pet Transfer",
    code: "TRANS-AIRPORT",
    categoryId: "cat_transport",
    categoryName: "Pet Transport Services",
    subCategoryId: "sub_transport_airport",
    subCategoryName: "Airport Transport",
    serviceStyle: "at_home",
    applicableRoles: ["pet_transport"],
    basePrice: 2500,
    duration: "2hr",
    description: "Safe airport transfer with documentation",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },

  // PHOTOGRAPHY SERVICES
  {
    serviceName: "Basic Photo Session",
    code: "PHOTO-BASIC",
    categoryId: "cat_photography_athome",
    categoryName: "Pet Photography - At Home",
    subCategoryId: "sub_photo_portrait",
    subCategoryName: "Portrait Sessions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 3000,
    duration: "1hr",
    description: "1-hour session with 10 edited photos",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Premium Photo Session",
    code: "PHOTO-PREMIUM",
    categoryId: "cat_photography_athome",
    categoryName: "Pet Photography - At Home",
    subCategoryId: "sub_photo_portrait",
    subCategoryName: "Portrait Sessions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 5000,
    duration: "2hr",
    description: "2-hour session with 25 edited photos and props",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  },
  {
    serviceName: "Pet Birthday Photoshoot",
    code: "PHOTO-BIRTHDAY",
    categoryId: "cat_photography_athome",
    categoryName: "Pet Photography - At Home",
    subCategoryId: "sub_photo_special",
    subCategoryName: "Special Occasions",
    serviceStyle: "at_home",
    applicableRoles: ["pet_photographer"],
    basePrice: 4000,
    duration: "1.5hr",
    description: "Birthday themed photography with decorations",
    status: "active",
    gstRate: 18,
    gstInclusion: "inclusive"
  }
];

export function registerCatalogArchitectureFix(app: Hono) {
  
  /**
   * Seed categories ONLY (no services in nested structure)
   */
  app.post("/make-server-3dd53475/admin/seed-categories", async (c) => {
    try {
      console.log('\n🌱 ===== SEEDING CATEGORIES (NO SERVICES) =====');
      
      const existingCategories = await kv.get('catalog:categories') || [];
      const existingIds = new Set(existingCategories.map((c: any) => c.id));
      
      const newCategories = CATEGORY_SEED_DATA.filter(c => !existingIds.has(c.id));
      
      if (newCategories.length === 0) {
        return c.json({
          success: true,
          message: "All categories already exist",
          added: 0
        });
      }
      
      const timestamp = new Date().toISOString();
      const categoriesWithTimestamps = newCategories.map(cat => ({
        ...cat,
        createdAt: timestamp,
        updatedAt: timestamp
      }));
      
      const updatedCategories = [...existingCategories, ...categoriesWithTimestamps];
      await kv.set('catalog:categories', updatedCategories);
      
      console.log(`✅ Added ${newCategories.length} categories (NO services)`);
      
      return c.json({
        success: true,
        message: "Categories seeded successfully",
        added: newCategories.length,
        total: updatedCategories.length
      });
      
    } catch (error) {
      console.error('❌ Error seeding categories:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
  
  /**
   * Seed services to platform:service_catalog
   */
  app.post("/make-server-3dd53475/admin/seed-services", async (c) => {
    try {
      console.log('\n🌱 ===== SEEDING SERVICES =====');
      
      const existingServices = await kv.get('platform:service_catalog') || [];
      const existingCodes = new Set(existingServices.map((s: any) => s.code).filter(Boolean));
      
      const newServices = SERVICE_SEED_DATA.filter(s => !s.code || !existingCodes.has(s.code));
      
      if (newServices.length === 0) {
        return c.json({
          success: true,
          message: "All services already exist",
          added: 0
        });
      }
      
      const timestamp = new Date().toISOString();
      const servicesWithIds = newServices.map((service, idx) => ({
        ...service,
        catalogId: `srv_${Date.now()}_${idx}`,
        createdAt: timestamp,
        updatedAt: timestamp
      }));
      
      const updatedServices = [...existingServices, ...servicesWithIds];
      await kv.set('platform:service_catalog', updatedServices);
      
      console.log(`✅ Added ${servicesWithIds.length} services`);
      
      // Count by role
      const byRole: Record<string, number> = {};
      servicesWithIds.forEach(s => {
        s.applicableRoles.forEach(role => {
          byRole[role] = (byRole[role] || 0) + 1;
        });
      });
      
      return c.json({
        success: true,
        message: "Services seeded successfully",
        added: servicesWithIds.length,
        total: updatedServices.length,
        byRole
      });
      
    } catch (error) {
      console.error('❌ Error seeding services:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

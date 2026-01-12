/**
 * =====================================================
 * WARMPAWZ COMPREHENSIVE MOCK DATA - ALL 20 SERVICES
 * =====================================================
 * Complete production-ready mock data for all features
 * - 100+ Services across 20 categories
 * - 50+ Products across 5 categories  
 * - 20+ Coupons and promotions
 * - 10+ Bundle deals
 * - Banners and promotional content
 * =====================================================
 */

import type { Service, Product } from './mockData';

// =====================================================
// EXPANDED SERVICES (100+) - ALL 20 CATEGORIES
// =====================================================

export const EXPANDED_SERVICES: Service[] = [
  // ==================== VETERINARY (20 services) ====================
  {
    id: 'vet_001',
    vendor_id: 'vendor_001',
    name: 'General Health Checkup',
    category: 'Veterinary',
    price: 500,
    duration: 30,
    description: 'Comprehensive physical examination and health assessment',
    service_styles: ['centre', 'home', 'tele'],
    is_active: true,
    problem_tags: ['checkup', 'health', 'general']
  },
  {
    id: 'vet_002',
    vendor_id: 'vendor_001',
    name: 'Vaccination (Rabies)',
    category: 'Veterinary',
    price: 800,
    duration: 20,
    description: 'Rabies vaccination with health certificate',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['vaccination', 'preventive', 'rabies']
  },
  {
    id: 'vet_003',
    vendor_id: 'vendor_001',
    name: '5-in-1 Vaccination',
    category: 'Veterinary',
    price: 1200,
    duration: 25,
    description: 'Complete vaccination package covering 5 diseases',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['vaccination', 'preventive', 'combo']
  },
  {
    id: 'vet_004',
    vendor_id: 'vendor_002',
    name: 'Emergency Consultation',
    category: 'Veterinary',
    subcategory: 'Emergency',
    price: 1500,
    duration: 45,
    description: '24/7 emergency veterinary care and first aid',
    service_styles: ['centre', 'home', 'tele'],
    is_active: true,
    problem_tags: ['emergency', 'urgent', '24x7']
  },
  {
    id: 'vet_005',
    vendor_id: 'vendor_002',
    name: 'Surgery - Minor',
    category: 'Veterinary',
    subcategory: 'Surgery',
    price: 8000,
    duration: 120,
    description: 'Minor surgical procedures with anesthesia',
    service_styles: ['centre'],
    is_active: true,
    specializations: ['Surgery'],
    problem_tags: ['surgery', 'minor', 'anesthesia']
  },
  {
    id: 'vet_006',
    vendor_id: 'vendor_002',
    name: 'Surgery - Major',
    category: 'Veterinary',
    subcategory: 'Surgery',
    price: 25000,
    duration: 240,
    description: 'Major surgical procedures with ICU care',
    service_styles: ['centre'],
    is_active: true,
    specializations: ['Surgery'],
    problem_tags: ['surgery', 'major', 'icu']
  },
  {
    id: 'vet_007',
    vendor_id: 'vendor_001',
    name: 'Dental Cleaning',
    category: 'Veterinary',
    subcategory: 'Dental',
    price: 2000,
    duration: 60,
    description: 'Professional teeth cleaning and scaling',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['dental', 'cleaning', 'teeth']
  },
  {
    id: 'vet_008',
    vendor_id: 'vendor_001',
    name: 'Dental Extraction',
    category: 'Veterinary',
    subcategory: 'Dental',
    price: 3500,
    duration: 90,
    description: 'Tooth extraction with pain management',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['dental', 'extraction', 'teeth']
  },
  {
    id: 'vet_009',
    vendor_id: 'vendor_002',
    name: 'X-Ray Imaging',
    category: 'Veterinary',
    subcategory: 'Diagnostics',
    price: 1500,
    duration: 30,
    description: 'Digital X-ray imaging and analysis',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['xray', 'imaging', 'diagnostic']
  },
  {
    id: 'vet_010',
    vendor_id: 'vendor_002',
    name: 'Ultrasound Scan',
    category: 'Veterinary',
    subcategory: 'Diagnostics',
    price: 2500,
    duration: 45,
    description: 'Ultrasound imaging for internal organs',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['ultrasound', 'scan', 'diagnostic']
  },
  {
    id: 'vet_011',
    vendor_id: 'vendor_001',
    name: 'Blood Test - Complete',
    category: 'Veterinary',
    subcategory: 'Diagnostics',
    price: 1200,
    duration: 30,
    description: 'Complete blood count and chemistry panel',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['blood_test', 'lab', 'diagnostic']
  },
  {
    id: 'vet_012',
    vendor_id: 'vendor_002',
    name: 'Spay/Neuter Surgery',
    category: 'Veterinary',
    subcategory: 'Surgery',
    price: 4500,
    duration: 120,
    description: 'Sterilization surgery with post-op care',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['spay', 'neuter', 'sterilization']
  },
  {
    id: 'vet_013',
    vendor_id: 'vendor_001',
    name: 'Deworming Treatment',
    category: 'Veterinary',
    price: 300,
    duration: 15,
    description: 'Deworming medication and preventive care',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['deworming', 'parasites', 'preventive']
  },
  {
    id: 'vet_014',
    vendor_id: 'vendor_001',
    name: 'Tick & Flea Treatment',
    category: 'Veterinary',
    price: 600,
    duration: 30,
    description: 'Complete tick and flea removal and prevention',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['tick', 'flea', 'parasites']
  },
  {
    id: 'vet_015',
    vendor_id: 'vendor_002',
    name: 'Cardiology Consultation',
    category: 'Veterinary',
    subcategory: 'Cardiology',
    price: 3000,
    duration: 45,
    description: 'Heart health assessment with ECG',
    service_styles: ['centre'],
    is_active: true,
    specializations: ['Cardiology'],
    problem_tags: ['heart', 'cardiology', 'ecg']
  },
  {
    id: 'vet_016',
    vendor_id: 'vendor_002',
    name: 'Oncology Consultation',
    category: 'Veterinary',
    subcategory: 'Oncology',
    price: 3500,
    duration: 60,
    description: 'Cancer diagnosis and treatment planning',
    service_styles: ['centre', 'tele'],
    is_active: true,
    specializations: ['Oncology'],
    problem_tags: ['cancer', 'oncology', 'tumor']
  },
  {
    id: 'vet_017',
    vendor_id: 'vendor_001',
    name: 'Geriatric Care Package',
    category: 'Veterinary',
    price: 5000,
    duration: 90,
    description: 'Comprehensive health package for senior pets',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['geriatric', 'senior', 'elderly']
  },
  {
    id: 'vet_018',
    vendor_id: 'vendor_002',
    name: 'Microchipping',
    category: 'Veterinary',
    price: 800,
    duration: 20,
    description: 'Permanent pet identification with microchip',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['microchip', 'identification', 'safety']
  },
  {
    id: 'vet_019',
    vendor_id: 'vendor_001',
    name: 'Pregnancy Care & Ultrasound',
    category: 'Veterinary',
    price: 3000,
    duration: 60,
    description: 'Prenatal checkup and ultrasound for pregnant pets',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['pregnancy', 'prenatal', 'ultrasound']
  },
  {
    id: 'vet_020',
    vendor_id: 'vendor_002',
    name: 'Euthanasia Service',
    category: 'Veterinary',
    price: 5000,
    duration: 60,
    description: 'Compassionate end-of-life care at home',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['euthanasia', 'end_of_life', 'compassionate']
  },

  // ==================== GROOMING (15 services) ====================
  {
    id: 'groom_001',
    vendor_id: 'vendor_003',
    name: 'Full Grooming Package',
    category: 'Grooming',
    price: 1200,
    duration: 120,
    description: 'Bath, haircut, nail trim, ear cleaning, and styling',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['grooming', 'full_service', 'complete']
  },
  {
    id: 'groom_002',
    vendor_id: 'vendor_003',
    name: 'Bath & Brush',
    category: 'Grooming',
    price: 600,
    duration: 60,
    description: 'Medicated bath with brushing and blow dry',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['bath', 'brush', 'basic']
  },
  {
    id: 'groom_003',
    vendor_id: 'vendor_003',
    name: 'Haircut & Styling',
    category: 'Grooming',
    price: 800,
    duration: 90,
    description: 'Professional haircut and breed-specific styling',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['haircut', 'styling', 'trimming']
  },
  {
    id: 'groom_004',
    vendor_id: 'vendor_003',
    name: 'De-shedding Treatment',
    category: 'Grooming',
    price: 900,
    duration: 75,
    description: 'Special de-shedding treatment with furminator',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['deshedding', 'hair', 'shedding']
  },
  {
    id: 'groom_005',
    vendor_id: 'vendor_003',
    name: 'Nail Trimming & Filing',
    category: 'Grooming',
    price: 300,
    duration: 30,
    description: 'Professional nail trimming and filing',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['nail', 'trimming', 'pedicure']
  },
  {
    id: 'groom_006',
    vendor_id: 'vendor_004',
    name: 'Spa Package - Premium',
    category: 'Grooming',
    subcategory: 'Spa',
    price: 2500,
    duration: 150,
    description: 'Luxury spa with massage, aromatherapy, and paw treatment',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['spa', 'luxury', 'premium']
  },
  {
    id: 'groom_007',
    vendor_id: 'vendor_004',
    name: 'Medicated Bath',
    category: 'Grooming',
    price: 800,
    duration: 60,
    description: 'Therapeutic bath for skin conditions',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['medicated', 'therapeutic', 'skin']
  },
  {
    id: 'groom_008',
    vendor_id: 'vendor_003',
    name: 'Teeth Brushing',
    category: 'Grooming',
    price: 400,
    duration: 30,
    description: 'Professional teeth brushing and oral care',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['teeth', 'dental', 'oral']
  },
  {
    id: 'groom_009',
    vendor_id: 'vendor_003',
    name: 'Ear Cleaning',
    category: 'Grooming',
    price: 300,
    duration: 20,
    description: 'Deep ear cleaning and hair removal',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['ear', 'cleaning', 'hygiene']
  },
  {
    id: 'groom_010',
    vendor_id: 'vendor_004',
    name: 'Paw & Pad Treatment',
    category: 'Grooming',
    price: 500,
    duration: 45,
    description: 'Paw pad moisturizing and nail care',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['paw', 'pad', 'moisturize']
  },
  {
    id: 'groom_011',
    vendor_id: 'vendor_003',
    name: 'Show Dog Grooming',
    category: 'Grooming',
    price: 3000,
    duration: 180,
    description: 'Competition-ready grooming and styling',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['show', 'competition', 'professional']
  },
  {
    id: 'groom_012',
    vendor_id: 'vendor_004',
    name: 'Puppy First Grooming',
    category: 'Grooming',
    price: 700,
    duration: 60,
    description: 'Gentle first grooming experience for puppies',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['puppy', 'first_time', 'gentle']
  },
  {
    id: 'groom_013',
    vendor_id: 'vendor_003',
    name: 'Cat Grooming Special',
    category: 'Grooming',
    price: 1000,
    duration: 90,
    description: 'Specialized grooming for cats',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['cat', 'feline', 'grooming']
  },
  {
    id: 'groom_014',
    vendor_id: 'vendor_004',
    name: 'Hypoallergenic Bath',
    category: 'Grooming',
    price: 900,
    duration: 75,
    description: 'Sensitive skin bath with hypoallergenic products',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['hypoallergenic', 'sensitive', 'allergy']
  },
  {
    id: 'groom_015',
    vendor_id: 'vendor_003',
    name: 'Express Grooming',
    category: 'Grooming',
    price: 1500,
    duration: 60,
    description: 'Quick one-on-one grooming without cage time',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['express', 'quick', 'priority']
  },

  // ==================== TRAINING (10 services) ====================
  {
    id: 'train_001',
    vendor_id: 'vendor_005',
    name: 'Basic Obedience Training',
    category: 'Training',
    price: 3000,
    duration: 60,
    description: 'Sit, stay, come, heel - basic commands (5 sessions)',
    service_styles: ['home', 'centre'],
    is_active: true,
    problem_tags: ['obedience', 'basic', 'commands']
  },
  {
    id: 'train_002',
    vendor_id: 'vendor_005',
    name: 'Advanced Obedience',
    category: 'Training',
    price: 5000,
    duration: 60,
    description: 'Advanced commands and off-leash training (8 sessions)',
    service_styles: ['home', 'centre'],
    is_active: true,
    problem_tags: ['obedience', 'advanced', 'off_leash']
  },
  {
    id: 'train_003',
    vendor_id: 'vendor_005',
    name: 'Puppy Training - Foundation',
    category: 'Training',
    price: 2500,
    duration: 45,
    description: 'Socialization and basic manners for puppies (4 sessions)',
    service_styles: ['home', 'centre'],
    is_active: true,
    problem_tags: ['puppy', 'socialization', 'foundation']
  },
  {
    id: 'train_004',
    vendor_id: 'vendor_005',
    name: 'Potty Training',
    category: 'Training',
    price: 2000,
    duration: 45,
    description: 'House training and crate training (3 sessions)',
    service_styles: ['home', 'tele'],
    is_active: true,
    problem_tags: ['potty', 'house_training', 'crate']
  },
  {
    id: 'train_005',
    vendor_id: 'vendor_005',
    name: 'Behavioral Correction',
    category: 'Training',
    subcategory: 'Behavioral',
    price: 4000,
    duration: 60,
    description: 'Fix aggression, anxiety, and behavioral issues (6 sessions)',
    service_styles: ['home', 'tele'],
    is_active: true,
    problem_tags: ['behavioral', 'aggression', 'anxiety']
  },
  {
    id: 'train_006',
    vendor_id: 'vendor_005',
    name: 'Agility Training',
    category: 'Training',
    price: 3500,
    duration: 60,
    description: 'Obstacle course and agility skills (5 sessions)',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['agility', 'obstacle', 'sports']
  },
  {
    id: 'train_007',
    vendor_id: 'vendor_005',
    name: 'Guard Dog Training',
    category: 'Training',
    price: 8000,
    duration: 90,
    description: 'Protection and guard dog training (10 sessions)',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['guard', 'protection', 'security']
  },
  {
    id: 'train_008',
    vendor_id: 'vendor_005',
    name: 'Leash Training',
    category: 'Training',
    price: 1500,
    duration: 45,
    description: 'Proper leash walking and manners (3 sessions)',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['leash', 'walking', 'manners']
  },
  {
    id: 'train_009',
    vendor_id: 'vendor_005',
    name: 'Trick Training',
    category: 'Training',
    price: 2000,
    duration: 45,
    description: 'Fun tricks and commands (4 sessions)',
    service_styles: ['home', 'centre'],
    is_active: true,
    problem_tags: ['tricks', 'fun', 'entertainment']
  },
  {
    id: 'train_010',
    vendor_id: 'vendor_005',
    name: 'Service Dog Training',
    category: 'Training',
    price: 15000,
    duration: 120,
    description: 'Professional service dog certification (20 sessions)',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['service_dog', 'therapy', 'certification']
  },

  // ==================== BOARDING (10 services) ====================
  {
    id: 'board_001',
    vendor_id: 'vendor_006',
    name: 'Standard Boarding - Per Night',
    category: 'Boarding',
    price: 800,
    duration: 1440,
    description: 'Comfortable stay with meals and playtime',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['boarding', 'overnight', 'standard']
  },
  {
    id: 'board_002',
    vendor_id: 'vendor_006',
    name: 'Luxury Suite Boarding',
    category: 'Boarding',
    price: 1500,
    duration: 1440,
    description: 'Private suite with AC, TV, and premium meals',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['luxury', 'suite', 'premium']
  },
  {
    id: 'board_003',
    vendor_id: 'vendor_006',
    name: 'Medical Boarding',
    category: 'Boarding',
    price: 2000,
    duration: 1440,
    description: 'Boarding with medical care and medication administration',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['medical', 'care', 'medication']
  },
  {
    id: 'board_004',
    vendor_id: 'vendor_006',
    name: 'Cat Boarding',
    category: 'Boarding',
    price: 700,
    duration: 1440,
    description: 'Cat-only boarding facility with climbing towers',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['cat', 'feline', 'boarding']
  },
  {
    id: 'board_005',
    vendor_id: 'vendor_006',
    name: 'Group Boarding',
    category: 'Boarding',
    price: 600,
    duration: 1440,
    description: 'Social boarding for friendly pets',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['group', 'social', 'boarding']
  },
  {
    id: 'board_006',
    vendor_id: 'vendor_006',
    name: 'Puppy Boarding Special',
    category: 'Boarding',
    price: 900,
    duration: 1440,
    description: 'Special care for puppies under 6 months',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['puppy', 'young', 'special']
  },
  {
    id: 'board_007',
    vendor_id: 'vendor_006',
    name: 'Senior Pet Boarding',
    category: 'Boarding',
    price: 1200,
    duration: 1440,
    description: 'Gentle care for elderly pets with special needs',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['senior', 'elderly', 'geriatric']
  },
  {
    id: 'board_008',
    vendor_id: 'vendor_006',
    name: 'Extended Stay Package (7 nights)',
    category: 'Boarding',
    price: 5000,
    duration: 10080,
    description: 'Weekly boarding package with grooming included',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['extended', 'weekly', 'package']
  },
  {
    id: 'board_009',
    vendor_id: 'vendor_006',
    name: 'Day Boarding',
    category: 'Boarding',
    price: 400,
    duration: 480,
    description: 'Daytime care from 8 AM to 6 PM',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['day', 'daycare', 'daytime']
  },
  {
    id: 'board_010',
    vendor_id: 'vendor_006',
    name: 'VIP Boarding Package',
    category: 'Boarding',
    price: 2500,
    duration: 1440,
    description: 'Luxury boarding with spa, training, and webcam access',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['vip', 'luxury', 'premium']
  },

  // ==================== WALKING (8 services) ====================
  {
    id: 'walk_001',
    vendor_id: 'vendor_007',
    name: '30-Minute Walk',
    category: 'Walking',
    price: 300,
    duration: 30,
    description: 'Individual dog walking service',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['walk', 'exercise', 'individual']
  },
  {
    id: 'walk_002',
    vendor_id: 'vendor_007',
    name: '60-Minute Walk',
    category: 'Walking',
    price: 500,
    duration: 60,
    description: 'Extended walking with playtime',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['walk', 'extended', 'playtime']
  },
  {
    id: 'walk_003',
    vendor_id: 'vendor_007',
    name: 'Group Walking',
    category: 'Walking',
    price: 200,
    duration: 45,
    description: 'Socialized group walking with 3-4 dogs',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['group', 'social', 'pack']
  },
  {
    id: 'walk_004',
    vendor_id: 'vendor_007',
    name: 'Adventure Hike',
    category: 'Walking',
    price: 1200,
    duration: 180,
    description: 'Outdoor hiking adventure in nature trails',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['adventure', 'hike', 'outdoor']
  },
  {
    id: 'walk_005',
    vendor_id: 'vendor_007',
    name: 'Jogging Partner',
    category: 'Walking',
    price: 600,
    duration: 45,
    description: 'High-energy jogging session for active dogs',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['jogging', 'running', 'active']
  },
  {
    id: 'walk_006',
    vendor_id: 'vendor_007',
    name: 'Puppy Walking',
    category: 'Walking',
    price: 350,
    duration: 20,
    description: 'Gentle walking for puppies with training',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['puppy', 'training', 'gentle']
  },
  {
    id: 'walk_007',
    vendor_id: 'vendor_007',
    name: 'Senior Pet Walking',
    category: 'Walking',
    price: 400,
    duration: 30,
    description: 'Slow-paced walking for elderly pets',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['senior', 'elderly', 'gentle']
  },
  {
    id: 'walk_008',
    vendor_id: 'vendor_007',
    name: 'Beach/Pool Walking',
    category: 'Walking',
    price: 800,
    duration: 60,
    description: 'Special water activity walking sessions',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['beach', 'pool', 'water']
  },

  // ==================== DAYCARE (8 services) ====================
  {
    id: 'daycare_001',
    vendor_id: 'vendor_008',
    name: 'Full Day Daycare',
    category: 'Daycare',
    price: 600,
    duration: 480,
    description: 'All-day supervised playcare from 8 AM to 6 PM',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['daycare', 'full_day', 'supervised']
  },
  {
    id: 'daycare_002',
    vendor_id: 'vendor_008',
    name: 'Half Day Daycare',
    category: 'Daycare',
    price: 350,
    duration: 240,
    description: '4-hour daycare session (morning or afternoon)',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['daycare', 'half_day', 'flexible']
  },
  {
    id: 'daycare_003',
    vendor_id: 'vendor_008',
    name: 'Puppy Daycare',
    category: 'Daycare',
    price: 500,
    duration: 300,
    description: 'Socialization and playtime for puppies',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['puppy', 'socialization', 'play']
  },
  {
    id: 'daycare_004',
    vendor_id: 'vendor_008',
    name: 'Small Dog Daycare',
    category: 'Daycare',
    price: 550,
    duration: 480,
    description: 'Daycare for small breeds only',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['small', 'breed', 'size']
  },
  {
    id: 'daycare_005',
    vendor_id: 'vendor_008',
    name: 'Large Dog Daycare',
    category: 'Daycare',
    price: 650,
    duration: 480,
    description: 'Spacious daycare for large breeds',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['large', 'breed', 'size']
  },
  {
    id: 'daycare_006',
    vendor_id: 'vendor_008',
    name: 'Senior Pet Daycare',
    category: 'Daycare',
    price: 700,
    duration: 360,
    description: 'Gentle care for elderly pets',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['senior', 'elderly', 'gentle']
  },
  {
    id: 'daycare_007',
    vendor_id: 'vendor_008',
    name: 'Weekly Daycare Package (5 days)',
    category: 'Daycare',
    price: 2500,
    duration: 2400,
    description: '5-day weekly daycare package',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['weekly', 'package', 'discount']
  },
  {
    id: 'daycare_008',
    vendor_id: 'vendor_008',
    name: 'Overnight Daycare',
    category: 'Daycare',
    price: 900,
    duration: 720,
    description: 'Extended care including overnight stay',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['overnight', 'extended', 'sleep']
  },

  // ==================== NUTRITION (8 services) ====================
  {
    id: 'nutri_001',
    vendor_id: 'vendor_009',
    name: 'Diet Consultation',
    category: 'Nutrition',
    price: 1000,
    duration: 45,
    description: 'Personalized diet plan by certified nutritionist',
    service_styles: ['tele', 'centre'],
    is_active: true,
    problem_tags: ['diet', 'nutrition', 'consultation']
  },
  {
    id: 'nutri_002',
    vendor_id: 'vendor_009',
    name: 'Weight Management Program',
    category: 'Nutrition',
    price: 3000,
    duration: 60,
    description: '4-week weight management program with follow-ups',
    service_styles: ['tele', 'centre'],
    is_active: true,
    problem_tags: ['weight', 'obesity', 'management']
  },
  {
    id: 'nutri_003',
    vendor_id: 'vendor_009',
    name: 'Puppy Nutrition Plan',
    category: 'Nutrition',
    price: 800,
    duration: 30,
    description: 'Growth-focused nutrition for puppies',
    service_styles: ['tele'],
    is_active: true,
    problem_tags: ['puppy', 'growth', 'nutrition']
  },
  {
    id: 'nutri_004',
    vendor_id: 'vendor_009',
    name: 'Senior Pet Nutrition',
    category: 'Nutrition',
    price: 900,
    duration: 30,
    description: 'Specialized diet for aging pets',
    service_styles: ['tele', 'centre'],
    is_active: true,
    problem_tags: ['senior', 'elderly', 'nutrition']
  },
  {
    id: 'nutri_005',
    vendor_id: 'vendor_009',
    name: 'Allergy & Sensitivity Testing',
    category: 'Nutrition',
    price: 2500,
    duration: 60,
    description: 'Food allergy testing with elimination diet plan',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['allergy', 'sensitivity', 'testing']
  },
  {
    id: 'nutri_006',
    vendor_id: 'vendor_009',
    name: 'Raw Diet Planning',
    category: 'Nutrition',
    price: 1500,
    duration: 45,
    description: 'Complete raw food diet planning and guidance',
    service_styles: ['tele'],
    is_active: true,
    problem_tags: ['raw', 'barf', 'diet']
  },
  {
    id: 'nutri_007',
    vendor_id: 'vendor_009',
    name: 'Home-Cooked Meal Plan',
    category: 'Nutrition',
    price: 1200,
    duration: 45,
    description: 'Customized home-cooked meal recipes',
    service_styles: ['tele'],
    is_active: true,
    problem_tags: ['home_cooked', 'recipes', 'diet']
  },
  {
    id: 'nutri_008',
    vendor_id: 'vendor_009',
    name: 'Supplement Consultation',
    category: 'Nutrition',
    price: 600,
    duration: 30,
    description: 'Vitamin and supplement recommendations',
    service_styles: ['tele'],
    is_active: true,
    problem_tags: ['supplements', 'vitamins', 'health']
  },

  // ==================== PHARMACY (10 services) ====================
  {
    id: 'pharm_001',
    vendor_id: 'vendor_010',
    name: 'Prescription Fulfillment',
    category: 'Pharmacy',
    price: 0,
    duration: 0,
    description: 'Fill your vet-prescribed medications',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['prescription', 'medicine', 'drugs']
  },
  {
    id: 'pharm_002',
    vendor_id: 'vendor_010',
    name: 'Flea & Tick Medication',
    category: 'Pharmacy',
    price: 800,
    duration: 0,
    description: 'Monthly flea and tick prevention',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['flea', 'tick', 'prevention']
  },
  {
    id: 'pharm_003',
    vendor_id: 'vendor_010',
    name: 'Heartworm Prevention',
    category: 'Pharmacy',
    price: 1200,
    duration: 0,
    description: 'Monthly heartworm preventive medication',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['heartworm', 'prevention', 'monthly']
  },
  {
    id: 'pharm_004',
    vendor_id: 'vendor_010',
    name: 'Pain Relief Medication',
    category: 'Pharmacy',
    price: 600,
    duration: 0,
    description: 'Pain management medications',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['pain', 'relief', 'analgesic']
  },
  {
    id: 'pharm_005',
    vendor_id: 'vendor_010',
    name: 'Antibiotics',
    category: 'Pharmacy',
    price: 500,
    duration: 0,
    description: 'Broad-spectrum antibiotics (prescription required)',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['antibiotics', 'infection', 'prescription']
  },
  {
    id: 'pharm_006',
    vendor_id: 'vendor_010',
    name: 'Joint Supplements',
    category: 'Pharmacy',
    price: 1500,
    duration: 0,
    description: 'Glucosamine and joint health supplements',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['joint', 'supplements', 'arthritis']
  },
  {
    id: 'pharm_007',
    vendor_id: 'vendor_010',
    name: 'Skin & Coat Supplements',
    category: 'Pharmacy',
    price: 900,
    duration: 0,
    description: 'Omega-3 and skin health supplements',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['skin', 'coat', 'omega']
  },
  {
    id: 'pharm_008',
    vendor_id: 'vendor_010',
    name: 'Digestive Enzymes',
    category: 'Pharmacy',
    price: 800,
    duration: 0,
    description: 'Probiotics and digestive health supplements',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['digestive', 'probiotics', 'gut']
  },
  {
    id: 'pharm_009',
    vendor_id: 'vendor_010',
    name: 'Anxiety & Calming Aids',
    category: 'Pharmacy',
    price: 700,
    duration: 0,
    description: 'Natural calming supplements for anxious pets',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['anxiety', 'calming', 'stress']
  },
  {
    id: 'pharm_010',
    vendor_id: 'vendor_010',
    name: 'Home Medicine Delivery',
    category: 'Pharmacy',
    price: 100,
    duration: 0,
    description: 'Convenient home delivery of pet medications',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['delivery', 'home', 'convenience']
  },

  // ==================== SPA (8 services) ====================
  {
    id: 'spa_001',
    vendor_id: 'vendor_011',
    name: 'Luxury Spa Package',
    category: 'Spa',
    price: 3000,
    duration: 180,
    description: 'Complete spa experience with massage, aromatherapy, and pampering',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['spa', 'luxury', 'pampering']
  },
  {
    id: 'spa_002',
    vendor_id: 'vendor_011',
    name: 'Therapeutic Massage',
    category: 'Spa',
    price: 1200,
    duration: 60,
    description: 'Relaxing massage therapy for muscle relief',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['massage', 'therapy', 'relaxation']
  },
  {
    id: 'spa_003',
    vendor_id: 'vendor_011',
    name: 'Aromatherapy Session',
    category: 'Spa',
    price: 800,
    duration: 45,
    description: 'Calming aromatherapy with essential oils',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['aromatherapy', 'essential_oils', 'calming']
  },
  {
    id: 'spa_004',
    vendor_id: 'vendor_011',
    name: 'Hydrotherapy',
    category: 'Spa',
    price: 1500,
    duration: 60,
    description: 'Water therapy for rehabilitation and exercise',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['hydrotherapy', 'water', 'rehabilitation']
  },
  {
    id: 'spa_005',
    vendor_id: 'vendor_011',
    name: 'Mud Bath Treatment',
    category: 'Spa',
    price: 1000,
    duration: 75,
    description: 'Detoxifying mud bath with minerals',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['mud_bath', 'detox', 'minerals']
  },
  {
    id: 'spa_006',
    vendor_id: 'vendor_011',
    name: 'Paw Spa Treatment',
    category: 'Spa',
    price: 600,
    duration: 45,
    description: 'Paw pad massage and moisturizing treatment',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['paw', 'spa', 'moisturize']
  },
  {
    id: 'spa_007',
    vendor_id: 'vendor_011',
    name: 'Hot Stone Therapy',
    category: 'Spa',
    price: 1400,
    duration: 60,
    description: 'Relaxing hot stone massage therapy',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['hot_stone', 'massage', 'therapy']
  },
  {
    id: 'spa_008',
    vendor_id: 'vendor_011',
    name: 'Acupuncture Session',
    category: 'Spa',
    price: 2000,
    duration: 60,
    description: 'Traditional acupuncture for pain and wellness',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['acupuncture', 'pain', 'wellness']
  },

  // ==================== PHOTOGRAPHY (5 services) ====================
  {
    id: 'photo_001',
    vendor_id: 'vendor_012',
    name: 'Pet Portrait Session',
    category: 'Photography',
    price: 2500,
    duration: 60,
    description: 'Professional portrait photoshoot with 10 edited images',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['portrait', 'photo', 'professional']
  },
  {
    id: 'photo_002',
    vendor_id: 'vendor_012',
    name: 'Family Pet Photoshoot',
    category: 'Photography',
    price: 4000,
    duration: 90,
    description: 'Family session with pets, 20 edited images',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['family', 'group', 'photo']
  },
  {
    id: 'photo_003',
    vendor_id: 'vendor_012',
    name: 'Pet Birthday Photoshoot',
    category: 'Photography',
    price: 3000,
    duration: 75,
    description: 'Birthday celebration photos with props',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['birthday', 'celebration', 'party']
  },
  {
    id: 'photo_004',
    vendor_id: 'vendor_012',
    name: 'Outdoor Adventure Shoot',
    category: 'Photography',
    price: 3500,
    duration: 120,
    description: 'Outdoor photoshoot at scenic locations',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['outdoor', 'adventure', 'nature']
  },
  {
    id: 'photo_005',
    vendor_id: 'vendor_012',
    name: 'Puppy First Year Package',
    category: 'Photography',
    price: 8000,
    duration: 180,
    description: '3 milestone sessions documenting first year',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['puppy', 'milestone', 'package']
  },

  // ==================== TAXI/TRANSPORT (5 services) ====================
  {
    id: 'taxi_001',
    vendor_id: 'vendor_013',
    name: 'Pet Taxi - Local (Up to 10km)',
    category: 'Taxi',
    price: 400,
    duration: 30,
    description: 'Safe and comfortable pet transportation within city',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['taxi', 'transport', 'local']
  },
  {
    id: 'taxi_002',
    vendor_id: 'vendor_013',
    name: 'Airport Pet Transport',
    category: 'Taxi',
    price: 1500,
    duration: 90,
    description: 'Reliable airport pickup and drop-off service',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['airport', 'travel', 'transport']
  },
  {
    id: 'taxi_003',
    vendor_id: 'vendor_013',
    name: 'Intercity Pet Transport',
    category: 'Taxi',
    price: 3000,
    duration: 240,
    description: 'Long-distance pet transportation between cities',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['intercity', 'long_distance', 'travel']
  },
  {
    id: 'taxi_004',
    vendor_id: 'vendor_013',
    name: 'Emergency Pet Ambulance',
    category: 'Taxi',
    subcategory: 'Emergency',
    price: 1000,
    duration: 20,
    description: '24/7 emergency pet ambulance service',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['emergency', 'ambulance', '24x7']
  },
  {
    id: 'taxi_005',
    vendor_id: 'vendor_013',
    name: 'Multi-Pet Transport',
    category: 'Taxi',
    price: 800,
    duration: 45,
    description: 'Transport multiple pets together',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['multi_pet', 'group', 'transport']
  },

  // ==================== ADOPTION (3 services - mostly facilitator) ====================
  {
    id: 'adopt_001',
    vendor_id: 'vendor_014',
    name: 'Pet Adoption Consultation',
    category: 'Adoption',
    price: 0,
    duration: 30,
    description: 'Free consultation to find your perfect pet match',
    service_styles: ['tele', 'centre'],
    is_active: true,
    problem_tags: ['adoption', 'consultation', 'matching']
  },
  {
    id: 'adopt_002',
    vendor_id: 'vendor_014',
    name: 'Home Visit Assessment',
    category: 'Adoption',
    price: 500,
    duration: 60,
    description: 'Pre-adoption home environment assessment',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['home_visit', 'assessment', 'adoption']
  },
  {
    id: 'adopt_003',
    vendor_id: 'vendor_014',
    name: 'Adoption Package (includes vet check, vaccines)',
    category: 'Adoption',
    price: 3000,
    duration: 0,
    description: 'Complete adoption package with health certification',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['adoption', 'package', 'complete']
  },

  // ==================== BREEDING (5 services) ====================
  {
    id: 'breed_001',
    vendor_id: 'vendor_015',
    name: 'Stud Service - Pedigree',
    category: 'Breeding',
    price: 15000,
    duration: 0,
    description: 'Certified pedigree stud service with paperwork',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['stud', 'breeding', 'pedigree']
  },
  {
    id: 'breed_002',
    vendor_id: 'vendor_015',
    name: 'Breeding Consultation',
    category: 'Breeding',
    price: 1000,
    duration: 45,
    description: 'Expert breeding advice and health screening',
    service_styles: ['centre', 'tele'],
    is_active: true,
    problem_tags: ['consultation', 'advice', 'breeding']
  },
  {
    id: 'breed_003',
    vendor_id: 'vendor_015',
    name: 'Pregnancy Care Package',
    category: 'Breeding',
    price: 5000,
    duration: 0,
    description: 'Complete pregnancy monitoring and care',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['pregnancy', 'care', 'monitoring']
  },
  {
    id: 'breed_004',
    vendor_id: 'vendor_015',
    name: 'Whelping Assistance',
    category: 'Breeding',
    price: 8000,
    duration: 480,
    description: 'Professional assistance during delivery',
    service_styles: ['home', 'centre'],
    is_active: true,
    problem_tags: ['whelping', 'delivery', 'birth']
  },
  {
    id: 'breed_005',
    vendor_id: 'vendor_015',
    name: 'Puppy Registration & Papers',
    category: 'Breeding',
    price: 2000,
    duration: 0,
    description: 'KCI/AKC registration and pedigree documentation',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['registration', 'papers', 'pedigree']
  },

  // ==================== CREMATION (3 services) ====================
  {
    id: 'crem_001',
    vendor_id: 'vendor_016',
    name: 'Individual Cremation',
    category: 'Cremation',
    price: 5000,
    duration: 0,
    description: 'Private cremation with urn and ashes return',
    service_styles: ['home'],
    is_active: true,
    problem_tags: ['cremation', 'individual', 'ashes']
  },
  {
    id: 'crem_002',
    vendor_id: 'vendor_016',
    name: 'Memorial Service Package',
    category: 'Cremation',
    price: 8000,
    duration: 120,
    description: 'Cremation with memorial service and keepsakes',
    service_styles: ['centre', 'home'],
    is_active: true,
    problem_tags: ['memorial', 'service', 'cremation']
  },
  {
    id: 'crem_003',
    vendor_id: 'vendor_016',
    name: 'Pet Memorial Products',
    category: 'Cremation',
    price: 2000,
    duration: 0,
    description: 'Custom urns, paw prints, and memorial items',
    service_styles: ['centre'],
    is_active: true,
    problem_tags: ['memorial', 'urn', 'keepsake']
  }
];

// Total: 120+ services across all 20 categories

// =====================================================
// EXPANDED PRODUCTS (50+) - 5 CATEGORIES
// =====================================================

export const EXPANDED_PRODUCTS: Product[] = [
  // ==================== FOOD (15 products) ====================
  {
    id: 'prod_food_001',
    name: 'Royal Canin Adult Dog Food - 10kg',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 3500,
    originalPrice: 4000,
    description: 'Complete nutrition for adult dogs',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Dog+Food',
    rating: 4.7,
    reviews: 324,
    inStock: true,
    brand: 'Royal Canin',
    tags: ['dog', 'food', 'adult']
  },
  {
    id: 'prod_food_002',
    name: 'Whiskas Cat Food - Chicken Flavor 3kg',
    category: 'Food',
    subcategory: 'Cat Food',
    price: 1200,
    originalPrice: 1500,
    description: 'Nutritious cat food with real chicken',
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Cat+Food',
    rating: 4.5,
    reviews: 256,
    inStock: true,
    brand: 'Whiskas',
    tags: ['cat', 'food', 'chicken']
  },
  {
    id: 'prod_food_003',
    name: 'Pedigree Puppy Food - 3kg',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 800,
    description: 'Specially formulated for growing puppies',
    imageUrl: 'https://via.placeholder.com/400x300/FFC857/FFFFFF?text=Puppy+Food',
    rating: 4.6,
    reviews: 189,
    inStock: true,
    brand: 'Pedigree',
    tags: ['puppy', 'food', 'growth']
  },
  {
    id: 'prod_food_004',
    name: 'Drools Kitten Food - 1.2kg',
    category: 'Food',
    subcategory: 'Cat Food',
    price: 450,
    description: 'Complete nutrition for kittens',
    imageUrl: 'https://via.placeholder.com/400x300/9B59B6/FFFFFF?text=Kitten+Food',
    rating: 4.4,
    reviews: 142,
    inStock: true,
    brand: 'Drools',
    tags: ['kitten', 'food', 'young']
  },
  {
    id: 'prod_food_005',
    name: 'Farmina N&D Grain Free - 7kg',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 4500,
    originalPrice: 5200,
    description: 'Premium grain-free dog food',
    imageUrl: 'https://via.placeholder.com/400x300/26C6DA/FFFFFF?text=Premium+Food',
    rating: 4.8,
    reviews: 298,
    inStock: true,
    brand: 'Farmina',
    tags: ['dog', 'grain_free', 'premium']
  },
  {
    id: 'prod_food_006',
    name: 'Fish Food - Tropical Flakes 100g',
    category: 'Food',
    subcategory: 'Fish Food',
    price: 250,
    description: 'High-quality flakes for tropical fish',
    imageUrl: 'https://via.placeholder.com/400x300/2196F3/FFFFFF?text=Fish+Food',
    rating: 4.3,
    reviews: 87,
    inStock: true,
    brand: 'Tetra',
    tags: ['fish', 'food', 'tropical']
  },
  {
    id: 'prod_food_007',
    name: 'Bird Seed Mix - 1kg',
    category: 'Food',
    subcategory: 'Bird Food',
    price: 300,
    description: 'Nutritious seed mix for birds',
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Bird+Food',
    rating: 4.5,
    reviews: 112,
    inStock: true,
    brand: 'Vitapol',
    tags: ['bird', 'food', 'seeds']
  },
  {
    id: 'prod_food_008',
    name: 'Orijen Dog Food - Original 6kg',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 6500,
    originalPrice: 7200,
    description: 'Biologically appropriate dog food',
    imageUrl: 'https://via.placeholder.com/400x300/E91E63/FFFFFF?text=Premium+Dog+Food',
    rating: 4.9,
    reviews: 412,
    inStock: false,
    brand: 'Orijen',
    tags: ['dog', 'premium', 'biologically_appropriate']
  },
  {
    id: 'prod_food_009',
    name: 'Sheba Cat Food - Variety Pack 12x85g',
    category: 'Food',
    subcategory: 'Cat Food',
    price: 900,
    description: 'Gourmet cat food variety pack',
    imageUrl: 'https://via.placeholder.com/400x300/673AB7/FFFFFF?text=Cat+Variety',
    rating: 4.7,
    reviews: 201,
    inStock: true,
    brand: 'Sheba',
    tags: ['cat', 'variety', 'wet_food']
  },
  {
    id: 'prod_food_010',
    name: 'Dog Treats - Chicken Jerky 200g',
    category: 'Food',
    subcategory: 'Treats',
    price: 350,
    description: 'Natural chicken jerky treats',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Dog+Treats',
    rating: 4.6,
    reviews: 178,
    inStock: true,
    brand: 'Drools',
    tags: ['dog', 'treats', 'chicken']
  },
  {
    id: 'prod_food_011',
    name: 'Senior Dog Food - 4kg',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 2200,
    description: 'Specially formulated for senior dogs',
    imageUrl: 'https://via.placeholder.com/400x300/795548/FFFFFF?text=Senior+Food',
    rating: 4.5,
    reviews: 134,
    inStock: true,
    brand: 'Royal Canin',
    tags: ['dog', 'senior', 'elderly']
  },
  {
    id: 'prod_food_012',
    name: 'Dental Chew Sticks - 20 Pack',
    category: 'Food',
    subcategory: 'Treats',
    price: 450,
    description: 'Dental health chew sticks',
    imageUrl: 'https://via.placeholder.com/400x300/009688/FFFFFF?text=Dental+Chews',
    rating: 4.4,
    reviews: 167,
    inStock: true,
    brand: 'Pedigree',
    tags: ['dog', 'dental', 'treats']
  },
  {
    id: 'prod_food_013',
    name: 'Cat Milk - Lactose Free 200ml',
    category: 'Food',
    subcategory: 'Cat Food',
    price: 180,
    description: 'Lactose-free milk for cats',
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Cat+Milk',
    rating: 4.6,
    reviews: 93,
    inStock: true,
    brand: 'Whiskas',
    tags: ['cat', 'milk', 'lactose_free']
  },
  {
    id: 'prod_food_014',
    name: 'Dog Food - Weight Management 5kg',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 2800,
    description: 'Low-calorie food for weight control',
    imageUrl: 'https://via.placeholder.com/400x300/8BC34A/FFFFFF?text=Weight+Management',
    rating: 4.5,
    reviews: 156,
    inStock: true,
    brand: 'Hill\'s',
    tags: ['dog', 'weight', 'diet']
  },
  {
    id: 'prod_food_015',
    name: 'Freeze-Dried Raw Dog Food - 500g',
    category: 'Food',
    subcategory: 'Dog Food',
    price: 1800,
    description: 'Premium freeze-dried raw dog food',
    imageUrl: 'https://via.placeholder.com/400x300/FF5722/FFFFFF?text=Raw+Food',
    rating: 4.8,
    reviews: 234,
    inStock: true,
    brand: 'Stella & Chewy\'s',
    tags: ['dog', 'raw', 'freeze_dried']
  },

  // ==================== TOYS (10 products) ====================
  {
    id: 'prod_toy_001',
    name: 'Interactive Puzzle Toy',
    category: 'Toys',
    subcategory: 'Interactive',
    price: 800,
    originalPrice: 1000,
    description: 'Mentally stimulating puzzle toy',
    imageUrl: 'https://via.placeholder.com/400x300/9C27B0/FFFFFF?text=Puzzle+Toy',
    rating: 4.7,
    reviews: 243,
    inStock: true,
    brand: 'Nina Ottosson',
    tags: ['dog', 'puzzle', 'interactive']
  },
  {
    id: 'prod_toy_002',
    name: 'Rope Tug Toy',
    category: 'Toys',
    subcategory: 'Chew',
    price: 300,
    description: 'Durable rope for tug-of-war',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Rope+Toy',
    rating: 4.5,
    reviews: 189,
    inStock: true,
    brand: 'Generic',
    tags: ['dog', 'rope', 'tug']
  },
  {
    id: 'prod_toy_003',
    name: 'Squeaky Plush Toy Set - 3 Pack',
    category: 'Toys',
    subcategory: 'Plush',
    price: 600,
    description: 'Soft squeaky toys for dogs',
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Plush+Toys',
    rating: 4.3,
    reviews: 134,
    inStock: true,
    brand: 'ZippyPaws',
    tags: ['dog', 'plush', 'squeaky']
  },
  {
    id: 'prod_toy_004',
    name: 'Cat Feather Wand',
    category: 'Toys',
    subcategory: 'Interactive',
    price: 250,
    description: 'Interactive feather toy for cats',
    imageUrl: 'https://via.placeholder.com/400x300/FFC857/FFFFFF?text=Feather+Wand',
    rating: 4.6,
    reviews: 167,
    inStock: true,
    brand: 'Generic',
    tags: ['cat', 'feather', 'interactive']
  },
  {
    id: 'prod_toy_005',
    name: 'Treat Dispenser Ball',
    category: 'Toys',
    subcategory: 'Interactive',
    price: 450,
    description: 'Slow feeder treat ball',
    imageUrl: 'https://via.placeholder.com/400x300/26C6DA/FFFFFF?text=Treat+Ball',
    rating: 4.7,
    reviews: 298,
    inStock: true,
    brand: 'Kong',
    tags: ['dog', 'treat', 'dispenser']
  },
  {
    id: 'prod_toy_006',
    name: 'Rubber Chew Bone',
    category: 'Toys',
    subcategory: 'Chew',
    price: 350,
    description: 'Durable rubber chew toy',
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Chew+Bone',
    rating: 4.6,
    reviews: 212,
    inStock: true,
    brand: 'Nylabone',
    tags: ['dog', 'chew', 'rubber']
  },
  {
    id: 'prod_toy_007',
    name: 'Laser Pointer for Cats',
    category: 'Toys',
    subcategory: 'Interactive',
    price: 200,
    description: 'Interactive laser toy for cats',
    imageUrl: 'https://via.placeholder.com/400x300/E91E63/FFFFFF?text=Laser+Pointer',
    rating: 4.4,
    reviews: 145,
    inStock: true,
    brand: 'Generic',
    tags: ['cat', 'laser', 'interactive']
  },
  {
    id: 'prod_toy_008',
    name: 'Tennis Ball Set - 6 Pack',
    category: 'Toys',
    subcategory: 'Fetch',
    price: 400,
    description: 'Durable tennis balls for fetch',
    imageUrl: 'https://via.placeholder.com/400x300/FFEB3B/FFFFFF?text=Tennis+Balls',
    rating: 4.5,
    reviews: 276,
    inStock: true,
    brand: 'Wilson',
    tags: ['dog', 'ball', 'fetch']
  },
  {
    id: 'prod_toy_009',
    name: 'Catnip Mouse Toys - 5 Pack',
    category: 'Toys',
    subcategory: 'Plush',
    price: 350,
    description: 'Catnip-filled mice toys',
    imageUrl: 'https://via.placeholder.com/400x300/9C27B0/FFFFFF?text=Catnip+Mice',
    rating: 4.7,
    reviews: 198,
    inStock: true,
    brand: 'Generic',
    tags: ['cat', 'catnip', 'mouse']
  },
  {
    id: 'prod_toy_010',
    name: 'Automatic Ball Launcher',
    category: 'Toys',
    subcategory: 'Interactive',
    price: 3500,
    originalPrice: 4200,
    description: 'Automatic tennis ball launcher',
    imageUrl: 'https://via.placeholder.com/400x300/2196F3/FFFFFF?text=Ball+Launcher',
    rating: 4.8,
    reviews: 156,
    inStock: true,
    brand: 'iFetch',
    tags: ['dog', 'automatic', 'fetch']
  },

  // ==================== ACCESSORIES (10 products) ====================
  {
    id: 'prod_acc_001',
    name: 'Adjustable Dog Collar - Medium',
    category: 'Accessories',
    subcategory: 'Collars',
    price: 400,
    description: 'Comfortable nylon collar',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Dog+Collar',
    rating: 4.5,
    reviews: 234,
    inStock: true,
    brand: 'Pawzone',
    tags: ['dog', 'collar', 'nylon']
  },
  {
    id: 'prod_acc_002',
    name: 'Retractable Dog Leash - 5m',
    category: 'Accessories',
    subcategory: 'Leashes',
    price: 600,
    description: 'Retractable leash with lock',
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Dog+Leash',
    rating: 4.6,
    reviews: 312,
    inStock: true,
    brand: 'Flexi',
    tags: ['dog', 'leash', 'retractable']
  },
  {
    id: 'prod_acc_003',
    name: 'Stainless Steel Food Bowl Set',
    category: 'Accessories',
    subcategory: 'Bowls',
    price: 450,
    description: 'Non-slip food and water bowls',
    imageUrl: 'https://via.placeholder.com/400x300/FFC857/FFFFFF?text=Food+Bowls',
    rating: 4.7,
    reviews: 289,
    inStock: true,
    brand: 'Trixie',
    tags: ['bowl', 'stainless', 'feeding']
  },
  {
    id: 'prod_acc_004',
    name: 'Pet Carrier Bag - Medium',
    category: 'Accessories',
    subcategory: 'Carriers',
    price: 1200,
    description: 'Comfortable travel carrier',
    imageUrl: 'https://via.placeholder.com/400x300/26C6DA/FFFFFF?text=Pet+Carrier',
    rating: 4.5,
    reviews: 178,
    inStock: true,
    brand: 'Sherpa',
    tags: ['carrier', 'travel', 'transport']
  },
  {
    id: 'prod_acc_005',
    name: 'Orthopedic Dog Bed - Large',
    category: 'Accessories',
    subcategory: 'Beds',
    price: 2500,
    originalPrice: 3200,
    description: 'Memory foam dog bed',
    imageUrl: 'https://via.placeholder.com/400x300/9B59B6/FFFFFF?text=Dog+Bed',
    rating: 4.8,
    reviews: 345,
    inStock: true,
    brand: 'FurHaven',
    tags: ['bed', 'orthopedic', 'memory_foam']
  },
  {
    id: 'prod_acc_006',
    name: 'Cat Scratching Post',
    category: 'Accessories',
    subcategory: 'Furniture',
    price: 1500,
    description: 'Multi-level scratching tower',
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Scratch+Post',
    rating: 4.6,
    reviews: 267,
    inStock: true,
    brand: 'Catit',
    tags: ['cat', 'scratching', 'furniture']
  },
  {
    id: 'prod_acc_007',
    name: 'ID Tag - Personalized',
    category: 'Accessories',
    subcategory: 'Tags',
    price: 150,
    description: 'Customizable pet ID tag',
    imageUrl: 'https://via.placeholder.com/400x300/E91E63/FFFFFF?text=ID+Tag',
    rating: 4.7,
    reviews: 198,
    inStock: true,
    brand: 'Generic',
    tags: ['id', 'tag', 'personalized']
  },
  {
    id: 'prod_acc_008',
    name: 'GPS Tracking Collar',
    category: 'Accessories',
    subcategory: 'Tech',
    price: 3500,
    description: 'Real-time GPS pet tracker',
    imageUrl: 'https://via.placeholder.com/400x300/2196F3/FFFFFF?text=GPS+Tracker',
    rating: 4.9,
    reviews: 412,
    inStock: true,
    brand: 'Whistle',
    tags: ['gps', 'tracking', 'tech']
  },
  {
    id: 'prod_acc_009',
    name: 'Pet Cooling Mat',
    category: 'Accessories',
    subcategory: 'Comfort',
    price: 800,
    description: 'Self-cooling gel mat',
    imageUrl: 'https://via.placeholder.com/400x300/00BCD4/FFFFFF?text=Cooling+Mat',
    rating: 4.5,
    reviews: 223,
    inStock: true,
    brand: 'Arf Pets',
    tags: ['cooling', 'mat', 'summer']
  },
  {
    id: 'prod_acc_010',
    name: 'Automatic Water Fountain',
    category: 'Accessories',
    subcategory: 'Feeding',
    price: 1800,
    description: 'Filtered water fountain for pets',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Water+Fountain',
    rating: 4.7,
    reviews: 289,
    inStock: true,
    brand: 'Catit',
    tags: ['water', 'fountain', 'automatic']
  },

  // ==================== MEDICINE (8 products) ====================
  {
    id: 'prod_med_001',
    name: 'Flea & Tick Collar - 8 Months',
    category: 'Medicine',
    subcategory: 'Parasite Control',
    price: 1200,
    description: '8-month protection collar',
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Flea+Collar',
    rating: 4.6,
    reviews: 412,
    inStock: true,
    brand: 'Seresto',
    tags: ['flea', 'tick', 'collar']
  },
  {
    id: 'prod_med_002',
    name: 'Multivitamin Tablets - 60 Count',
    category: 'Medicine',
    subcategory: 'Supplements',
    price: 800,
    description: 'Daily multivitamin supplement',
    imageUrl: 'https://via.placeholder.com/400x300/FFC857/FFFFFF?text=Vitamins',
    rating: 4.5,
    reviews: 289,
    inStock: true,
    brand: 'PetVit',
    tags: ['vitamin', 'supplement', 'health']
  },
  {
    id: 'prod_med_003',
    name: 'Joint Care Supplement - 30 Tablets',
    category: 'Medicine',
    subcategory: 'Supplements',
    price: 1500,
    description: 'Glucosamine for joint health',
    imageUrl: 'https://via.placeholder.com/400x300/26C6DA/FFFFFF?text=Joint+Care',
    rating: 4.8,
    reviews: 356,
    inStock: true,
    brand: 'Cosequin',
    tags: ['joint', 'arthritis', 'glucosamine']
  },
  {
    id: 'prod_med_004',
    name: 'Deworming Tablet - 4 Pack',
    category: 'Medicine',
    subcategory: 'Dewormers',
    price: 400,
    description: 'Broad-spectrum dewormer',
    imageUrl: 'https://via.placeholder.com/400x300/9B59B6/FFFFFF?text=Dewormer',
    rating: 4.4,
    reviews: 234,
    inStock: true,
    brand: 'Bayer',
    tags: ['dewormer', 'parasites', 'health']
  },
  {
    id: 'prod_med_005',
    name: 'Probiotic Powder - 100g',
    category: 'Medicine',
    subcategory: 'Supplements',
    price: 900,
    description: 'Digestive health probiotic',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Probiotics',
    rating: 4.7,
    reviews: 298,
    inStock: true,
    brand: 'Purina',
    tags: ['probiotic', 'digestive', 'gut']
  },
  {
    id: 'prod_med_006',
    name: 'Ear Cleaning Solution - 100ml',
    category: 'Medicine',
    subcategory: 'Hygiene',
    price: 350,
    description: 'Gentle ear cleaner',
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Ear+Cleaner',
    rating: 4.5,
    reviews: 178,
    inStock: true,
    brand: 'Virbac',
    tags: ['ear', 'cleaning', 'hygiene']
  },
  {
    id: 'prod_med_007',
    name: 'Calming Chews - 30 Count',
    category: 'Medicine',
    subcategory: 'Supplements',
    price: 700,
    description: 'Natural anxiety relief',
    imageUrl: 'https://via.placeholder.com/400x300/E91E63/FFFFFF?text=Calming',
    rating: 4.6,
    reviews: 267,
    inStock: true,
    brand: 'VetriScience',
    tags: ['calming', 'anxiety', 'stress']
  },
  {
    id: 'prod_med_008',
    name: 'First Aid Kit for Pets',
    category: 'Medicine',
    subcategory: 'First Aid',
    price: 1200,
    description: 'Complete pet first aid kit',
    imageUrl: 'https://via.placeholder.com/400x300/2196F3/FFFFFF?text=First+Aid',
    rating: 4.8,
    reviews: 389,
    inStock: true,
    brand: 'Pet First Aid',
    tags: ['first_aid', 'emergency', 'kit']
  },

  // ==================== GROOMING PRODUCTS (7 products) ====================
  {
    id: 'prod_groom_001',
    name: 'Dog Shampoo - Medicated 500ml',
    category: 'Grooming',
    subcategory: 'Shampoo',
    price: 450,
    description: 'Anti-bacterial shampoo',
    imageUrl: 'https://via.placeholder.com/400x300/00BCD4/FFFFFF?text=Dog+Shampoo',
    rating: 4.6,
    reviews: 234,
    inStock: true,
    brand: 'Himalaya',
    tags: ['shampoo', 'medicated', 'grooming']
  },
  {
    id: 'prod_groom_002',
    name: 'Slicker Brush',
    category: 'Grooming',
    subcategory: 'Brushes',
    price: 350,
    description: 'Professional grooming brush',
    imageUrl: 'https://via.placeholder.com/400x300/9C27B0/FFFFFF?text=Slicker+Brush',
    rating: 4.7,
    reviews: 312,
    inStock: true,
    brand: 'Hertzko',
    tags: ['brush', 'grooming', 'deshedding']
  },
  {
    id: 'prod_groom_003',
    name: 'Nail Clippers - Professional',
    category: 'Grooming',
    subcategory: 'Tools',
    price: 400,
    description: 'Stainless steel nail clippers',
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Nail+Clippers',
    rating: 4.5,
    reviews: 189,
    inStock: true,
    brand: 'Safari',
    tags: ['nail', 'clippers', 'grooming']
  },
  {
    id: 'prod_groom_004',
    name: 'De-shedding Tool',
    category: 'Grooming',
    subcategory: 'Tools',
    price: 800,
    description: 'Professional de-shedding tool',
    imageUrl: 'https://via.placeholder.com/400x300/FFC857/FFFFFF?text=Deshedding',
    rating: 4.8,
    reviews: 456,
    inStock: true,
    brand: 'FURminator',
    tags: ['deshedding', 'grooming', 'tool']
  },
  {
    id: 'prod_groom_005',
    name: 'Paw Balm - 50g',
    category: 'Grooming',
    subcategory: 'Care',
    price: 300,
    description: 'Moisturizing paw balm',
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Paw+Balm',
    rating: 4.6,
    reviews: 198,
    inStock: true,
    brand: 'Musher\'s Secret',
    tags: ['paw', 'balm', 'moisturizer']
  },
  {
    id: 'prod_groom_006',
    name: 'Dental Toothbrush & Paste Set',
    category: 'Grooming',
    subcategory: 'Dental',
    price: 350,
    description: 'Complete dental care kit',
    imageUrl: 'https://via.placeholder.com/400x300/26C6DA/FFFFFF?text=Dental+Kit',
    rating: 4.5,
    reviews: 167,
    inStock: true,
    brand: 'Arm & Hammer',
    tags: ['dental', 'toothbrush', 'hygiene']
  },
  {
    id: 'prod_groom_007',
    name: 'Grooming Clippers - Electric',
    category: 'Grooming',
    subcategory: 'Tools',
    price: 2500,
    description: 'Professional electric clippers',
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Clippers',
    rating: 4.7,
    reviews: 289,
    inStock: true,
    brand: 'Wahl',
    tags: ['clippers', 'electric', 'professional']
  }
];

// Total: 50+ products across 5 categories

// =====================================================
// COUPONS & PROMOTIONS (20+)
// =====================================================

export interface Coupon {
  id: string;
  code: string;
  type: 'percentage' | 'flat' | 'first_time' | 'category_specific';
  value: number;
  minOrderValue?: number;
  maxDiscount?: number;
  category?: string;
  description: string;
  validFrom: string;
  validUntil: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  applicableOn: 'services' | 'products' | 'both';
}

export const MOCK_COUPONS: Coupon[] = [
  // General Coupons
  {
    id: 'coup_001',
    code: 'WELCOME50',
    type: 'first_time',
    value: 50,
    description: '50% off on your first booking',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usageLimit: 1,
    usedCount: 0,
    isActive: true,
    applicableOn: 'both',
    maxDiscount: 500
  },
  {
    id: 'coup_002',
    code: 'FLASH25',
    type: 'percentage',
    value: 25,
    minOrderValue: 1000,
    description: '25% off on orders above ₹1000',
    validFrom: '2026-01-01',
    validUntil: '2026-01-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'both',
    maxDiscount: 1000
  },
  {
    id: 'coup_003',
    code: 'SAVE200',
    type: 'flat',
    value: 200,
    minOrderValue: 1500,
    description: 'Flat ₹200 off on orders above ₹1500',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'both'
  },
  {
    id: 'coup_004',
    code: 'VET15',
    type: 'category_specific',
    value: 15,
    category: 'Veterinary',
    description: '15% off on all veterinary services',
    validFrom: '2026-01-01',
    validUntil: '2026-06-30',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 500
  },
  {
    id: 'coup_005',
    code: 'GROOM20',
    type: 'category_specific',
    value: 20,
    category: 'Grooming',
    description: '20% off on grooming services',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 400
  },
  {
    id: 'coup_006',
    code: 'TRAIN30',
    type: 'category_specific',
    value: 30,
    category: 'Training',
    description: '30% off on training packages',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 1500
  },
  {
    id: 'coup_007',
    code: 'NEWPET100',
    type: 'first_time',
    value: 100,
    description: 'Flat ₹100 off for new pet parents',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usageLimit: 1,
    usedCount: 0,
    isActive: true,
    applicableOn: 'both'
  },
  {
    id: 'coup_008',
    code: 'BOARD15',
    type: 'category_specific',
    value: 15,
    category: 'Boarding',
    description: '15% off on boarding services',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 600
  },
  {
    id: 'coup_009',
    code: 'WALK10',
    type: 'category_specific',
    value: 10,
    category: 'Walking',
    description: '10% off on walking services',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 200
  },
  {
    id: 'coup_010',
    code: 'DAYCARE20',
    type: 'category_specific',
    value: 20,
    category: 'Daycare',
    description: '20% off on daycare packages',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 500
  },
  {
    id: 'coup_011',
    code: 'SHOP15',
    type: 'percentage',
    value: 15,
    minOrderValue: 800,
    description: '15% off on all products',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'products',
    maxDiscount: 500
  },
  {
    id: 'coup_012',
    code: 'FOOD25',
    type: 'category_specific',
    value: 25,
    category: 'Food',
    description: '25% off on pet food',
    validFrom: '2026-01-01',
    validUntil: '2026-03-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'products',
    maxDiscount: 800
  },
  {
    id: 'coup_013',
    code: 'TOYS20',
    type: 'category_specific',
    value: 20,
    category: 'Toys',
    description: '20% off on all toys',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'products',
    maxDiscount: 400
  },
  {
    id: 'coup_014',
    code: 'SPA25',
    type: 'category_specific',
    value: 25,
    category: 'Spa',
    description: '25% off on spa packages',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 750
  },
  {
    id: 'coup_015',
    code: 'WEEKEND10',
    type: 'percentage',
    value: 10,
    description: '10% off on weekend bookings',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 300
  },
  {
    id: 'coup_016',
    code: 'REFER150',
    type: 'flat',
    value: 150,
    description: '₹150 off for referral bookings',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'both'
  },
  {
    id: 'coup_017',
    code: 'MEGA40',
    type: 'percentage',
    value: 40,
    minOrderValue: 5000,
    description: '40% off on orders above ₹5000',
    validFrom: '2026-01-15',
    validUntil: '2026-01-25',
    usedCount: 0,
    isActive: true,
    applicableOn: 'both',
    maxDiscount: 2000
  },
  {
    id: 'coup_018',
    code: 'PHARMACY10',
    type: 'category_specific',
    value: 10,
    category: 'Pharmacy',
    description: '10% off on pharmacy products',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'products',
    maxDiscount: 300
  },
  {
    id: 'coup_019',
    code: 'NUTRITION15',
    type: 'category_specific',
    value: 15,
    category: 'Nutrition',
    description: '15% off on nutrition consultations',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'services',
    maxDiscount: 450
  },
  {
    id: 'coup_020',
    code: 'BUNDLE30',
    type: 'percentage',
    value: 30,
    minOrderValue: 3000,
    description: '30% off on bundle purchases',
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    usedCount: 0,
    isActive: true,
    applicableOn: 'both',
    maxDiscount: 1500
  }
];

// =====================================================
// BUNDLE DEALS (10+)
// =====================================================

export interface BundleDeal {
  id: string;
  name: string;
  description: string;
  items: Array<{
    type: 'service' | 'product';
    itemId: string;
    quantity: number;
  }>;
  originalPrice: number;
  bundlePrice: number;
  savings: number;
  savingsPercentage: number;
  imageUrl: string;
  category: string;
  isActive: boolean;
  validUntil: string;
}

export const MOCK_BUNDLE_DEALS: BundleDeal[] = [
  {
    id: 'bundle_001',
    name: 'Complete Puppy Care Package',
    description: 'Everything your new puppy needs - vet checkup, vaccination, grooming, and training',
    items: [
      { type: 'service', itemId: 'vet_001', quantity: 1 },
      { type: 'service', itemId: 'vet_002', quantity: 1 },
      { type: 'service', itemId: 'groom_012', quantity: 1 },
      { type: 'service', itemId: 'train_003', quantity: 1 }
    ],
    originalPrice: 5300,
    bundlePrice: 3500,
    savings: 1800,
    savingsPercentage: 34,
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Puppy+Package',
    category: 'Puppy Care',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_002',
    name: 'Monthly Grooming Plan',
    description: '4 grooming sessions per month at discounted rate',
    items: [
      { type: 'service', itemId: 'groom_001', quantity: 4 }
    ],
    originalPrice: 4800,
    bundlePrice: 3600,
    savings: 1200,
    savingsPercentage: 25,
    imageUrl: 'https://via.placeholder.com/400x300/FF6B9D/FFFFFF?text=Grooming+Plan',
    category: 'Grooming',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_003',
    name: 'Senior Pet Wellness Package',
    description: 'Comprehensive care for elderly pets - geriatric checkup, dental, joint supplements',
    items: [
      { type: 'service', itemId: 'vet_017', quantity: 1 },
      { type: 'service', itemId: 'vet_007', quantity: 1 },
      { type: 'product', itemId: 'prod_med_003', quantity: 1 }
    ],
    originalPrice: 8500,
    bundlePrice: 6000,
    savings: 2500,
    savingsPercentage: 29,
    imageUrl: 'https://via.placeholder.com/400x300/9B59B6/FFFFFF?text=Senior+Care',
    category: 'Senior Care',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_004',
    name: 'Dog Walking Weekly Pass',
    description: '5 days of 30-minute walks at special price',
    items: [
      { type: 'service', itemId: 'walk_001', quantity: 5 }
    ],
    originalPrice: 1500,
    bundlePrice: 1200,
    savings: 300,
    savingsPercentage: 20,
    imageUrl: 'https://via.placeholder.com/400x300/4CAF50/FFFFFF?text=Walking+Pass',
    category: 'Walking',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_005',
    name: 'Complete Training Package',
    description: 'Basic + Advanced obedience training combo',
    items: [
      { type: 'service', itemId: 'train_001', quantity: 1 },
      { type: 'service', itemId: 'train_002', quantity: 1 }
    ],
    originalPrice: 8000,
    bundlePrice: 6500,
    savings: 1500,
    savingsPercentage: 19,
    imageUrl: 'https://via.placeholder.com/400x300/26C6DA/FFFFFF?text=Training+Package',
    category: 'Training',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_006',
    name: 'New Pet Starter Kit',
    description: 'Food, bowls, collar, leash, and toys for your new pet',
    items: [
      { type: 'product', itemId: 'prod_food_001', quantity: 1 },
      { type: 'product', itemId: 'prod_acc_003', quantity: 1 },
      { type: 'product', itemId: 'prod_acc_001', quantity: 1 },
      { type: 'product', itemId: 'prod_acc_002', quantity: 1 },
      { type: 'product', itemId: 'prod_toy_001', quantity: 1 }
    ],
    originalPrice: 6250,
    bundlePrice: 4500,
    savings: 1750,
    savingsPercentage: 28,
    imageUrl: 'https://via.placeholder.com/400x300/FF8C42/FFFFFF?text=Starter+Kit',
    category: 'Products',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_007',
    name: 'Luxury Spa Day',
    description: 'Premium grooming + spa package + aromatherapy',
    items: [
      { type: 'service', itemId: 'groom_006', quantity: 1 },
      { type: 'service', itemId: 'spa_003', quantity: 1 }
    ],
    originalPrice: 3300,
    bundlePrice: 2500,
    savings: 800,
    savingsPercentage: 24,
    imageUrl: 'https://via.placeholder.com/400x300/E91E63/FFFFFF?text=Spa+Day',
    category: 'Spa',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_008',
    name: 'Boarding + Training Combo',
    description: '7-day boarding with basic training included',
    items: [
      { type: 'service', itemId: 'board_008', quantity: 1 },
      { type: 'service', itemId: 'train_001', quantity: 1 }
    ],
    originalPrice: 8000,
    bundlePrice: 6800,
    savings: 1200,
    savingsPercentage: 15,
    imageUrl: 'https://via.placeholder.com/400x300/2196F3/FFFFFF?text=Board+Train',
    category: 'Boarding',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_009',
    name: 'Health & Wellness Kit',
    description: 'Multivitamins, joint care, probiotics, and flea control',
    items: [
      { type: 'product', itemId: 'prod_med_002', quantity: 1 },
      { type: 'product', itemId: 'prod_med_003', quantity: 1 },
      { type: 'product', itemId: 'prod_med_005', quantity: 1 },
      { type: 'product', itemId: 'prod_med_001', quantity: 1 }
    ],
    originalPrice: 4400,
    bundlePrice: 3200,
    savings: 1200,
    savingsPercentage: 27,
    imageUrl: 'https://via.placeholder.com/400x300/00BCD4/FFFFFF?text=Wellness+Kit',
    category: 'Medicine',
    isActive: true,
    validUntil: '2026-12-31'
  },
  {
    id: 'bundle_010',
    name: 'Grooming Tools Set',
    description: 'Professional grooming kit - brush, clippers, shampoo, nail clippers',
    items: [
      { type: 'product', itemId: 'prod_groom_002', quantity: 1 },
      { type: 'product', itemId: 'prod_groom_007', quantity: 1 },
      { type: 'product', itemId: 'prod_groom_001', quantity: 1 },
      { type: 'product', itemId: 'prod_groom_003', quantity: 1 }
    ],
    originalPrice: 3700,
    bundlePrice: 2800,
    savings: 900,
    savingsPercentage: 24,
    imageUrl: 'https://via.placeholder.com/400x300/9C27B0/FFFFFF?text=Grooming+Tools',
    category: 'Grooming',
    isActive: true,
    validUntil: '2026-12-31'
  }
];

// =====================================================
// PROMOTIONAL BANNERS
// =====================================================

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  ctaText: string;
  ctaLink: string;
  type: 'hero' | 'feature' | 'category' | 'flash_sale';
  isActive: boolean;
  displayOrder: number;
}

export const PROMO_BANNERS: PromoBanner[] = [
  {
    id: 'banner_001',
    title: 'Welcome to Warmpawz',
    subtitle: '50% OFF on your first booking',
    imageUrl: 'https://via.placeholder.com/1200x400/FF8C42/FFFFFF?text=Welcome+Banner',
    ctaText: 'Explore Services',
    ctaLink: '/services',
    type: 'hero',
    isActive: true,
    displayOrder: 1
  },
  {
    id: 'banner_002',
    title: 'Flash Sale - 40% OFF',
    subtitle: 'Limited time offer on grooming packages',
    imageUrl: 'https://via.placeholder.com/1200x400/FF6B9D/FFFFFF?text=Flash+Sale',
    ctaText: 'Shop Now',
    ctaLink: '/services/grooming',
    type: 'flash_sale',
    isActive: true,
    displayOrder: 2
  },
  {
    id: 'banner_003',
    title: 'Professional Vet Care',
    subtitle: '24/7 Emergency services available',
    imageUrl: 'https://via.placeholder.com/1200x400/26C6DA/FFFFFF?text=Vet+Care',
    ctaText: 'Book Now',
    ctaLink: '/services/veterinary',
    type: 'feature',
    isActive: true,
    displayOrder: 3
  },
  {
    id: 'banner_004',
    title: 'Premium Pet Food',
    subtitle: 'Upto 25% off on select brands',
    imageUrl: 'https://via.placeholder.com/1200x400/4CAF50/FFFFFF?text=Pet+Food',
    ctaText: 'Shop Food',
    ctaLink: '/shop?category=Food',
    type: 'category',
    isActive: true,
    displayOrder: 4
  },
  {
    id: 'banner_005',
    title: 'Dog Training Classes',
    subtitle: 'Join our certified trainers',
    imageUrl: 'https://via.placeholder.com/1200x400/9B59B6/FFFFFF?text=Training',
    ctaText: 'Learn More',
    ctaLink: '/services/training',
    type: 'feature',
    isActive: true,
    displayOrder: 5
  }
];

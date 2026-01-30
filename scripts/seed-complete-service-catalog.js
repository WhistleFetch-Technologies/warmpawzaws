#!/usr/bin/env node
/**
 * Complete Service Catalog Seed Script
 * 
 * Seeds ALL 20 services from customer-web with their:
 * - Service categories
 * - Specializations (problem grids)
 * - Symptoms
 * - Icons (matching customer-web Lucide icons)
 * 
 * Preserves existing data and only adds/updates as needed.
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// ============================================================================
// COMPLETE SERVICE CATALOG (from customer-web)
// ============================================================================

const SERVICE_CATALOG = [
  // ========== SERVICES WITH PROBLEM GRIDS ==========
  {
    category_id: 'veterinary',
    name: 'Vet Care',
    description: 'Consultations, checkups & treatments',
    icon: 'Stethoscope',
    icon_color: 'text-blue-600',
    display_order: 1,
    has_problem_grid: true,
    vendor_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    specializations: [
      { id: 'medicine', name: 'General Health', display_name: 'General', icon: 'Package', color: 'text-purple-500', symptoms: ['Vomiting', 'Fever', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Weight loss', 'Coughing', 'Sneezing'] },
      { id: 'vaccination', name: 'Vaccination', display_name: 'Vaccination', icon: 'Pill', color: 'text-blue-500', symptoms: ['Due for shots', 'Puppy vaccination', 'Kitten vaccination', 'Annual booster', 'Travel vaccination'] },
      { id: 'dermatology', name: 'Skin Care', display_name: 'Skin Care', icon: 'Activity', color: 'text-green-500', symptoms: ['Itching', 'Hair loss', 'Rashes', 'Hot spots', 'Skin infections', 'Allergies', 'Dandruff', 'Dry skin'] },
      { id: 'dentistry', name: 'Dental Care', display_name: 'Dental', icon: 'FileText', color: 'text-blue-500', symptoms: ['Bad breath', 'Tartar buildup', 'Tooth pain', 'Swollen gums', 'Broken tooth', 'Difficulty eating'] },
      { id: 'ophthalmology', name: 'Eye Care', display_name: 'Eye Care', icon: 'Eye', color: 'text-cyan-500', symptoms: ['Eye discharge', 'Redness', 'Cloudiness', 'Squinting', 'Swelling', 'Tearing', 'Vision problems'] },
      { id: 'cardiology', name: 'Heart Care', display_name: 'Heart Care', icon: 'Heart', color: 'text-red-500', symptoms: ['Breathing difficulty', 'Coughing', 'Fainting', 'Exercise intolerance', 'Rapid breathing', 'Blue gums'] },
      { id: 'surgery', name: 'Surgery', display_name: 'Surgery', icon: 'Stethoscope', color: 'text-teal-500', symptoms: ['Tumor/Lump', 'Injury', 'Spay/Neuter', 'Foreign body', 'Fracture', 'Hernia', 'Mass removal'] },
      { id: 'emergency', name: 'Emergency', display_name: 'Emergency', icon: 'Siren', color: 'text-red-500', symptoms: ['Unconscious', 'Severe bleeding', 'Poisoning', 'Seizures', 'Trauma', 'Difficulty breathing', 'Collapse'] },
      { id: 'orthopedic', name: 'Orthopedic', display_name: 'Bone & Joint', icon: 'Bone', color: 'text-amber-500', symptoms: ['Limping', 'Joint pain', 'Difficulty walking', 'Swelling', 'Stiffness', 'Hip problems', 'Arthritis'] },
      { id: 'neurology', name: 'Neurology', display_name: 'Neurology', icon: 'Brain', color: 'text-indigo-500', symptoms: ['Seizures', 'Head tilt', 'Loss of balance', 'Paralysis', 'Tremors', 'Disorientation', 'Circling'] },
    ]
  },
  {
    category_id: 'grooming',
    name: 'Grooming',
    description: 'Salon, spa & at-home grooming',
    icon: 'Scissors',
    icon_color: 'text-orange-500',
    display_order: 2,
    has_problem_grid: true,
    vendor_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    specializations: [
      { id: 'bath_only', name: 'Bath & Brush', display_name: 'Bath & Brush', icon: 'Bath', color: 'text-blue-500', symptoms: ['Dirty coat', 'Bad smell', 'Needs cleaning', 'Muddy', 'Dusty coat'] },
      { id: 'full_grooming', name: 'Full Grooming', display_name: 'Full Grooming', icon: 'Scissors', color: 'text-orange-500', symptoms: ['Overgrown coat', 'Matted fur', 'Long nails', 'Needs complete makeover'] },
      { id: 'nail_care', name: 'Nail Care', display_name: 'Nail Trimming', icon: 'Hand', color: 'text-purple-500', symptoms: ['Long nails', 'Clicking sound', 'Difficulty walking', 'Overgrown nails'] },
      { id: 'haircut_styling', name: 'Hair Styling', display_name: 'Haircut & Styling', icon: 'Brush', color: 'text-pink-500', symptoms: ['Overgrown hair', 'Needs trim', 'Breed cut', 'Show grooming'] },
      { id: 'deshedding', name: 'De-shedding', display_name: 'De-shedding', icon: 'Dog', color: 'text-amber-500', symptoms: ['Excessive shedding', 'Fur everywhere', 'Seasonal shedding', 'Double coat'] },
      { id: 'spa_treatment', name: 'Spa & Wellness', display_name: 'Spa & Wellness', icon: 'Sparkles', color: 'text-rose-500', symptoms: ['Pampering needed', 'Skin treatment', 'Aromatherapy', 'Deep conditioning'] },
    ]
  },
  {
    category_id: 'training',
    name: 'Training',
    description: 'Obedience, behavior & skills',
    icon: 'GraduationCap',
    icon_color: 'text-purple-600',
    display_order: 4,
    has_problem_grid: true,
    vendor_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    specializations: [
      { id: 'basic_obedience', name: 'Basic Obedience', display_name: 'Basic Obedience', icon: 'GraduationCap', color: 'text-purple-500', symptoms: ['Does not listen', 'No training', 'New puppy', 'Basic commands needed'] },
      { id: 'potty_training', name: 'Potty Training', display_name: 'House Training', icon: 'Home', color: 'text-green-500', symptoms: ['Accidents in house', 'Not potty trained', 'New puppy', 'Indoor marking'] },
      { id: 'leash_training', name: 'Leash Training', display_name: 'Leash Walking', icon: 'Dog', color: 'text-indigo-500', symptoms: ['Pulls on leash', 'Cannot walk properly', 'Reactive on leash', 'Lunges'] },
      { id: 'socialization', name: 'Socialization', display_name: 'Socialization', icon: 'PawPrint', color: 'text-blue-500', symptoms: ['Scared of people', 'Aggressive with dogs', 'Shy', 'Fearful', 'No exposure'] },
      { id: 'advanced_training', name: 'Advanced Skills', display_name: 'Advanced Training', icon: 'Trophy', color: 'text-amber-500', symptoms: ['Wants tricks', 'Competition training', 'Service dog', 'Advanced obedience'] },
      { id: 'aggression', name: 'Aggression', display_name: 'Aggression Fix', icon: 'AlertTriangle', color: 'text-red-500', symptoms: ['Biting', 'Growling', 'Snapping', 'Aggressive to people', 'Aggressive to dogs'] },
    ]
  },
  {
    category_id: 'walking',
    name: 'Dog Walker',
    description: 'Daily walks & exercise',
    icon: 'Bike',
    icon_color: 'text-green-600',
    display_order: 5,
    has_problem_grid: true,
    vendor_roles: ['walker', 'pet_walker'],
    specializations: [
      { id: 'daily_walk', name: 'Daily Walk', display_name: 'Daily Walking', icon: 'Footprints', color: 'text-green-500', symptoms: ['Needs exercise', 'Regular walks', 'Daily routine', 'Energy release'] },
      { id: 'puppy_walk', name: 'Puppy Walking', display_name: 'Puppy Walks', icon: 'Dog', color: 'text-blue-500', symptoms: ['Young puppy', 'Short walks needed', 'Learning to walk', 'Gentle pace'] },
      { id: 'multiple_dogs', name: 'Multiple Dogs', display_name: 'Group Walks', icon: 'Dog', color: 'text-indigo-500', symptoms: ['Multiple pets', 'Pack walks', 'Two or more dogs', 'Group walking'] },
      { id: 'senior_walk', name: 'Senior Care', display_name: 'Senior Dog Walks', icon: 'Bone', color: 'text-amber-500', symptoms: ['Old dog', 'Slow pace needed', 'Arthritis', 'Limited mobility', 'Senior pet'] },
      { id: 'long_walk', name: 'Adventure Walk', display_name: 'Adventure Walks', icon: 'Mountain', color: 'text-emerald-500', symptoms: ['High energy', 'Needs long walks', 'Hiking', 'Adventure', 'Trail walking'] },
    ]
  },
  {
    category_id: 'boarding',
    name: 'Boarding',
    description: 'Safe stay while you\'re away',
    icon: 'Home',
    icon_color: 'text-indigo-600',
    display_order: 6,
    has_problem_grid: true,
    vendor_roles: ['boarding', 'pet_boarder', 'pet_boarding'],
    specializations: [
      { id: 'daycare', name: 'Daily Daycare', display_name: 'Pet Daycare', icon: 'Sun', color: 'text-yellow-500', symptoms: ['Work hours care', 'Daily supervision', 'Playtime needed', 'Socialization'] },
      { id: 'short_stay', name: 'Weekend Stay', display_name: 'Short Boarding', icon: 'Hotel', color: 'text-orange-500', symptoms: ['Weekend trip', 'Short vacation', '1-3 nights', 'Quick getaway'] },
      { id: 'long_stay', name: 'Extended Stay', display_name: 'Long Boarding', icon: 'Home', color: 'text-amber-500', symptoms: ['Long vacation', 'Extended travel', 'Week or more', 'Business trip'] },
      { id: 'luxury_boarding', name: 'Luxury Stay', display_name: 'Premium Boarding', icon: 'Star', color: 'text-purple-500', symptoms: ['Wants best', 'Premium care', 'Extra attention', 'Luxury amenities'] },
      { id: 'medical_boarding', name: 'Medical Care', display_name: 'Medical Boarding', icon: 'Pill', color: 'text-blue-500', symptoms: ['Needs medication', 'Post-surgery care', 'Special medical needs', 'Recovery boarding'] },
    ]
  },
  {
    category_id: 'behavioral',
    name: 'Behavioral',
    description: 'Behavior modification & therapy',
    icon: 'Heart',
    icon_color: 'text-indigo-600',
    display_order: 7,
    has_problem_grid: true,
    vendor_roles: ['trainer_solo', 'trainer_center', 'pet_behaviorist'],
    specializations: [
      { id: 'separation_anxiety', name: 'Anxiety & Stress', display_name: 'Separation Anxiety', icon: 'Frown', color: 'text-yellow-500', symptoms: ['Anxious when alone', 'Destructive alone', 'Crying/whining', 'Pacing', 'Excessive drooling'] },
      { id: 'barking', name: 'Barking Issues', display_name: 'Excessive Barking', icon: 'Volume2', color: 'text-orange-500', symptoms: ['Barks constantly', 'Barks at everything', 'Night barking', 'Alert barking', 'Demand barking'] },
      { id: 'fear_phobia', name: 'Fear Issues', display_name: 'Fear & Phobias', icon: 'Ghost', color: 'text-indigo-500', symptoms: ['Scared of noises', 'Thunder phobia', 'Firework fear', 'Scared of strangers', 'Hiding'] },
      { id: 'destructive', name: 'Destructive Habits', display_name: 'Destructive Behavior', icon: 'Bomb', color: 'text-red-500', symptoms: ['Chewing furniture', 'Destroying items', 'Digging', 'Scratching doors', 'Tearing things'] },
      { id: 'resource_guarding', name: 'Resource Guarding', display_name: 'Possessive Behavior', icon: 'Shield', color: 'text-blue-500', symptoms: ['Guards food', 'Guards toys', 'Growls when approached', 'Protective of items', 'Snaps near food'] },
    ]
  },
  {
    category_id: 'wellness',
    name: 'Nutritionist',
    description: 'Diet plans & nutrition advice',
    icon: 'Wheat',
    icon_color: 'text-lime-600',
    display_order: 8,
    has_problem_grid: true,
    vendor_roles: ['nutritionist', 'nutritionist_center'],
    specializations: [
      { id: 'diet_plan', name: 'Diet Planning', display_name: 'Custom Diet Plans', icon: 'FileText', color: 'text-green-500', symptoms: ['Needs diet plan', 'Nutrition advice', 'Meal planning', 'Feeding schedule'] },
      { id: 'puppy_nutrition', name: 'Puppy Diet', display_name: 'Puppy Nutrition', icon: 'Dog', color: 'text-blue-500', symptoms: ['New puppy', 'Growth diet', 'Puppy food', 'Development nutrition'] },
      { id: 'senior_nutrition', name: 'Senior Diet', display_name: 'Senior Pet Nutrition', icon: 'Heart', color: 'text-purple-500', symptoms: ['Aging pet', 'Senior food', 'Joint support', 'Cognitive support'] },
      { id: 'weight_management', name: 'Weight Loss', display_name: 'Weight Management', icon: 'Activity', color: 'text-orange-500', symptoms: ['Overweight', 'Needs to lose weight', 'Obesity', 'Weight control'] },
      { id: 'allergies_sensitivities', name: 'Food Allergies', display_name: 'Allergy Diet', icon: 'AlertTriangle', color: 'text-red-500', symptoms: ['Food allergies', 'Sensitive stomach', 'Itching from food', 'Digestive issues'] },
      { id: 'special_diet', name: 'Medical Diet', display_name: 'Prescription Diet', icon: 'Pill', color: 'text-teal-500', symptoms: ['Kidney diet', 'Liver diet', 'Diabetic diet', 'Heart diet', 'Special medical needs'] },
    ]
  },

  // ========== SERVICES WITHOUT PROBLEM GRIDS ==========
  {
    category_id: 'shop',
    name: 'Pet Shop',
    description: 'Food, accessories & medicines',
    icon: 'ShoppingBag',
    icon_color: 'text-pink-500',
    display_order: 3,
    has_problem_grid: false,
    vendor_roles: ['shop', 'pet_shop'],
    specializations: []
  },
  {
    category_id: 'adoption',
    name: 'Adoption',
    description: 'Find your new best friend',
    icon: 'Heart',
    icon_color: 'text-red-500',
    display_order: 9,
    has_problem_grid: false,
    vendor_roles: ['adoption_center', 'ngo', 'shelter'],
    specializations: []
  },
  {
    category_id: 'mating',
    name: 'Mating & Dating',
    description: 'Find the perfect match',
    icon: 'Heart',
    icon_color: 'text-pink-500',
    display_order: 10,
    has_problem_grid: false,
    vendor_roles: ['breeder', 'mating_service'],
    specializations: []
  },
  {
    category_id: 'cafes',
    name: 'Pet Cafes',
    description: 'Pet-friendly dining spots',
    icon: 'Coffee',
    icon_color: 'text-amber-600',
    display_order: 11,
    has_problem_grid: false,
    vendor_roles: ['cafe', 'pet_cafe'],
    specializations: []
  },
  {
    category_id: 'photography',
    name: 'Photography',
    description: 'Professional pet photography',
    icon: 'Camera',
    icon_color: 'text-violet-600',
    display_order: 12,
    has_problem_grid: false,
    vendor_roles: ['photographer', 'pet_photographer'],
    specializations: []
  },
  {
    category_id: 'insurance',
    name: 'Insurance',
    description: 'Health & accident coverage',
    icon: 'Shield',
    icon_color: 'text-cyan-600',
    display_order: 13,
    has_problem_grid: false,
    vendor_roles: ['insurance_provider'],
    specializations: []
  },
  {
    category_id: 'breeder',
    name: 'Breeder',
    description: 'Certified breeders & puppies',
    icon: 'PawPrint',
    icon_color: 'text-amber-600',
    display_order: 14,
    has_problem_grid: false,
    vendor_roles: ['breeder', 'certified_breeder'],
    specializations: []
  },
  {
    category_id: 'ambulance',
    name: 'Ambulance',
    description: 'Emergency pet transport',
    icon: 'Phone',
    icon_color: 'text-red-600',
    display_order: 15,
    has_problem_grid: false,
    vendor_roles: ['ambulance', 'emergency_transport'],
    specializations: []
  },
  {
    category_id: 'relocation',
    name: 'Relocation',
    description: 'Pet transport & moving services',
    icon: 'Truck',
    icon_color: 'text-sky-600',
    display_order: 16,
    has_problem_grid: false,
    vendor_roles: ['relocation', 'pet_transport'],
    specializations: []
  },
  {
    category_id: 'resort',
    name: 'Pet Resort',
    description: 'Luxury boarding & spa',
    icon: 'Sparkles',
    icon_color: 'text-teal-600',
    display_order: 17,
    has_problem_grid: false,
    vendor_roles: ['resort', 'pet_resort'],
    specializations: []
  },
  {
    category_id: 'holiday',
    name: 'Pet Holiday',
    description: 'Travel packages with your pet',
    icon: 'Palmtree',
    icon_color: 'text-cyan-600',
    display_order: 18,
    has_problem_grid: false,
    vendor_roles: ['holiday', 'pet_travel'],
    specializations: []
  },
  {
    category_id: 'sunset',
    name: 'Sunset Care',
    description: 'End-of-life support & memorial',
    icon: 'Sun',
    icon_color: 'text-purple-600',
    display_order: 19,
    has_problem_grid: false,
    vendor_roles: ['sunset_care', 'memorial'],
    specializations: []
  },
  {
    category_id: 'pharmacy',
    name: 'Pharmacy',
    description: 'Pet medicines & prescriptions',
    icon: 'Pill',
    icon_color: 'text-red-600',
    display_order: 20,
    has_problem_grid: false,
    vendor_roles: ['pharmacy', 'pet_pharmacy'],
    specializations: []
  },
  {
    category_id: 'lab-diagnostics',
    name: 'Lab Tests',
    description: 'Diagnostic tests & lab services',
    icon: 'FlaskConical',
    icon_color: 'text-teal-600',
    display_order: 21,
    has_problem_grid: false,
    vendor_roles: ['lab', 'diagnostics'],
    specializations: []
  },
];

async function seedCompleteServiceCatalog() {
  console.log('🚀 Seeding Complete Service Catalog');
  console.log('====================================');
  console.log(`Environment: ${ENVIRONMENT}`);
  console.log('');

  const { execSync } = require('child_process');
  const clusterId = `warmpawz-${ENVIRONMENT}-cluster`;

  console.log('📊 Connecting to database...');
  
  let endpoint, pool;
  try {
    endpoint = execSync(
      `aws rds describe-db-clusters --db-cluster-identifier ${clusterId} --region ${REGION} --query 'DBClusters[0].Endpoint' --output text`,
      { encoding: 'utf8' }
    ).trim();

    const secretsClient = new SecretsManagerClient({ region: REGION });
    const secretValue = await secretsClient.send(
      new GetSecretValueCommand({ SecretId: `warmpawz-${ENVIRONMENT}-rds-master-20260106164510791100000002` })
    );
    const secret = JSON.parse(secretValue.SecretString);

    pool = new Pool({
      host: endpoint,
      port: 5432,
      database: 'warmpawz',
      user: 'warmpawz_admin',
      password: secret.password,
      ssl: { rejectUnauthorized: false },
    });

    await pool.query('SELECT 1');
    console.log('✅ Connected');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  try {
    // Ensure tables exist
    console.log('');
    console.log('🔧 Ensuring tables exist...');
    
    // Check if service_categories has the columns we need
    await pool.query(`
      ALTER TABLE service_categories 
        ADD COLUMN IF NOT EXISTS icon TEXT,
        ADD COLUMN IF NOT EXISTS icon_color TEXT,
        ADD COLUMN IF NOT EXISTS has_problem_grid BOOLEAN DEFAULT false,
        ADD COLUMN IF NOT EXISTS vendor_roles TEXT[] DEFAULT '{}',
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
    `);
    
    // Add unique constraint on category_id if not exists
    try {
      await pool.query(`
        ALTER TABLE service_categories 
        ADD CONSTRAINT service_categories_category_id_key UNIQUE (category_id)
      `);
      console.log('   ✅ Added unique constraint on category_id');
    } catch (e) {
      if (e.message.includes('already exists')) {
        console.log('   ✅ Unique constraint already exists');
      }
    }
    console.log('   ✅ service_categories updated');

    // Ensure specialization_master exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS specialization_master (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        specialization_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT,
        description TEXT,
        short_description TEXT,
        category_id TEXT,
        applicable_roles TEXT[] NOT NULL DEFAULT '{}',
        icon_name TEXT,
        icon_color TEXT,
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        show_in_problem_grid BOOLEAN DEFAULT true,
        show_in_vendor_profile BOOLEAN DEFAULT true,
        show_in_services_dashboard BOOLEAN DEFAULT true,
        allowed_service_styles JSONB DEFAULT '["at_home", "at_center", "tele"]'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    console.log('   ✅ specialization_master ready');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS specialization_symptoms (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        specialization_id TEXT NOT NULL,
        symptom_name TEXT NOT NULL,
        symptom_display_name TEXT,
        symptom_keywords TEXT[] DEFAULT '{}',
        pet_types TEXT[] DEFAULT '{}',
        display_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(specialization_id, symptom_name)
      )
    `);
    console.log('   ✅ specialization_symptoms ready');

    // Seed service categories
    console.log('');
    console.log('🔧 Seeding service categories...');
    
    let categoriesCreated = 0;
    let categoriesUpdated = 0;

    for (const cat of SERVICE_CATALOG) {
      const result = await pool.query(`
        INSERT INTO service_categories (
          category_id, name, description, icon, icon_color, display_order,
          has_problem_grid, vendor_roles, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        ON CONFLICT (category_id) DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          icon = EXCLUDED.icon,
          icon_color = EXCLUDED.icon_color,
          display_order = EXCLUDED.display_order,
          has_problem_grid = EXCLUDED.has_problem_grid,
          vendor_roles = EXCLUDED.vendor_roles
        RETURNING (xmax = 0) as inserted
      `, [
        cat.category_id,
        cat.name,
        cat.description,
        cat.icon,
        cat.icon_color,
        cat.display_order,
        cat.has_problem_grid,
        cat.vendor_roles,
      ]);

      if (result.rows[0].inserted) {
        categoriesCreated++;
      } else {
        categoriesUpdated++;
      }
    }

    console.log(`   ✅ Categories: ${categoriesCreated} created, ${categoriesUpdated} updated`);

    // Seed specializations
    console.log('');
    console.log('🔧 Seeding specializations...');
    
    let specsCreated = 0;
    let specsUpdated = 0;
    let symptomsAdded = 0;
    let specOrder = 0;

    for (const cat of SERVICE_CATALOG) {
      for (const spec of cat.specializations) {
        specOrder++;
        
        const result = await pool.query(`
          INSERT INTO specialization_master (
            specialization_id, name, display_name, category_id,
            applicable_roles, icon_name, icon_color, display_order
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (specialization_id) DO UPDATE SET
            name = EXCLUDED.name,
            display_name = EXCLUDED.display_name,
            category_id = EXCLUDED.category_id,
            applicable_roles = EXCLUDED.applicable_roles,
            icon_name = EXCLUDED.icon_name,
            icon_color = EXCLUDED.icon_color,
            display_order = EXCLUDED.display_order,
            updated_at = NOW()
          RETURNING (xmax = 0) as inserted
        `, [
          spec.id,
          spec.name,
          spec.display_name,
          cat.category_id,
          cat.vendor_roles,
          spec.icon,
          spec.color,
          specOrder
        ]);

        if (result.rows[0].inserted) {
          specsCreated++;
        } else {
          specsUpdated++;
        }

        // Add symptoms
        if (spec.symptoms && spec.symptoms.length > 0) {
          for (let j = 0; j < spec.symptoms.length; j++) {
            try {
              await pool.query(`
                INSERT INTO specialization_symptoms (
                  specialization_id, symptom_name, symptom_display_name, display_order
                ) VALUES ($1, $2, $2, $3)
                ON CONFLICT (specialization_id, symptom_name) DO NOTHING
              `, [spec.id, spec.symptoms[j], j + 1]);
              symptomsAdded++;
            } catch (e) {
              // Ignore duplicates
            }
          }
        }
      }
    }

    console.log(`   ✅ Specializations: ${specsCreated} created, ${specsUpdated} updated`);
    console.log(`   ✅ Symptoms: ${symptomsAdded} added`);

    // Summary
    console.log('');
    console.log('📊 Final Summary:');
    
    const catCount = await pool.query('SELECT COUNT(*) FROM service_categories WHERE is_active = true');
    const specCount = await pool.query('SELECT COUNT(*) FROM specialization_master WHERE is_active = true');
    const symptomCount = await pool.query('SELECT COUNT(*) FROM specialization_symptoms WHERE is_active = true');
    
    const byCategory = await pool.query(`
      SELECT 
        sc.category_id,
        sc.name,
        sc.icon,
        sc.has_problem_grid,
        COUNT(sm.id) as spec_count
      FROM service_categories sc
      LEFT JOIN specialization_master sm ON sm.category_id = sc.category_id AND sm.is_active = true
      WHERE sc.is_active = true
      GROUP BY sc.category_id, sc.name, sc.icon, sc.has_problem_grid, sc.display_order
      ORDER BY sc.display_order
    `);

    console.log(`   Total service categories: ${catCount.rows[0].count}`);
    console.log(`   Total specializations: ${specCount.rows[0].count}`);
    console.log(`   Total symptoms: ${symptomCount.rows[0].count}`);
    console.log('');
    console.log('   Services breakdown:');
    byCategory.rows.forEach((row, i) => {
      const specInfo = row.spec_count > 0 ? `${row.spec_count} specializations` : 'No problem grid';
      console.log(`      ${i + 1}. ${row.name} (${row.icon}) - ${specInfo}`);
    });

    console.log('');
    console.log('✅ Complete Service Catalog Seeding Done!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedCompleteServiceCatalog().catch(console.error);

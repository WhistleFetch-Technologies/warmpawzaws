#!/usr/bin/env node
/**
 * Seed Specialization Master Data
 * 
 * Backfills specialization_master and specialization_symptoms tables
 * using existing icons from customer-web ProblemGridSection.tsx
 * 
 * IMPORTANT: Uses exact same IDs as problem_grid_mappings for backward compatibility
 */

const { Pool } = require('pg');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const ENVIRONMENT = process.env.ENVIRONMENT || 'dev';
const REGION = process.env.AWS_REGION || 'ap-south-1';

// ============================================================================
// SPECIALIZATION DATA (from customer-web ProblemGridSection.tsx icons)
// ============================================================================

const SPECIALIZATIONS = [
  // ========== VETERINARY ==========
  {
    specialization_id: 'medicine',
    name: 'General Health',
    display_name: 'General Health',
    description: 'General health consultations, checkups, and common ailments',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Package',
    icon_color: 'text-purple-500',
    symptoms: ['Vomiting', 'Fever', 'Diarrhea', 'Loss of appetite', 'Lethargy', 'Weight loss', 'Coughing', 'Sneezing']
  },
  {
    specialization_id: 'vaccination',
    name: 'Vaccination',
    display_name: 'Vaccination',
    description: 'Routine vaccinations and immunization schedules',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Pill',
    icon_color: 'text-blue-500',
    symptoms: ['Due for shots', 'Puppy vaccination', 'Kitten vaccination', 'Annual booster', 'Travel vaccination']
  },
  {
    specialization_id: 'dermatology',
    name: 'Skin Care',
    display_name: 'Skin & Coat Care',
    description: 'Skin conditions, allergies, and coat health',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Activity',
    icon_color: 'text-green-500',
    symptoms: ['Itching', 'Hair loss', 'Rashes', 'Hot spots', 'Skin infections', 'Allergies', 'Dandruff', 'Dry skin']
  },
  {
    specialization_id: 'dentistry',
    name: 'Dental Care',
    display_name: 'Dental Care',
    description: 'Dental health, teeth cleaning, and oral conditions',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'FileText',
    icon_color: 'text-blue-500',
    symptoms: ['Bad breath', 'Tartar buildup', 'Tooth pain', 'Swollen gums', 'Broken tooth', 'Difficulty eating']
  },
  {
    specialization_id: 'ophthalmology',
    name: 'Eye Care',
    display_name: 'Eye Care',
    description: 'Eye conditions, infections, and vision problems',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Eye',
    icon_color: 'text-cyan-500',
    symptoms: ['Eye discharge', 'Redness', 'Cloudiness', 'Squinting', 'Swelling', 'Tearing', 'Vision problems']
  },
  {
    specialization_id: 'cardiology',
    name: 'Heart Care',
    display_name: 'Cardiology',
    description: 'Heart conditions and cardiovascular health',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Heart',
    icon_color: 'text-red-500',
    symptoms: ['Breathing difficulty', 'Coughing', 'Fainting', 'Exercise intolerance', 'Rapid breathing', 'Blue gums']
  },
  {
    specialization_id: 'surgery',
    name: 'Surgery',
    display_name: 'Surgery & Procedures',
    description: 'Surgical procedures and post-operative care',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Stethoscope',
    icon_color: 'text-teal-500',
    symptoms: ['Tumor/Lump', 'Injury', 'Spay/Neuter', 'Foreign body', 'Fracture', 'Hernia', 'Mass removal']
  },
  {
    specialization_id: 'emergency',
    name: 'Emergency',
    display_name: 'Emergency Care',
    description: 'Urgent and emergency veterinary care',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Siren',
    icon_color: 'text-red-500',
    symptoms: ['Unconscious', 'Severe bleeding', 'Poisoning', 'Seizures', 'Trauma', 'Difficulty breathing', 'Collapse']
  },
  {
    specialization_id: 'orthopedic',
    name: 'Orthopedic',
    display_name: 'Bone & Joint Care',
    description: 'Bone, joint, and musculoskeletal conditions',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Bone',
    icon_color: 'text-amber-500',
    symptoms: ['Limping', 'Joint pain', 'Difficulty walking', 'Swelling', 'Stiffness', 'Hip problems', 'Arthritis']
  },
  {
    specialization_id: 'neurology',
    name: 'Neurology',
    display_name: 'Neurological Care',
    description: 'Brain, spine, and nervous system conditions',
    category_id: 'veterinary',
    applicable_roles: ['vet_solo', 'vet_clinic', 'veterinarian'],
    icon_name: 'Brain',
    icon_color: 'text-indigo-500',
    symptoms: ['Seizures', 'Head tilt', 'Loss of balance', 'Paralysis', 'Tremors', 'Disorientation', 'Circling']
  },

  // ========== GROOMING ==========
  {
    specialization_id: 'bath_only',
    name: 'Bath & Brush',
    display_name: 'Bath & Brush',
    description: 'Basic bathing and brushing services',
    category_id: 'grooming',
    applicable_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    icon_name: 'Bath',
    icon_color: 'text-blue-500',
    symptoms: ['Dirty coat', 'Bad smell', 'Needs cleaning', 'Muddy', 'Dusty coat']
  },
  {
    specialization_id: 'full_grooming',
    name: 'Full Grooming',
    display_name: 'Full Grooming',
    description: 'Complete grooming including bath, haircut, nails, and ears',
    category_id: 'grooming',
    applicable_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    icon_name: 'Scissors',
    icon_color: 'text-orange-500',
    symptoms: ['Overgrown coat', 'Matted fur', 'Long nails', 'Needs complete makeover']
  },
  {
    specialization_id: 'nail_care',
    name: 'Nail Care',
    display_name: 'Nail Trimming',
    description: 'Nail trimming and paw care',
    category_id: 'grooming',
    applicable_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    icon_name: 'Hand',
    icon_color: 'text-purple-500',
    symptoms: ['Long nails', 'Clicking sound', 'Difficulty walking', 'Overgrown nails']
  },
  {
    specialization_id: 'haircut_styling',
    name: 'Hair Styling',
    display_name: 'Haircut & Styling',
    description: 'Professional haircuts and breed-specific styling',
    category_id: 'grooming',
    applicable_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    icon_name: 'Brush',
    icon_color: 'text-pink-500',
    symptoms: ['Overgrown hair', 'Needs trim', 'Breed cut', 'Show grooming']
  },
  {
    specialization_id: 'deshedding',
    name: 'De-shedding',
    display_name: 'De-shedding Treatment',
    description: 'Reduce shedding and remove loose undercoat',
    category_id: 'grooming',
    applicable_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    icon_name: 'Dog',
    icon_color: 'text-amber-500',
    symptoms: ['Excessive shedding', 'Fur everywhere', 'Seasonal shedding', 'Double coat']
  },
  {
    specialization_id: 'spa_treatment',
    name: 'Spa & Wellness',
    display_name: 'Spa & Wellness',
    description: 'Premium spa treatments and wellness services',
    category_id: 'grooming',
    applicable_roles: ['groomer_solo', 'groomer_center', 'pet_groomer'],
    icon_name: 'Sparkles',
    icon_color: 'text-rose-500',
    symptoms: ['Pampering needed', 'Skin treatment', 'Aromatherapy', 'Deep conditioning']
  },

  // ========== TRAINING ==========
  {
    specialization_id: 'basic_obedience',
    name: 'Basic Obedience',
    display_name: 'Basic Obedience',
    description: 'Foundation commands and basic training',
    category_id: 'training',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    icon_name: 'GraduationCap',
    icon_color: 'text-purple-500',
    symptoms: ['Does not listen', 'No training', 'New puppy', 'Basic commands needed']
  },
  {
    specialization_id: 'potty_training',
    name: 'Potty Training',
    display_name: 'House Training',
    description: 'Toilet training and house manners',
    category_id: 'training',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    icon_name: 'Home',
    icon_color: 'text-green-500',
    symptoms: ['Accidents in house', 'Not potty trained', 'New puppy', 'Indoor marking']
  },
  {
    specialization_id: 'leash_training',
    name: 'Leash Training',
    display_name: 'Leash Walking',
    description: 'Proper leash walking and outdoor behavior',
    category_id: 'training',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    icon_name: 'Dog',
    icon_color: 'text-indigo-500',
    symptoms: ['Pulls on leash', 'Cannot walk properly', 'Reactive on leash', 'Lunges']
  },
  {
    specialization_id: 'socialization',
    name: 'Socialization',
    display_name: 'Socialization',
    description: 'Social skills with people and other animals',
    category_id: 'training',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    icon_name: 'PawPrint',
    icon_color: 'text-blue-500',
    symptoms: ['Scared of people', 'Aggressive with dogs', 'Shy', 'Fearful', 'No exposure']
  },
  {
    specialization_id: 'advanced_training',
    name: 'Advanced Skills',
    display_name: 'Advanced Training',
    description: 'Advanced commands and skill training',
    category_id: 'training',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    icon_name: 'Trophy',
    icon_color: 'text-amber-500',
    symptoms: ['Wants tricks', 'Competition training', 'Service dog', 'Advanced obedience']
  },
  {
    specialization_id: 'aggression',
    name: 'Aggression',
    display_name: 'Aggression Management',
    description: 'Addressing aggressive behaviors',
    category_id: 'training',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_trainer'],
    icon_name: 'AlertTriangle',
    icon_color: 'text-red-500',
    symptoms: ['Biting', 'Growling', 'Snapping', 'Aggressive to people', 'Aggressive to dogs']
  },

  // ========== WALKING ==========
  {
    specialization_id: 'daily_walk',
    name: 'Daily Walk',
    display_name: 'Daily Walking',
    description: 'Regular daily walking services',
    category_id: 'walking',
    applicable_roles: ['walker', 'pet_walker'],
    icon_name: 'Footprints',
    icon_color: 'text-green-500',
    symptoms: ['Needs exercise', 'Regular walks', 'Daily routine', 'Energy release']
  },
  {
    specialization_id: 'puppy_walk',
    name: 'Puppy Walking',
    display_name: 'Puppy Walks',
    description: 'Gentle walks for young puppies',
    category_id: 'walking',
    applicable_roles: ['walker', 'pet_walker'],
    icon_name: 'Dog',
    icon_color: 'text-blue-500',
    symptoms: ['Young puppy', 'Short walks needed', 'Learning to walk', 'Gentle pace']
  },
  {
    specialization_id: 'multiple_dogs',
    name: 'Multiple Dogs',
    display_name: 'Group Walks',
    description: 'Walking multiple dogs together',
    category_id: 'walking',
    applicable_roles: ['walker', 'pet_walker'],
    icon_name: 'Dog',
    icon_color: 'text-indigo-500',
    symptoms: ['Multiple pets', 'Pack walks', 'Two or more dogs', 'Group walking']
  },
  {
    specialization_id: 'senior_walk',
    name: 'Senior Care',
    display_name: 'Senior Dog Walks',
    description: 'Gentle walks for older dogs',
    category_id: 'walking',
    applicable_roles: ['walker', 'pet_walker'],
    icon_name: 'Bone',
    icon_color: 'text-amber-500',
    symptoms: ['Old dog', 'Slow pace needed', 'Arthritis', 'Limited mobility', 'Senior pet']
  },
  {
    specialization_id: 'long_walk',
    name: 'Adventure Walk',
    display_name: 'Long Adventure Walks',
    description: 'Extended walks and outdoor adventures',
    category_id: 'walking',
    applicable_roles: ['walker', 'pet_walker'],
    icon_name: 'Mountain',
    icon_color: 'text-emerald-500',
    symptoms: ['High energy', 'Needs long walks', 'Hiking', 'Adventure', 'Trail walking']
  },

  // ========== BEHAVIORAL ==========
  {
    specialization_id: 'separation_anxiety',
    name: 'Anxiety & Stress',
    display_name: 'Separation Anxiety',
    description: 'Help with anxiety and stress-related behaviors',
    category_id: 'behavioral',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_behaviorist'],
    icon_name: 'Frown',
    icon_color: 'text-yellow-500',
    symptoms: ['Anxious when alone', 'Destructive alone', 'Crying/whining', 'Pacing', 'Excessive drooling']
  },
  {
    specialization_id: 'barking',
    name: 'Barking Issues',
    display_name: 'Excessive Barking',
    description: 'Address excessive barking and vocalization',
    category_id: 'behavioral',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_behaviorist'],
    icon_name: 'Volume2',
    icon_color: 'text-orange-500',
    symptoms: ['Barks constantly', 'Barks at everything', 'Night barking', 'Alert barking', 'Demand barking']
  },
  {
    specialization_id: 'fear_phobia',
    name: 'Fear Issues',
    display_name: 'Fear & Phobias',
    description: 'Help with fears and phobias',
    category_id: 'behavioral',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_behaviorist'],
    icon_name: 'Ghost',
    icon_color: 'text-indigo-500',
    symptoms: ['Scared of noises', 'Thunder phobia', 'Firework fear', 'Scared of strangers', 'Hiding']
  },
  {
    specialization_id: 'destructive',
    name: 'Destructive Habits',
    display_name: 'Destructive Behavior',
    description: 'Address destructive behaviors',
    category_id: 'behavioral',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_behaviorist'],
    icon_name: 'Bomb',
    icon_color: 'text-red-500',
    symptoms: ['Chewing furniture', 'Destroying items', 'Digging', 'Scratching doors', 'Tearing things']
  },
  {
    specialization_id: 'resource_guarding',
    name: 'Resource Guarding',
    display_name: 'Possessive Behavior',
    description: 'Help with possessive and guarding behaviors',
    category_id: 'behavioral',
    applicable_roles: ['trainer_solo', 'trainer_center', 'pet_behaviorist'],
    icon_name: 'Shield',
    icon_color: 'text-blue-500',
    symptoms: ['Guards food', 'Guards toys', 'Growls when approached', 'Protective of items', 'Snaps near food']
  },

  // ========== BOARDING ==========
  {
    specialization_id: 'daycare',
    name: 'Daily Daycare',
    display_name: 'Pet Daycare',
    description: 'Daytime pet care and supervision',
    category_id: 'boarding',
    applicable_roles: ['boarding', 'pet_boarder', 'pet_boarding'],
    icon_name: 'Sun',
    icon_color: 'text-yellow-500',
    symptoms: ['Work hours care', 'Daily supervision', 'Playtime needed', 'Socialization']
  },
  {
    specialization_id: 'short_stay',
    name: 'Weekend Stay',
    display_name: 'Short Boarding',
    description: 'Short-term boarding (1-3 nights)',
    category_id: 'boarding',
    applicable_roles: ['boarding', 'pet_boarder', 'pet_boarding'],
    icon_name: 'Hotel',
    icon_color: 'text-orange-500',
    symptoms: ['Weekend trip', 'Short vacation', '1-3 nights', 'Quick getaway']
  },
  {
    specialization_id: 'long_stay',
    name: 'Extended Stay',
    display_name: 'Long-term Boarding',
    description: 'Extended boarding stays',
    category_id: 'boarding',
    applicable_roles: ['boarding', 'pet_boarder', 'pet_boarding'],
    icon_name: 'Home',
    icon_color: 'text-amber-500',
    symptoms: ['Long vacation', 'Extended travel', 'Week or more', 'Business trip']
  },
  {
    specialization_id: 'luxury_boarding',
    name: 'Luxury Stay',
    display_name: 'Premium Boarding',
    description: 'Premium luxury boarding experience',
    category_id: 'boarding',
    applicable_roles: ['boarding', 'pet_boarder', 'pet_boarding'],
    icon_name: 'Star',
    icon_color: 'text-purple-500',
    symptoms: ['Wants best', 'Premium care', 'Extra attention', 'Luxury amenities']
  },
  {
    specialization_id: 'medical_boarding',
    name: 'Medical Care',
    display_name: 'Medical Boarding',
    description: 'Boarding with medical supervision',
    category_id: 'boarding',
    applicable_roles: ['boarding', 'pet_boarder', 'pet_boarding', 'vet_clinic'],
    icon_name: 'Pill',
    icon_color: 'text-blue-500',
    symptoms: ['Needs medication', 'Post-surgery care', 'Special medical needs', 'Recovery boarding']
  },

  // ========== NUTRITION ==========
  {
    specialization_id: 'diet_plan',
    name: 'Diet Planning',
    display_name: 'Custom Diet Plans',
    description: 'Personalized nutrition and diet planning',
    category_id: 'wellness',
    applicable_roles: ['nutritionist', 'nutritionist_center'],
    icon_name: 'FileText',
    icon_color: 'text-green-500',
    symptoms: ['Needs diet plan', 'Nutrition advice', 'Meal planning', 'Feeding schedule']
  },
  {
    specialization_id: 'puppy_nutrition',
    name: 'Puppy Diet',
    display_name: 'Puppy Nutrition',
    description: 'Nutrition for growing puppies',
    category_id: 'wellness',
    applicable_roles: ['nutritionist', 'nutritionist_center'],
    icon_name: 'Dog',
    icon_color: 'text-blue-500',
    symptoms: ['New puppy', 'Growth diet', 'Puppy food', 'Development nutrition']
  },
  {
    specialization_id: 'senior_nutrition',
    name: 'Senior Diet',
    display_name: 'Senior Pet Nutrition',
    description: 'Nutrition for aging pets',
    category_id: 'wellness',
    applicable_roles: ['nutritionist', 'nutritionist_center'],
    icon_name: 'Heart',
    icon_color: 'text-purple-500',
    symptoms: ['Aging pet', 'Senior food', 'Joint support', 'Cognitive support']
  },
  {
    specialization_id: 'weight_management',
    name: 'Weight Loss',
    display_name: 'Weight Management',
    description: 'Weight loss and maintenance programs',
    category_id: 'wellness',
    applicable_roles: ['nutritionist', 'nutritionist_center'],
    icon_name: 'Activity',
    icon_color: 'text-orange-500',
    symptoms: ['Overweight', 'Needs to lose weight', 'Obesity', 'Weight control']
  },
  {
    specialization_id: 'allergies_sensitivities',
    name: 'Food Allergies',
    display_name: 'Allergy Diet',
    description: 'Diet for food allergies and sensitivities',
    category_id: 'wellness',
    applicable_roles: ['nutritionist', 'nutritionist_center'],
    icon_name: 'AlertTriangle',
    icon_color: 'text-red-500',
    symptoms: ['Food allergies', 'Sensitive stomach', 'Itching from food', 'Digestive issues']
  },
  {
    specialization_id: 'special_diet',
    name: 'Medical Diet',
    display_name: 'Prescription Diet',
    description: 'Medical and prescription diets',
    category_id: 'wellness',
    applicable_roles: ['nutritionist', 'nutritionist_center'],
    icon_name: 'Pill',
    icon_color: 'text-teal-500',
    symptoms: ['Kidney diet', 'Liver diet', 'Diabetic diet', 'Heart diet', 'Special medical needs']
  },
];

async function seedSpecializationMaster() {
  console.log('🚀 Seeding Specialization Master Data');
  console.log('=====================================');
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
    // Create tables if not exist
    console.log('');
    console.log('🔧 Creating tables if not exist...');
    
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

    console.log('   ✅ Tables ready');

    // Seed specializations
    console.log('');
    console.log('🔧 Seeding specializations...');
    
    let created = 0;
    let updated = 0;
    let symptomsAdded = 0;

    for (let i = 0; i < SPECIALIZATIONS.length; i++) {
      const spec = SPECIALIZATIONS[i];
      
      // Upsert specialization
      const result = await pool.query(`
        INSERT INTO specialization_master (
          specialization_id, name, display_name, description, category_id,
          applicable_roles, icon_name, icon_color, display_order
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (specialization_id) DO UPDATE SET
          name = EXCLUDED.name,
          display_name = EXCLUDED.display_name,
          description = EXCLUDED.description,
          category_id = EXCLUDED.category_id,
          applicable_roles = EXCLUDED.applicable_roles,
          icon_name = EXCLUDED.icon_name,
          icon_color = EXCLUDED.icon_color,
          display_order = EXCLUDED.display_order,
          updated_at = NOW()
        RETURNING (xmax = 0) as inserted
      `, [
        spec.specialization_id,
        spec.name,
        spec.display_name,
        spec.description,
        spec.category_id,
        spec.applicable_roles,
        spec.icon_name,
        spec.icon_color,
        i + 1
      ]);

      if (result.rows[0].inserted) {
        created++;
      } else {
        updated++;
      }

      // Add symptoms
      if (spec.symptoms && spec.symptoms.length > 0) {
        for (let j = 0; j < spec.symptoms.length; j++) {
          const symptom = spec.symptoms[j];
          try {
            await pool.query(`
              INSERT INTO specialization_symptoms (
                specialization_id, symptom_name, symptom_display_name, display_order
              ) VALUES ($1, $2, $2, $3)
              ON CONFLICT (specialization_id, symptom_name) DO NOTHING
            `, [spec.specialization_id, symptom, j + 1]);
            symptomsAdded++;
          } catch (e) {
            // Ignore duplicate
          }
        }
      }
    }

    console.log(`   ✅ Specializations: ${created} created, ${updated} updated`);
    console.log(`   ✅ Symptoms: ${symptomsAdded} added`);

    // Summary
    console.log('');
    console.log('📊 Summary:');
    
    const specCount = await pool.query('SELECT COUNT(*) FROM specialization_master');
    const symptomCount = await pool.query('SELECT COUNT(*) FROM specialization_symptoms');
    const byCategory = await pool.query(`
      SELECT category_id, COUNT(*) as count 
      FROM specialization_master 
      GROUP BY category_id 
      ORDER BY category_id
    `);

    console.log(`   Total specializations: ${specCount.rows[0].count}`);
    console.log(`   Total symptoms: ${symptomCount.rows[0].count}`);
    console.log('');
    console.log('   By category:');
    byCategory.rows.forEach(row => {
      console.log(`      ${row.category_id}: ${row.count} specializations`);
    });

    console.log('');
    console.log('✅ Specialization Master Seeding Complete!');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedSpecializationMaster().catch(console.error);

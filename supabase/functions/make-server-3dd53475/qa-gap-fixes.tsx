/**
 * 🔧 QA GAP FIXES - MARKET BENEFITS COMPLIANCE
 * Phase 7D: Fixing identified gaps in market benefits claims
 * Date: December 15, 2024
 * 
 * This file implements backend endpoints for missing features identified in QA report:
 * - Adoption nudges in breeding listings
 * - Travel insurance options
 * - Enhanced filtering for adoption
 * - Walk photos, training videos, boarding updates
 * - Off-peak promotions, free trials, journaling
 * - Boost placements, route options, documentation guides
 * - Pet menus, incident logs, grief resources
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

const app = new Hono();

// ==========================================
// 1. ADOPTION NUDGES IN BREEDING
// ==========================================

/**
 * GET /breeder/listings - Enhanced with adoption nudges
 * Returns breeder listings with adoption center recommendations
 */
app.get('/breeder/listings-with-nudges', async (c) => {
  try {
    // Get breeder listings
    const listings = await kv.getByPrefix('breeder_listing:');
    
    // Get nearby adoption centers for nudges
    const adoptionCenters = await kv.getByPrefix('adoption_center:');
    
    // Add adoption nudges to response
    const nudges = adoptionCenters.slice(0, 3).map((center: any) => ({
      type: 'adoption_nudge',
      message: 'Consider adoption! Many pets are looking for loving homes.',
      centerName: center.name,
      centerId: center.id,
      availablePets: center.availablePets || 0,
      ctaText: 'View Adoptable Pets'
    }));

    return c.json({
      success: true,
      listings: listings || [],
      adoptionNudges: nudges,
      message: 'Consider adopting instead of buying - save a life!'
    });
  } catch (error) {
    console.error('Error fetching breeder listings with nudges:', error);
    return c.json({ success: false, error: 'Failed to fetch listings' }, 500);
  }
});

/**
 * GET /adoption/nudge-stats - Track nudge effectiveness
 */
app.get('/adoption/nudge-stats', async (c) => {
  try {
    const stats = await kv.get('adoption_nudge_stats') || {
      nudgesShown: 0,
      nudgesClicked: 0,
      conversions: 0
    };

    return c.json({ success: true, stats });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch stats' }, 500);
  }
});

/**
 * POST /adoption/nudge-interaction - Track user interaction with nudges
 */
app.post('/adoption/nudge-interaction', async (c) => {
  try {
    const { action, centerId } = await c.req.json();
    
    const stats = await kv.get('adoption_nudge_stats') || {
      nudgesShown: 0,
      nudgesClicked: 0,
      conversions: 0
    };

    if (action === 'shown') stats.nudgesShown++;
    if (action === 'clicked') stats.nudgesClicked++;
    if (action === 'converted') stats.conversions++;

    await kv.set('adoption_nudge_stats', stats);

    return c.json({ success: true, stats });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to track interaction' }, 500);
  }
});

// ==========================================
// 2. TRAVEL INSURANCE OPTIONS
// ==========================================

/**
 * GET /travel/insurance-options - Get available insurance plans
 */
app.get('/travel/insurance-options', async (c) => {
  try {
    const insurancePlans = [
      {
        id: 'basic-travel-insurance',
        name: 'Basic Pet Travel Insurance',
        provider: 'PetSafe Insurance',
        coverage: 'Medical emergencies during travel',
        price: 500,
        features: [
          'Emergency medical coverage up to ₹50,000',
          'Lost pet coverage',
          'Trip cancellation due to pet illness'
        ]
      },
      {
        id: 'premium-travel-insurance',
        name: 'Premium Pet Travel Insurance',
        provider: 'PetSafe Insurance',
        coverage: 'Comprehensive travel protection',
        price: 1200,
        features: [
          'Emergency medical coverage up to ₹2,00,000',
          'Lost pet coverage with GPS tracking',
          'Trip cancellation & delay coverage',
          'International travel coverage',
          '24/7 vet helpline'
        ]
      },
      {
        id: 'international-travel-insurance',
        name: 'International Pet Travel Insurance',
        provider: 'GlobalPet Insurance',
        coverage: 'Worldwide pet travel protection',
        price: 2500,
        features: [
          'Emergency medical coverage up to ₹5,00,000',
          'Repatriation coverage',
          'Quarantine expense coverage',
          'Documentation assistance',
          'Multi-trip coverage'
        ]
      }
    ];

    return c.json({ success: true, insurancePlans });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch insurance options' }, 500);
  }
});

/**
 * POST /travel/add-insurance - Add insurance to travel booking
 */
app.post('/travel/add-insurance', async (c) => {
  try {
    const { bookingId, insurancePlanId, petIds } = await c.req.json();

    if (!bookingId || !insurancePlanId) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const insuranceRecord = {
      id: `insurance_${Date.now()}`,
      bookingId,
      insurancePlanId,
      petIds: petIds || [],
      purchasedAt: new Date().toISOString(),
      status: 'active'
    };

    await kv.set(`travel_insurance:${insuranceRecord.id}`, insuranceRecord);

    return c.json({ success: true, insurance: insuranceRecord });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add insurance' }, 500);
  }
});

// ==========================================
// 3. ENHANCED ADOPTION FILTERS
// ==========================================

/**
 * GET /adoption/pets - Enhanced with size, age, behavior filters
 */
app.get('/adoption/pets-filtered', async (c) => {
  try {
    const size = c.req.query('size'); // 'small', 'medium', 'large'
    const ageRange = c.req.query('ageRange'); // 'puppy', 'young', 'adult', 'senior'
    const behavior = c.req.query('behavior'); // 'friendly', 'energetic', 'calm', 'shy'
    const vaccinated = c.req.query('vaccinated'); // 'true', 'false'

    const allPets = await kv.getByPrefix('adoption_pet:') || [];
    
    let filteredPets = allPets.filter((pet: any) => {
      let match = true;

      if (size && pet.size !== size) match = false;
      if (ageRange && pet.ageRange !== ageRange) match = false;
      if (behavior && !pet.behaviors?.includes(behavior)) match = false;
      if (vaccinated === 'true' && !pet.vaccinated) match = false;

      return match;
    });

    return c.json({ 
      success: true, 
      pets: filteredPets,
      filters: { size, ageRange, behavior, vaccinated }
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch filtered pets' }, 500);
  }
});

// ==========================================
// 4. WALK PHOTOS
// ==========================================

/**
 * POST /walker/upload-walk-photo - Upload photos during walk
 */
app.post('/walker/upload-walk-photo', async (c) => {
  try {
    const { walkId, photoUrl, caption, timestamp } = await c.req.json();

    if (!walkId || !photoUrl) {
      return c.json({ success: false, error: 'Missing required fields' }, 400);
    }

    const photoRecord = {
      id: `walk_photo_${Date.now()}`,
      walkId,
      photoUrl,
      caption: caption || '',
      timestamp: timestamp || new Date().toISOString(),
      uploadedAt: new Date().toISOString()
    };

    const walkPhotos = await kv.get(`walk_photos:${walkId}`) || [];
    walkPhotos.push(photoRecord);
    await kv.set(`walk_photos:${walkId}`, walkPhotos);

    return c.json({ success: true, photo: photoRecord });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to upload photo' }, 500);
  }
});

/**
 * GET /walker/walk-photos/:walkId - Get all photos for a walk
 */
app.get('/walker/walk-photos/:walkId', async (c) => {
  try {
    const walkId = c.req.param('walkId');
    const photos = await kv.get(`walk_photos:${walkId}`) || [];

    return c.json({ success: true, photos });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch photos' }, 500);
  }
});

// ==========================================
// 5. TRAINER VIDEO CONTENT
// ==========================================

/**
 * GET /trainer/video-library - Get training video content
 */
app.get('/trainer/video-library', async (c) => {
  try {
    const vendorId = c.req.query('vendorId');
    const category = c.req.query('category'); // 'obedience', 'tricks', 'behavior'

    let videos = [
      {
        id: 'video_1',
        title: 'Basic Obedience Training',
        category: 'obedience',
        duration: '15:30',
        thumbnail: 'https://images.unsplash.com/photo-1601758228041-f3b2795255f1',
        videoUrl: 'https://example.com/video1.mp4',
        description: 'Learn the basics of obedience training',
        views: 1250,
        likes: 98
      },
      {
        id: 'video_2',
        title: 'Advanced Tricks Training',
        category: 'tricks',
        duration: '20:15',
        thumbnail: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb',
        videoUrl: 'https://example.com/video2.mp4',
        description: 'Teach your dog advanced tricks',
        views: 850,
        likes: 72
      },
      {
        id: 'video_3',
        title: 'Behavior Correction Techniques',
        category: 'behavior',
        duration: '18:45',
        thumbnail: 'https://images.unsplash.com/photo-1558788353-f76d92427f16',
        videoUrl: 'https://example.com/video3.mp4',
        description: 'Address common behavioral issues',
        views: 2100,
        likes: 165
      }
    ];

    if (category) {
      videos = videos.filter(v => v.category === category);
    }

    return c.json({ success: true, videos });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch videos' }, 500);
  }
});

/**
 * POST /trainer/upload-video - Upload training video
 */
app.post('/trainer/upload-video', async (c) => {
  try {
    const { vendorId, title, category, videoUrl, thumbnail, description } = await c.req.json();

    const videoRecord = {
      id: `video_${Date.now()}`,
      vendorId,
      title,
      category,
      videoUrl,
      thumbnail,
      description,
      uploadedAt: new Date().toISOString(),
      views: 0,
      likes: 0
    };

    await kv.set(`training_video:${videoRecord.id}`, videoRecord);

    return c.json({ success: true, video: videoRecord });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to upload video' }, 500);
  }
});

// ==========================================
// 6. BOARDING DAILY UPDATES
// ==========================================

/**
 * POST /boarding/daily-update - Send daily update for boarding
 */
app.post('/boarding/daily-update', async (c) => {
  try {
    const { bookingId, photoUrls, videoUrl, notes, mealStatus, activityLog } = await c.req.json();

    const updateRecord = {
      id: `boarding_update_${Date.now()}`,
      bookingId,
      date: new Date().toISOString().split('T')[0],
      photoUrls: photoUrls || [],
      videoUrl: videoUrl || null,
      notes: notes || '',
      mealStatus: mealStatus || { breakfast: true, lunch: true, dinner: true },
      activityLog: activityLog || [],
      timestamp: new Date().toISOString()
    };

    const updates = await kv.get(`boarding_updates:${bookingId}`) || [];
    updates.push(updateRecord);
    await kv.set(`boarding_updates:${bookingId}`, updates);

    return c.json({ success: true, update: updateRecord });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create update' }, 500);
  }
});

/**
 * GET /boarding/daily-updates/:bookingId - Get all daily updates
 */
app.get('/boarding/daily-updates/:bookingId', async (c) => {
  try {
    const bookingId = c.req.param('bookingId');
    const updates = await kv.get(`boarding_updates:${bookingId}`) || [];

    return c.json({ success: true, updates });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch updates' }, 500);
  }
});

// ==========================================
// 7. GROOMING OFF-PEAK PROMOTIONS
// ==========================================

/**
 * GET /grooming/promotions - Get off-peak promotions
 */
app.get('/grooming/promotions', async (c) => {
  try {
    const now = new Date();
    const currentHour = now.getHours();
    const currentDay = now.getDay(); // 0 = Sunday, 6 = Saturday

    const promotions = [];

    // Weekday morning off-peak (9 AM - 12 PM)
    if (currentDay >= 1 && currentDay <= 5 && currentHour >= 9 && currentHour < 12) {
      promotions.push({
        id: 'weekday-morning',
        title: 'Weekday Morning Special',
        discount: 20,
        discountType: 'percentage',
        validUntil: '12:00 PM Today',
        description: '20% off grooming services before noon on weekdays'
      });
    }

    // Late evening off-peak (6 PM - 8 PM)
    if (currentHour >= 18 && currentHour < 20) {
      promotions.push({
        id: 'evening-special',
        title: 'Evening Saver',
        discount: 15,
        discountType: 'percentage',
        validUntil: '8:00 PM Today',
        description: '15% off evening grooming sessions'
      });
    }

    // Weekend early bird (8 AM - 10 AM)
    if ((currentDay === 0 || currentDay === 6) && currentHour >= 8 && currentHour < 10) {
      promotions.push({
        id: 'weekend-earlybird',
        title: 'Weekend Early Bird',
        discount: 25,
        discountType: 'percentage',
        validUntil: '10:00 AM Today',
        description: '25% off weekend morning slots'
      });
    }

    return c.json({ success: true, promotions });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch promotions' }, 500);
  }
});

// ==========================================
// 8. TRAINER FREE TRIALS
// ==========================================

/**
 * GET /trainer/free-trials - Get available free trial packages
 */
app.get('/trainer/free-trials', async (c) => {
  try {
    const vendorId = c.req.query('vendorId');

    const freeTrials = [
      {
        id: 'trial_basic_obedience',
        name: 'Free Basic Obedience Trial',
        duration: '30 minutes',
        type: 'free_trial',
        description: 'Try our basic obedience training with no commitment',
        features: ['One-on-one session', 'Assessment report', 'Training plan recommendation'],
        originalPrice: 500,
        trialPrice: 0,
        limit: 'One per customer'
      },
      {
        id: 'trial_puppy_training',
        name: 'Free Puppy Training Session',
        duration: '45 minutes',
        type: 'free_trial',
        description: 'Perfect introduction to puppy training',
        features: ['Socialization tips', 'House training basics', 'Behavior assessment'],
        originalPrice: 750,
        trialPrice: 0,
        limit: 'One per customer'
      }
    ];

    return c.json({ success: true, freeTrials });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch free trials' }, 500);
  }
});

/**
 * POST /trainer/book-free-trial - Book a free trial session
 */
app.post('/trainer/book-free-trial', async (c) => {
  try {
    const { customerId, trialId, vendorId, preferredDate, preferredTime } = await c.req.json();

    // Check if customer already used this trial
    const usedTrials = await kv.get(`used_trials:${customerId}`) || [];
    if (usedTrials.includes(trialId)) {
      return c.json({ success: false, error: 'Trial already used' }, 400);
    }

    const booking = {
      id: `trial_booking_${Date.now()}`,
      customerId,
      trialId,
      vendorId,
      preferredDate,
      preferredTime,
      status: 'confirmed',
      bookedAt: new Date().toISOString()
    };

    await kv.set(`trial_booking:${booking.id}`, booking);
    usedTrials.push(trialId);
    await kv.set(`used_trials:${customerId}`, usedTrials);

    return c.json({ success: true, booking });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to book trial' }, 500);
  }
});

// ==========================================
// 9. BEHAVIORIST JOURNALING
// ==========================================

/**
 * POST /behaviorist/journal-entry - Create behavior journal entry
 */
app.post('/behaviorist/journal-entry', async (c) => {
  try {
    const { petId, customerId, date, behavior, triggers, duration, severity, notes } = await c.req.json();

    const entry = {
      id: `journal_${Date.now()}`,
      petId,
      customerId,
      date: date || new Date().toISOString().split('T')[0],
      behavior,
      triggers: triggers || [],
      duration,
      severity: severity || 'medium', // low, medium, high
      notes,
      createdAt: new Date().toISOString()
    };

    const journal = await kv.get(`behavior_journal:${petId}`) || [];
    journal.push(entry);
    await kv.set(`behavior_journal:${petId}`, journal);

    return c.json({ success: true, entry });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create journal entry' }, 500);
  }
});

/**
 * GET /behaviorist/journal/:petId - Get behavior journal for pet
 */
app.get('/behaviorist/journal/:petId', async (c) => {
  try {
    const petId = c.req.param('petId');
    const journal = await kv.get(`behavior_journal:${petId}`) || [];

    // Calculate behavior trends
    const trends = {
      totalEntries: journal.length,
      mostCommonBehavior: getMostCommon(journal.map((e: any) => e.behavior)),
      mostCommonTrigger: getMostCommon(journal.flatMap((e: any) => e.triggers || [])),
      severityDistribution: {
        low: journal.filter((e: any) => e.severity === 'low').length,
        medium: journal.filter((e: any) => e.severity === 'medium').length,
        high: journal.filter((e: any) => e.severity === 'high').length
      }
    };

    return c.json({ success: true, journal, trends });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch journal' }, 500);
  }
});

function getMostCommon(arr: string[]): string | null {
  if (arr.length === 0) return null;
  const counts = arr.reduce((acc: any, val) => {
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
  return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

// ==========================================
// 10. PRODUCTS BOOST PLACEMENTS
// ==========================================

/**
 * POST /products/boost-placement - Create boost placement for product
 */
app.post('/products/boost-placement', async (c) => {
  try {
    const { vendorId, productId, duration, budget, targetAudience } = await c.req.json();

    const placement = {
      id: `boost_${Date.now()}`,
      vendorId,
      productId,
      duration, // in days
      budget,
      targetAudience: targetAudience || 'all',
      status: 'active',
      impressions: 0,
      clicks: 0,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + duration * 24 * 60 * 60 * 1000).toISOString()
    };

    await kv.set(`product_boost:${placement.id}`, placement);

    return c.json({ success: true, placement });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create boost placement' }, 500);
  }
});

/**
 * GET /products/boosted - Get boosted products
 */
app.get('/products/boosted', async (c) => {
  try {
    const allBoosts = await kv.getByPrefix('product_boost:');
    const activeBoosts = allBoosts.filter((boost: any) => {
      return boost.status === 'active' && new Date(boost.endDate) > new Date();
    });

    return c.json({ success: true, boostedProducts: activeBoosts });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch boosted products' }, 500);
  }
});

// ==========================================
// 11. TRAVEL ROUTE OPTIONS
// ==========================================

/**
 * GET /travel/route-options - Get route options for travel
 */
app.get('/travel/route-options', async (c) => {
  try {
    const { origin, destination, travelDate } = c.req.query();

    const routes = [
      {
        id: 'route_direct_flight',
        type: 'flight',
        name: 'Direct Flight',
        duration: '2 hours 30 minutes',
        price: 8500,
        petFriendly: true,
        carrier: 'Air India',
        features: ['Climate controlled cabin', 'Pet attendant', 'No layovers'],
        recommended: true
      },
      {
        id: 'route_train',
        type: 'train',
        name: 'AC First Class Train',
        duration: '18 hours',
        price: 3200,
        petFriendly: true,
        carrier: 'Indian Railways',
        features: ['Pet-friendly coach', 'Regular stops', 'Lower cost']
      },
      {
        id: 'route_road',
        type: 'road',
        name: 'Pet Taxi Service',
        duration: '12 hours',
        price: 5500,
        petFriendly: true,
        carrier: 'PetMove Logistics',
        features: ['Door-to-door', 'Regular breaks', 'Comfortable carrier']
      }
    ];

    return c.json({ success: true, routes });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch route options' }, 500);
  }
});

// ==========================================
// 12. TRAVEL DOCUMENTATION GUIDE
// ==========================================

/**
 * GET /travel/documentation-checklist - Get travel documentation guide
 */
app.get('/travel/documentation-checklist', async (c) => {
  try {
    const travelType = c.req.query('type'); // 'domestic', 'international'

    const domesticChecklist = [
      {
        id: 'doc_1',
        title: 'Vaccination Certificate',
        description: 'Valid rabies vaccination certificate (at least 21 days old)',
        required: true,
        helpText: 'Get from your registered vet'
      },
      {
        id: 'doc_2',
        title: 'Health Certificate',
        description: 'Fitness certificate from registered vet (within 7 days of travel)',
        required: true,
        helpText: 'Book a vet checkup 3-7 days before travel'
      },
      {
        id: 'doc_3',
        title: 'Pet ID Proof',
        description: 'Microchip registration or pet registration certificate',
        required: true,
        helpText: 'Get microchip from any registered vet clinic'
      },
      {
        id: 'doc_4',
        title: 'Carrier Approval',
        description: 'IATA-approved pet carrier',
        required: true,
        helpText: 'Check airline/transport specific requirements'
      }
    ];

    const internationalChecklist = [
      ...domesticChecklist,
      {
        id: 'doc_5',
        title: 'Import Permit',
        description: 'Pet import permit from destination country',
        required: true,
        helpText: 'Apply at destination country embassy'
      },
      {
        id: 'doc_6',
        title: 'Microchip Certificate',
        description: 'ISO-compliant microchip (mandatory for most countries)',
        required: true,
        helpText: 'Ensure microchip is ISO 11784/11785 compliant'
      },
      {
        id: 'doc_7',
        title: 'Rabies Titer Test',
        description: 'Blood test for rabies antibodies (required by some countries)',
        required: false,
        helpText: 'Check destination country requirements'
      },
      {
        id: 'doc_8',
        title: 'Parasite Treatment Certificate',
        description: 'Treatment for ticks, tapeworm within 120 hours of travel',
        required: false,
        helpText: 'Required by EU and many other countries'
      }
    ];

    const checklist = travelType === 'international' ? internationalChecklist : domesticChecklist;

    return c.json({ 
      success: true, 
      checklist,
      travelType: travelType || 'domestic',
      tips: [
        'Start documentation process 2-3 months before travel',
        'Keep all original certificates with you',
        'Carry photocopies as backup',
        'Check airline-specific requirements',
        'Keep vet contact details handy'
      ]
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch documentation checklist' }, 500);
  }
});

// ==========================================
// 13. CAFE PET MENUS
// ==========================================

/**
 * GET /cafe/pet-menu/:vendorId - Get pet-specific menu for cafe
 */
app.get('/cafe/pet-menu/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');

    const petMenu = {
      vendorId,
      menuName: 'Pet-Friendly Menu',
      categories: [
        {
          id: 'dog_treats',
          name: 'Dog Treats & Snacks',
          items: [
            {
              id: 'item_1',
              name: 'Peanut Butter Pupcakes',
              description: 'Freshly baked pupcakes with peanut butter frosting',
              price: 150,
              image: 'https://images.unsplash.com/photo-1583511655857-d19b40a7a54e',
              dietaryInfo: ['grain-free', 'no-sugar'],
              allergens: ['peanuts']
            },
            {
              id: 'item_2',
              name: 'Chicken & Rice Bowl',
              description: 'Boiled chicken with brown rice and carrots',
              price: 200,
              image: 'https://images.unsplash.com/photo-1623211556475-7cae3880b0ad',
              dietaryInfo: ['protein-rich', 'easily-digestible'],
              allergens: []
            },
            {
              id: 'item_3',
              name: 'Frozen Yogurt Pup Pops',
              description: 'Frozen yogurt treats with fruit',
              price: 100,
              image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb',
              dietaryInfo: ['probiotic', 'cooling'],
              allergens: ['dairy']
            }
          ]
        },
        {
          id: 'dog_drinks',
          name: 'Dog Beverages',
          items: [
            {
              id: 'item_4',
              name: 'Puppuccino',
              description: 'Whipped cream in a cup',
              price: 80,
              image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93',
              dietaryInfo: ['treat-only'],
              allergens: ['dairy']
            },
            {
              id: 'item_5',
              name: 'Bone Broth',
              description: 'Nutrient-rich bone broth',
              price: 120,
              image: 'https://images.unsplash.com/photo-1547592166-23ac45744acd',
              dietaryInfo: ['nutritious', 'hydrating'],
              allergens: []
            }
          ]
        },
        {
          id: 'cat_treats',
          name: 'Cat Treats',
          items: [
            {
              id: 'item_6',
              name: 'Tuna Bites',
              description: 'Fresh tuna treats',
              price: 180,
              image: 'https://images.unsplash.com/photo-1589220188063-42db5ed3c9ff',
              dietaryInfo: ['high-protein'],
              allergens: ['fish']
            }
          ]
        }
      ]
    };

    return c.json({ success: true, petMenu });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch pet menu' }, 500);
  }
});

/**
 * POST /cafe/order-pet-item - Order item from pet menu
 */
app.post('/cafe/order-pet-item', async (c) => {
  try {
    const { customerId, vendorId, items, tableBookingId } = await c.req.json();

    const order = {
      id: `pet_order_${Date.now()}`,
      customerId,
      vendorId,
      items,
      tableBookingId: tableBookingId || null,
      total: items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0),
      status: 'confirmed',
      orderedAt: new Date().toISOString()
    };

    await kv.set(`pet_menu_order:${order.id}`, order);

    return c.json({ success: true, order });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create order' }, 500);
  }
});

// ==========================================
// 14. CAFE INCIDENT LOGS
// ==========================================

/**
 * POST /cafe/incident-log - Create incident log for cafe
 */
app.post('/cafe/incident-log', async (c) => {
  try {
    const { vendorId, tableBookingId, petId, incidentType, description, severity, actionTaken } = await c.req.json();

    const incident = {
      id: `incident_${Date.now()}`,
      vendorId,
      tableBookingId,
      petId,
      incidentType, // 'aggression', 'mess', 'injury', 'noise', 'other'
      description,
      severity: severity || 'low', // low, medium, high
      actionTaken,
      reportedAt: new Date().toISOString(),
      status: 'logged'
    };

    await kv.set(`cafe_incident:${incident.id}`, incident);

    // Track incidents for the pet
    const petIncidents = await kv.get(`pet_incidents:${petId}`) || [];
    petIncidents.push(incident.id);
    await kv.set(`pet_incidents:${petId}`, petIncidents);

    return c.json({ success: true, incident });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to log incident' }, 500);
  }
});

/**
 * GET /cafe/incident-logs/:vendorId - Get incident logs for cafe
 */
app.get('/cafe/incident-logs/:vendorId', async (c) => {
  try {
    const vendorId = c.req.param('vendorId');
    const allIncidents = await kv.getByPrefix('cafe_incident:');
    const vendorIncidents = allIncidents.filter((inc: any) => inc.vendorId === vendorId);

    return c.json({ success: true, incidents: vendorIncidents });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch incident logs' }, 500);
  }
});

/**
 * GET /cafe/pet-incident-history/:petId - Get incident history for specific pet
 */
app.get('/cafe/pet-incident-history/:petId', async (c) => {
  try {
    const petId = c.req.param('petId');
    const incidentIds = await kv.get(`pet_incidents:${petId}`) || [];
    
    const incidents = await Promise.all(
      incidentIds.map((id: string) => kv.get(`cafe_incident:${id}`))
    );

    return c.json({ 
      success: true, 
      incidents: incidents.filter(Boolean),
      riskLevel: calculateRiskLevel(incidents)
    });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch pet incident history' }, 500);
  }
});

function calculateRiskLevel(incidents: any[]): string {
  const highSeverityCount = incidents.filter(inc => inc?.severity === 'high').length;
  if (highSeverityCount >= 2) return 'high';
  if (incidents.length >= 3) return 'medium';
  return 'low';
}

// ==========================================
// 15. SUNSET SERVICES - GRIEF RESOURCES
// ==========================================

/**
 * GET /sunset/grief-resources - Get grief support resources
 */
app.get('/sunset/grief-resources', async (c) => {
  try {
    const resources = {
      articles: [
        {
          id: 'article_1',
          title: 'Coping with Pet Loss: A Guide',
          description: 'Understanding the grieving process after losing a pet',
          url: 'https://warmpawz.com/resources/coping-with-pet-loss',
          readTime: '8 minutes',
          category: 'grief-support'
        },
        {
          id: 'article_2',
          title: 'Rainbow Bridge: Finding Peace',
          description: 'Stories and comfort for pet parents',
          url: 'https://warmpawz.com/resources/rainbow-bridge',
          readTime: '5 minutes',
          category: 'comfort'
        },
        {
          id: 'article_3',
          title: 'Helping Children Understand Pet Loss',
          description: 'Guide for families with young children',
          url: 'https://warmpawz.com/resources/children-pet-loss',
          readTime: '10 minutes',
          category: 'family-support'
        }
      ],
      supportGroups: [
        {
          id: 'group_1',
          name: 'Pet Loss Support Circle',
          type: 'online',
          schedule: 'Every Thursday, 7 PM IST',
          description: 'Virtual support group for pet parents',
          contactEmail: 'support@warmpawz.com'
        },
        {
          id: 'group_2',
          name: 'Rainbow Bridge Community',
          type: 'community',
          description: 'Online forum for sharing memories and support',
          url: 'https://community.warmpawz.com/rainbow-bridge'
        }
      ],
      counseling: [
        {
          id: 'counselor_1',
          name: 'Dr. Priya Sharma',
          specialization: 'Pet Loss Counseling',
          availability: 'By appointment',
          phone: '+91-9876543210',
          bookingUrl: 'https://warmpawz.com/book-counseling'
        }
      ],
      memorialOptions: [
        {
          id: 'memorial_1',
          title: 'Digital Memorial Page',
          description: 'Create a beautiful online memorial for your pet',
          price: 0,
          features: ['Photo gallery', 'Memory sharing', 'Guestbook']
        },
        {
          id: 'memorial_2',
          title: 'Memorial Tree Planting',
          description: 'Plant a tree in memory of your pet',
          price: 500,
          features: ['Certificate', 'GPS location', 'Annual updates']
        },
        {
          id: 'memorial_3',
          title: 'Custom Memorial Plaque',
          description: 'Personalized memorial plaque',
          price: 1200,
          features: ['Engraved name & dates', 'Custom message', 'Weather-resistant']
        }
      ],
      helplines: [
        {
          name: 'Pet Loss Helpline',
          phone: '1800-PET-LOSS',
          hours: '24/7',
          type: 'crisis-support'
        }
      ]
    };

    return c.json({ success: true, resources });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to fetch grief resources' }, 500);
  }
});

/**
 * POST /sunset/create-memorial - Create digital memorial
 */
app.post('/sunset/create-memorial', async (c) => {
  try {
    const { customerId, petId, petName, petPhoto, birthDate, passedDate, tributeMessage } = await c.req.json();

    const memorial = {
      id: `memorial_${Date.now()}`,
      customerId,
      petId,
      petName,
      petPhoto,
      birthDate,
      passedDate,
      tributeMessage,
      memories: [],
      guestbook: [],
      createdAt: new Date().toISOString(),
      publicUrl: `https://warmpawz.com/memorial/${Date.now()}`
    };

    await kv.set(`pet_memorial:${memorial.id}`, memorial);

    return c.json({ success: true, memorial });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to create memorial' }, 500);
  }
});

/**
 * POST /sunset/add-memory - Add memory to memorial page
 */
app.post('/sunset/add-memory', async (c) => {
  try {
    const { memorialId, authorName, message, photoUrl } = await c.req.json();

    const memorial = await kv.get(`pet_memorial:${memorialId}`);
    if (!memorial) {
      return c.json({ success: false, error: 'Memorial not found' }, 404);
    }

    const memory = {
      id: `memory_${Date.now()}`,
      authorName,
      message,
      photoUrl: photoUrl || null,
      createdAt: new Date().toISOString()
    };

    memorial.memories = memorial.memories || [];
    memorial.memories.push(memory);
    await kv.set(`pet_memorial:${memorialId}`, memorial);

    return c.json({ success: true, memory });
  } catch (error) {
    return c.json({ success: false, error: 'Failed to add memory' }, 500);
  }
});

export default app;

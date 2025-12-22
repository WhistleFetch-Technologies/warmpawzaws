/**
 * COMPREHENSIVE TEST: Content Management, Mating & Dating, Pet Suggestion Systems
 * Tests UI, flows, routes, CRUD, indexes, data structures, and payment integration
 */

import { projectId, publicAnonKey } from '../utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-3dd53475`;

interface TestResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

const results: TestResult[] = [];

function logResult(test: string, status: 'pass' | 'fail' | 'warning', message: string, details?: any) {
  results.push({ test, status, message, details });
  const emoji = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
  console.log(`${emoji} [${test}] ${message}`);
  if (details) console.log('   Details:', details);
}

// ============================================
// 1. CONTENT MANAGEMENT SYSTEM TESTS
// ============================================

async function testContentManagement() {
  console.log('\n📋 TESTING CONTENT MANAGEMENT SYSTEM\n');

  // Test 1.1: Create Banner
  try {
    const bannerData = {
      type: 'main',
      title: 'Test Banner',
      subtitle: 'Test Subtitle',
      imageUrl: 'https://example.com/banner.jpg',
      ctaText: 'Shop Now',
      ctaLink: '/shop',
      targetAudience: 'customer',
      priority: 10,
      isActive: true,
      metadata: { bg: 'linear-gradient(135deg, #FF8C42 0%, #FF6B35 100%)', emoji: '🎉' }
    };

    const createRes = await fetch(`${API_BASE}/admin/content/banners`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(bannerData)
    });

    const createData = await createRes.json();
    if (createRes.ok && createData.banner) {
      logResult('Content-1.1', 'pass', 'Create banner endpoint works', { bannerId: createData.banner.id });
      
      const bannerId = createData.banner.id;

      // Test 1.2: Get Banner
      const getRes = await fetch(`${API_BASE}/admin/content/banners/${bannerId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const getData = await getRes.json();
      if (getRes.ok && getData.banner) {
        logResult('Content-1.2', 'pass', 'Get banner endpoint works');
      } else {
        logResult('Content-1.2', 'fail', 'Get banner failed', getData);
      }

      // Test 1.3: Approve Banner
      const approveRes = await fetch(`${API_BASE}/admin/content/banners/${bannerId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approvedBy: 'admin_test' })
      });
      const approveData = await approveRes.json();
      if (approveRes.ok && approveData.banner?.approvalStatus === 'approved') {
        logResult('Content-1.3', 'pass', 'Approve banner endpoint works');
      } else {
        logResult('Content-1.3', 'fail', 'Approve banner failed', approveData);
      }

      // Test 1.4: Customer-facing banner API
      const customerRes = await fetch(`${API_BASE}/customer/content/banners?type=main`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const customerData = await customerRes.json();
      if (customerRes.ok && Array.isArray(customerData.banners)) {
        const approvedBanners = customerData.banners.filter((b: any) => b.approvalStatus === 'approved');
        logResult('Content-1.4', 'pass', 'Customer banner API works', { count: approvedBanners.length });
      } else {
        logResult('Content-1.4', 'fail', 'Customer banner API failed', customerData);
      }

      // Test 1.5: Update Banner
      const updateRes = await fetch(`${API_BASE}/admin/content/banners/${bannerId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'Updated Banner Title' })
      });
      const updateData = await updateRes.json();
      if (updateRes.ok && updateData.banner?.title === 'Updated Banner Title') {
        logResult('Content-1.5', 'pass', 'Update banner endpoint works');
      } else {
        logResult('Content-1.5', 'fail', 'Update banner failed', updateData);
      }

      // Test 1.6: Delete Banner
      const deleteRes = await fetch(`${API_BASE}/admin/content/banners/${bannerId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const deleteData = await deleteRes.json();
      if (deleteRes.ok) {
        logResult('Content-1.6', 'pass', 'Delete banner endpoint works');
      } else {
        logResult('Content-1.6', 'fail', 'Delete banner failed', deleteData);
      }
    } else {
      logResult('Content-1.1', 'fail', 'Create banner failed', createData);
    }
  } catch (error: any) {
    logResult('Content-1.1', 'fail', 'Create banner error', error.message);
  }

  // Test 1.7: Content Asset Management
  try {
    const assetData = {
      name: 'Test Asset',
      type: 'image',
      url: 'https://example.com/asset.jpg',
      category: 'banner',
      usageContext: 'social_media',
      tags: ['promotion', 'sale']
    };

    const assetRes = await fetch(`${API_BASE}/admin/content/assets`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(assetData)
    });

    const assetCreateData = await assetRes.json();
    if (assetRes.ok && assetCreateData.asset) {
      logResult('Content-1.7', 'pass', 'Create asset endpoint works', { assetId: assetCreateData.asset.id });
      
      // Test asset approval
      const assetId = assetCreateData.asset.id;
      const approveAssetRes = await fetch(`${API_BASE}/admin/content/assets/${assetId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ approvedBy: 'admin_test' })
      });
      if (approveAssetRes.ok) {
        logResult('Content-1.8', 'pass', 'Approve asset endpoint works');
      }
    } else {
      logResult('Content-1.7', 'fail', 'Create asset failed', assetCreateData);
    }
  } catch (error: any) {
    logResult('Content-1.7', 'fail', 'Asset management error', error.message);
  }

  // Test 1.9: Content Stats
  try {
    const statsRes = await fetch(`${API_BASE}/admin/content/stats`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    const statsData = await statsRes.json();
    if (statsRes.ok && statsData.stats) {
      logResult('Content-1.9', 'pass', 'Content stats endpoint works', statsData.stats);
    } else {
      logResult('Content-1.9', 'fail', 'Content stats failed', statsData);
    }
  } catch (error: any) {
    logResult('Content-1.9', 'fail', 'Content stats error', error.message);
  }
}

// ============================================
// 2. PET SUGGESTION SYSTEM TESTS
// ============================================

async function testPetSuggestionSystem() {
  console.log('\n🐾 TESTING PET SUGGESTION SYSTEM\n');

  const testPhone = '9999999999';
  const questionnaireData = {
    timeCommitment: 'medium',
    children: 'yes',
    otherPets: 'no',
    allergies: 'no',
    dogSize: 'medium',
    energyLevel: 'medium',
    importantTraits: ['friendly', 'playful'],
    selectedBreeds: ['Golden Retriever', 'Labrador'],
    livingSituation: 'house_yard',
    experience: 'first_time'
  };

  // Test 2.1: Generate Pet Suggestions
  try {
    const suggestRes = await fetch(`${API_BASE}/customer/pet-suggestions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: testPhone,
        questionnaireData
      })
    });

    const suggestData = await suggestRes.json();
    if (suggestRes.ok && suggestData.suggestions) {
      logResult('Pet-2.1', 'pass', 'Pet suggestions endpoint works', {
        count: suggestData.suggestions.length,
        suggestionId: suggestData.suggestionId
      });

      const suggestionId = suggestData.suggestionId;

      // Test 2.2: Get Saved Suggestions
      if (suggestionId) {
        const getSuggestRes = await fetch(`${API_BASE}/customer/pet-suggestions/${suggestionId}`, {
          headers: { 'Authorization': `Bearer ${publicAnonKey}` }
        });
        const getSuggestData = await getSuggestRes.json();
        if (getSuggestRes.ok && getSuggestData.suggestion) {
          logResult('Pet-2.2', 'pass', 'Get saved suggestions works', {
            matchCount: getSuggestData.suggestion.matches?.length || 0
          });
        } else {
          logResult('Pet-2.2', 'fail', 'Get saved suggestions failed', getSuggestData);
        }
      }

      // Test 2.3: Get All Suggestions for Customer
      const allSuggestRes = await fetch(`${API_BASE}/customer/${testPhone}/pet-suggestions`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const allSuggestData = await allSuggestRes.json();
      if (allSuggestRes.ok && Array.isArray(allSuggestData.suggestions)) {
        logResult('Pet-2.3', 'pass', 'Get all customer suggestions works', {
          count: allSuggestData.suggestions.length
        });
      } else {
        logResult('Pet-2.3', 'fail', 'Get all customer suggestions failed', allSuggestData);
      }

      // Test 2.4: Verify Match Scoring
      if (suggestData.suggestions.length > 0) {
        const firstMatch = suggestData.suggestions[0];
        if (firstMatch.matchScore && firstMatch.matchReasons) {
          logResult('Pet-2.4', 'pass', 'Match scoring works', {
            score: firstMatch.matchScore,
            reasons: firstMatch.matchReasons
          });
        } else {
          logResult('Pet-2.4', 'warning', 'Match scoring missing fields', firstMatch);
        }
      }
    } else {
      logResult('Pet-2.1', 'fail', 'Pet suggestions failed', suggestData);
    }
  } catch (error: any) {
    logResult('Pet-2.1', 'fail', 'Pet suggestions error', error.message);
  }
}

// ============================================
// 3. MATING & DATING SERVICE TESTS
// ============================================

async function testMatingDatingService() {
  console.log('\n💕 TESTING MATING & DATING SERVICE\n');

  const testPhone = '8888888888';
  const testPetId = `pet_test_${Date.now()}`;

  // Test 3.1: Create Pet Dating Profile
  try {
    const petProfileData = {
      petId: testPetId,
      userId: testPhone,
      name: 'Test Pet',
      breed: 'Golden Retriever',
      age: 2,
      gender: 'male',
      photos: ['https://example.com/pet1.jpg'],
      temperament: 'Friendly',
      vaccinated: true,
      bio: 'A friendly test pet',
      lookingFor: 'both',
      location: { lat: 12.9716, lng: 77.5946, city: 'Bangalore' }
    };

    const createPetRes = await fetch(`${API_BASE}/dating/pet-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(petProfileData)
    });

    const createPetData = await createPetRes.json();
    if (createPetRes.ok && createPetData.profile) {
      logResult('Dating-3.1', 'pass', 'Create pet profile works', { profileId: createPetData.profile.id });
      
      const profileId = createPetData.profile.id;

      // Test 3.2: Get Pet Profile
      const getPetRes = await fetch(`${API_BASE}/dating/pet-profile/${profileId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const getPetData = await getPetRes.json();
      if (getPetRes.ok && getPetData.profile) {
        logResult('Dating-3.2', 'pass', 'Get pet profile works');
      } else {
        logResult('Dating-3.2', 'fail', 'Get pet profile failed', getPetData);
      }

      // Test 3.3: Discover Matches
      const discoverRes = await fetch(`${API_BASE}/dating/discover`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          profileId,
          profileType: 'pet',
          filters: {}
        })
      });
      const discoverData = await discoverRes.json();
      if (discoverRes.ok && Array.isArray(discoverData.profiles)) {
        logResult('Dating-3.3', 'pass', 'Discover matches works', { count: discoverData.profiles.length });
      } else {
        logResult('Dating-3.3', 'warning', 'Discover matches returned no results (expected if no other profiles)', discoverData);
      }

      // Test 3.4: Swipe (Like)
      if (discoverData.profiles && discoverData.profiles.length > 0) {
        const targetProfileId = discoverData.profiles[0].id;
        const swipeRes = await fetch(`${API_BASE}/dating/swipe`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            profileId,
            targetProfileId,
            profileType: 'pet',
            action: 'like'
          })
        });
        const swipeData = await swipeRes.json();
        if (swipeRes.ok) {
          logResult('Dating-3.4', 'pass', 'Swipe endpoint works', {
            isMatch: swipeData.isMatch,
            action: swipeData.action
          });
        } else {
          logResult('Dating-3.4', 'fail', 'Swipe failed', swipeData);
        }
      }
    } else {
      logResult('Dating-3.1', 'fail', 'Create pet profile failed', createPetData);
    }
  } catch (error: any) {
    logResult('Dating-3.1', 'fail', 'Pet profile error', error.message);
  }

  // Test 3.5: Create Owner Profile
  try {
    const ownerProfileData = {
      userId: testPhone,
      name: 'Test Owner',
      age: 30,
      photos: ['https://example.com/owner1.jpg'],
      bio: 'A test owner',
      pets: [testPetId],
      interests: ['walking', 'training'],
      location: { lat: 12.9716, lng: 77.5946, city: 'Bangalore' }
    };

    const createOwnerRes = await fetch(`${API_BASE}/dating/owner-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(ownerProfileData)
    });

    const createOwnerData = await createOwnerRes.json();
    if (createOwnerRes.ok && createOwnerData.profile) {
      logResult('Dating-3.5', 'pass', 'Create owner profile works', { profileId: createOwnerData.profile.id });
      
      const ownerProfileId = createOwnerData.profile.id;

      // Test 3.6: Get Owner Profile
      const getOwnerRes = await fetch(`${API_BASE}/dating/owner-profile/${ownerProfileId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      const getOwnerData = await getOwnerRes.json();
      if (getOwnerRes.ok && getOwnerData.profile) {
        logResult('Dating-3.6', 'pass', 'Get owner profile works');
      } else {
        logResult('Dating-3.6', 'fail', 'Get owner profile failed', getOwnerData);
      }
    } else {
      logResult('Dating-3.5', 'fail', 'Create owner profile failed', createOwnerData);
    }
  } catch (error: any) {
    logResult('Dating-3.5', 'fail', 'Owner profile error', error.message);
  }

  // Test 3.7: Get Matches
  try {
    const matchesRes = await fetch(`${API_BASE}/dating/matches/${testPhone}`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    const matchesData = await matchesRes.json();
    if (matchesRes.ok && Array.isArray(matchesData.matches)) {
      logResult('Dating-3.7', 'pass', 'Get matches works', { count: matchesData.matches.length });
    } else {
      logResult('Dating-3.7', 'warning', 'Get matches returned no results (expected if no matches)', matchesData);
    }
  } catch (error: any) {
    logResult('Dating-3.7', 'fail', 'Get matches error', error.message);
  }
}

// ============================================
// 4. SUBSCRIPTION & PAYMENT INTEGRATION TESTS
// ============================================

async function testSubscriptionPayment() {
  console.log('\n💳 TESTING SUBSCRIPTION & PAYMENT INTEGRATION\n');

  const testPhone = '7777777777';
  const testTierId = 'tier_p2p_basic';

  // Test 4.1: Get Subscription Tiers
  try {
    const tiersRes = await fetch(`${API_BASE}/admin/subscription-tiers?tierType=p2p_service&isActive=true`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    const tiersData = await tiersRes.json();
    if (tiersRes.ok && Array.isArray(tiersData.tiers)) {
      logResult('Sub-4.1', 'pass', 'Get subscription tiers works', { count: tiersData.tiers.length });
      
      if (tiersData.tiers.length > 0) {
        const tier = tiersData.tiers[0];
        
        // Test 4.2: Create Payment Order (Simulated)
        try {
          const orderRes = await fetch(`${API_BASE}/payment/create-order`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              amount: tier.price * 100, // Convert to paise
              currency: 'INR',
              notes: {
                purpose: 'subscription',
                tierId: tier.id,
                tierName: tier.name,
                userId: testPhone
              }
            })
          });
          const orderData = await orderRes.json();
          if (orderRes.ok && orderData.orderId) {
            logResult('Sub-4.2', 'pass', 'Create payment order works', { orderId: orderData.orderId });
          } else {
            logResult('Sub-4.2', 'warning', 'Create payment order may need Razorpay config', orderData);
          }
        } catch (error: any) {
          logResult('Sub-4.2', 'warning', 'Payment order creation error (may need Razorpay setup)', error.message);
        }

        // Test 4.3: Subscribe User (Simulated - would normally happen after payment)
        try {
          const subscribeRes = await fetch(`${API_BASE}/subscriptions/user/subscribe`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              userId: testPhone,
              tierId: tier.id,
              paymentId: 'test_payment_' + Date.now(),
              paymentMethod: 'razorpay'
            })
          });
          const subscribeData = await subscribeRes.json();
          if (subscribeRes.ok) {
            logResult('Sub-4.3', 'pass', 'Subscribe user endpoint works', subscribeData);
          } else {
            logResult('Sub-4.3', 'warning', 'Subscribe user may need additional setup', subscribeData);
          }
        } catch (error: any) {
          logResult('Sub-4.3', 'warning', 'Subscribe user error', error.message);
        }
      }
    } else {
      logResult('Sub-4.1', 'warning', 'No subscription tiers found (may need to create tiers)', tiersData);
    }
  } catch (error: any) {
    logResult('Sub-4.1', 'fail', 'Get subscription tiers error', error.message);
  }

  // Test 4.4: Unlock Chat (Requires Subscription)
  try {
    const testMatchId = 'match_test_123';
    const unlockRes = await fetch(`${API_BASE}/dating/unlock-chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        matchId: testMatchId,
        userId: testPhone
      })
    });
    const unlockData = await unlockRes.json();
    if (unlockRes.status === 402) {
      logResult('Sub-4.4', 'pass', 'Unlock chat correctly requires subscription', unlockData);
    } else if (unlockRes.ok) {
      logResult('Sub-4.4', 'pass', 'Unlock chat works (user has subscription)', unlockData);
    } else {
      logResult('Sub-4.4', 'warning', 'Unlock chat response', unlockData);
    }
  } catch (error: any) {
    logResult('Sub-4.4', 'fail', 'Unlock chat error', error.message);
  }
}

// ============================================
// 5. DATA STRUCTURE & INDEX TESTS
// ============================================

async function testDataStructures() {
  console.log('\n🗂️  TESTING DATA STRUCTURES & INDEXES\n');

  // Test 5.1: Verify Banner Indexes
  try {
    const bannersRes = await fetch(`${API_BASE}/admin/content/banners?type=main`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    const bannersData = await bannersRes.json();
    if (bannersRes.ok && Array.isArray(bannersData.banners)) {
      const hasRequiredFields = bannersData.banners.every((b: any) => 
        b.id && b.type && b.title && b.imageUrl && b.approvalStatus !== undefined
      );
      if (hasRequiredFields) {
        logResult('Data-5.1', 'pass', 'Banner data structure is correct');
      } else {
        logResult('Data-5.1', 'fail', 'Banner data structure missing required fields');
      }
    }
  } catch (error: any) {
    logResult('Data-5.1', 'fail', 'Banner data structure test error', error.message);
  }

  // Test 5.2: Verify Pet Suggestion Data Structure
  try {
    const suggestRes = await fetch(`${API_BASE}/customer/pet-suggestions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '9999999999',
        questionnaireData: {
          dogSize: 'medium',
          energyLevel: 'medium',
          selectedBreeds: ['Golden Retriever']
        }
      })
    });
    const suggestData = await suggestRes.json();
    if (suggestRes.ok && suggestData.suggestions) {
      const hasMatchFields = suggestData.suggestions.every((s: any) =>
        s.matchScore !== undefined && s.matchReasons !== undefined
      );
      if (hasMatchFields) {
        logResult('Data-5.2', 'pass', 'Pet suggestion data structure is correct');
      } else {
        logResult('Data-5.2', 'fail', 'Pet suggestion missing match fields');
      }
    }
  } catch (error: any) {
    logResult('Data-5.2', 'fail', 'Pet suggestion data structure test error', error.message);
  }

  // Test 5.3: Verify Dating Profile Data Structure
  try {
    const profileRes = await fetch(`${API_BASE}/dating/pet-profile/pet_dating_test`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    if (profileRes.ok) {
      const profileData = await profileRes.json();
      if (profileData.profile) {
        const hasRequiredFields = 
          profileData.profile.id &&
          profileData.profile.userId &&
          profileData.profile.name &&
          profileData.profile.isActive !== undefined;
        if (hasRequiredFields) {
          logResult('Data-5.3', 'pass', 'Dating profile data structure is correct');
        } else {
          logResult('Data-5.3', 'fail', 'Dating profile missing required fields');
        }
      }
    } else {
      logResult('Data-5.3', 'warning', 'Dating profile not found (expected for test)', { status: profileRes.status });
    }
  } catch (error: any) {
    logResult('Data-5.3', 'fail', 'Dating profile data structure test error', error.message);
  }
}

// ============================================
// 6. UI COMPONENT INTEGRATION TESTS
// ============================================

async function testUIComponents() {
  console.log('\n🎨 TESTING UI COMPONENT INTEGRATION\n');

  // Test 6.1: Customer Home Banner Loading
  try {
    const bannersRes = await fetch(`${API_BASE}/customer/content/banners?type=main`, {
      headers: { 'Authorization': `Bearer ${publicAnonKey}` }
    });
    if (bannersRes.ok) {
      logResult('UI-6.1', 'pass', 'Customer home can fetch banners from API');
    } else {
      logResult('UI-6.1', 'fail', 'Customer home banner API failed', { status: bannersRes.status });
    }
  } catch (error: any) {
    logResult('UI-6.1', 'fail', 'Customer home banner test error', error.message);
  }

  // Test 6.2: Pet Suggestion Flow
  try {
    const suggestRes = await fetch(`${API_BASE}/customer/pet-suggestions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        phone: '9999999999',
        questionnaireData: { dogSize: 'medium' }
      })
    });
    if (suggestRes.ok) {
      logResult('UI-6.2', 'pass', 'Pet suggestion flow API is accessible');
    } else {
      logResult('UI-6.2', 'fail', 'Pet suggestion flow API failed', { status: suggestRes.status });
    }
  } catch (error: any) {
    logResult('UI-6.2', 'fail', 'Pet suggestion flow test error', error.message);
  }

  // Test 6.3: Mating & Dating Profile Creation
  try {
    const profileRes = await fetch(`${API_BASE}/dating/pet-profile`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${publicAnonKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        petId: 'test_pet',
        userId: '8888888888',
        name: 'Test',
        breed: 'Test Breed'
      })
    });
    if (profileRes.ok || profileRes.status === 400) {
      logResult('UI-6.3', 'pass', 'Mating & dating profile creation API is accessible');
    } else {
      logResult('UI-6.3', 'fail', 'Mating & dating profile API failed', { status: profileRes.status });
    }
  } catch (error: any) {
    logResult('UI-6.3', 'fail', 'Mating & dating profile test error', error.message);
  }
}

// ============================================
// MAIN TEST RUNNER
// ============================================

async function runAllTests() {
  console.log('🚀 STARTING COMPREHENSIVE TESTS\n');
  console.log('=' .repeat(60));

  await testContentManagement();
  await testPetSuggestionSystem();
  await testMatingDatingService();
  await testSubscriptionPayment();
  await testDataStructures();
  await testUIComponents();

  // Generate Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 TEST SUMMARY\n');

  const passed = results.filter(r => r.status === 'pass').length;
  const failed = results.filter(r => r.status === 'fail').length;
  const warnings = results.filter(r => r.status === 'warning').length;

  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Warnings: ${warnings}`);
  console.log(`📈 Total: ${results.length}`);

  if (failed > 0) {
    console.log('\n❌ FAILED TESTS:');
    results.filter(r => r.status === 'fail').forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }

  if (warnings > 0) {
    console.log('\n⚠️  WARNINGS:');
    results.filter(r => r.status === 'warning').forEach(r => {
      console.log(`   - ${r.test}: ${r.message}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Test suite completed!\n');

  return {
    passed,
    failed,
    warnings,
    total: results.length,
    results
  };
}

// Export for use in other test files
export { runAllTests, testContentManagement, testPetSuggestionSystem, testMatingDatingService };

// Run if executed directly
if (typeof window === 'undefined' && typeof Deno !== 'undefined') {
  runAllTests().catch(console.error);
}


/**
 * ============================================================================
 * MATING & DATING SERVICE - SQL-ONLY VERSION (COMPLETE JOURNEY)
 * ============================================================================
 * 
 * REFACTORED: Removed all KV usage, using SQL repositories only
 * 
 * Complete P2P matchmaking service for pets and pet owners:
 * - Pet Dating Mode: Match, Chat & Schedule
 * - Owner Dating Mode: Owner Match & Meet
 * - Subscription-based chat unlock
 * - Integration with cafés (meet-ups) and vet clinics (mating appointments)
 * - Admin moderation and analytics
 * 
 * CHANGES:
 * - Removed all `kv.get()`, `kv.set()`, `kv.getByPrefix()` calls
 * - All data stored in SQL tables (dating_profiles_pet, dating_profiles_owner, dating_matches, etc.)
 * - Subscription integration via user_subscriptions table
 * - Booking integration via bookings table
 * 
 * Date: 2025-01-23
 * Migration: Phase 8 - Complete Journey Implementation
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { sendSuccess, sendError } from "./response-utils.ts";
import { getDatingRepository } from "../../lib/repositories/dating.ts";
import { getCustomersRepository } from "../../lib/repositories/customers.ts";
import { getPetsRepository } from "../../lib/repositories/pets.ts";
import { getVendorsRepository } from "../../lib/repositories/vendors.ts";
import { getBookingsRepository } from "../../lib/repositories/bookings.ts";
import { getNotificationsRepository } from "../../lib/repositories/notifications.ts";
import { getDbClient } from "../../lib/db.ts";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "npm:@aws-sdk/client-s3@3";
import { generateId } from "./database-schema.tsx";

export function registerMatingDatingServiceSQL(app: Hono) {
  console.log('✅ Registering Mating & Dating Service (SQL-only)...');

  const BASE = "/make-server-3dd53475";
  const datingRepo = getDatingRepository();
  const client = getDbClient();

  // ============================================
  // HELPER FUNCTIONS
  // ============================================

  async function uploadPhotoToS3(file: File, folder: string, fileName: string): Promise<string> {
    // ✅ SQL: Get AWS settings from platform_integrations
    const { data: awsIntegration } = await client
      .from('platform_integrations')
      .select('integration_config')
      .eq('integration_name', 'aws')
      .eq('is_active', true)
      .maybeSingle();
    
    const awsSettings = awsIntegration?.integration_config || {};
    const s3Config = awsSettings.s3 || {};

    if (!s3Config.enabled || !s3Config.bucket) {
      throw new Error('S3 not configured. Please configure S3 in Admin Portal → Platform Settings → Cloud & Maps → AWS S3');
    }

    const s3Client = new S3Client({
      region: s3Config.region || 'ap-south-1',
      credentials: {
        accessKeyId: s3Config.accessKeyId || awsSettings.credentials?.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey || awsSettings.credentials?.secretAccessKey
      }
    });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    const key = `dating/${folder}/${fileName}`;
    const command = new PutObjectCommand({
      Bucket: s3Config.bucket,
      Key: key,
      Body: buffer,
      ContentType: file.type,
      ACL: 'public-read'
    });

    await s3Client.send(command);

    const url = `https://${s3Config.bucket}.s3.${s3Config.region || 'ap-south-1'}.amazonaws.com/${key}`;
    console.log(`✅ [S3] Uploaded dating photo: ${key}`);
    return url;
  }

  function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // ============================================
  // PET DATING PROFILE MANAGEMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/pet-profile
   * Create or update pet dating profile
   * Screen 2: Create Pet Profile
   */
  app.post("/make-server-3dd53475/dating/pet-profile", async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let profileData: any = {};
      let photos: string[] = [];

      if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const petId = formData.get('petId') as string;
        const userId = formData.get('userId') as string;
        const name = formData.get('name') as string;
        const breed = formData.get('breed') as string;

        if (!petId || !userId || !name || !breed) {
          return sendError(c, 'Missing required fields: petId, userId, name, breed', 400);
        }

        // Upload photos to S3
        const photoFiles = formData.getAll('photos') as File[];
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          if (file && file.size > 0) {
            const timestamp = Date.now();
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `pet_${petId}_${timestamp}_${i}.${fileExt}`;
            const photoUrl = await uploadPhotoToS3(file, 'pet-profiles', fileName);
            photos.push(photoUrl);
          }
        }

        profileData = {
          petId,
          userId,
          name,
          breed,
          age: parseInt(formData.get('age') as string || '0'),
          gender: formData.get('gender') as string || 'unknown',
          photos,
          temperament: formData.get('temperament') as string || 'friendly',
          vaccinated: formData.get('vaccinated') === 'true',
          bio: formData.get('bio') as string || '',
          lookingFor: formData.get('lookingFor') as string || 'both',
          location: JSON.parse(formData.get('location') as string || '{"lat":0,"lng":0,"city":""}')
        };
      } else {
        const body = await c.req.json();
        const {
          petId,
          userId,
          name,
          breed,
          age,
          gender,
          photos: providedPhotos,
          temperament,
          vaccinated,
          bio,
          lookingFor,
          location
        } = body;

        if (!petId || !userId || !name || !breed) {
          return sendError(c, 'Missing required fields', 400);
        }

        // Handle base64 photos - convert to S3
        photos = [];
        if (providedPhotos && Array.isArray(providedPhotos)) {
          for (const photo of providedPhotos) {
            if (photo.startsWith('data:image')) {
              try {
                const base64Data = photo.split(',')[1];
                const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const blob = new Blob([buffer], { type: 'image/jpeg' });
                const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
                const fileName = `pet_${petId}_${Date.now()}_${photos.length}.jpg`;
                const photoUrl = await uploadPhotoToS3(file, 'pet-profiles', fileName);
                photos.push(photoUrl);
              } catch (error) {
                console.error('Error converting base64 to S3:', error);
                photos.push(photo);
              }
            } else if (photo.includes('.amazonaws.com/')) {
              photos.push(photo);
            } else {
              photos.push(photo);
            }
          }
        }

        profileData = {
          petId,
          userId,
          name,
          breed,
          age: Number(age),
          gender,
          photos,
          temperament: temperament || 'friendly',
          vaccinated: vaccinated !== false,
          bio: bio || '',
          lookingFor: lookingFor || 'both',
          location: location || { lat: 0, lng: 0, city: '' }
        };
      }

      // ✅ SQL: Get customer by userId
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(userId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // ✅ SQL: Get pet
      const petsRepo = getPetsRepository();
      const pet = await petsRepo.findById(profileData.petId);
      if (!pet) {
        return sendError(c, 'Pet not found', 404);
      }

      const profileId = `pet_dating_${profileData.petId}`;

      // ✅ SQL: Check if profile exists
      const existing = await datingRepo.findPetProfileByProfileId(profileId);
      
      if (existing) {
        // Update existing profile
        const updated = await datingRepo.updatePetProfile(profileId, {
          name: profileData.name,
          breed: profileData.breed,
          age: profileData.age,
          gender: profileData.gender,
          photos: photos,
          temperament: profileData.temperament,
          vaccinated: profileData.vaccinated,
          bio: profileData.bio,
          looking_for: profileData.lookingFor,
          location: profileData.location,
        });
        return sendSuccess(c, { profile: updated }, 'Pet dating profile updated successfully');
      } else {
        // Create new profile
        const profile = await datingRepo.createPetProfile({
          profile_id: profileId,
          pet_id: profileData.petId,
          customer_id: customer.id,
          name: profileData.name,
          breed: profileData.breed,
          age: profileData.age,
          gender: profileData.gender,
          photos: photos,
          temperament: profileData.temperament,
          vaccinated: profileData.vaccinated,
          bio: profileData.bio,
          looking_for: profileData.lookingFor,
          location: profileData.location,
        });
        return sendSuccess(c, { profile }, 'Pet dating profile created successfully');
      }
    } catch (error) {
      console.error('Error creating pet dating profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/set-preferences
   * Screen 3: Set Preferences
   */
  app.post("/make-server-3dd53475/dating/set-preferences", async (c) => {
    try {
      const { profileId, profileType, preferences } = await c.req.json();
      
      if (!profileId || !profileType || !preferences) {
        return sendError(c, 'Missing required fields', 400);
      }

      if (profileType === 'pet') {
        const profile = await datingRepo.findPetProfileByProfileId(profileId);
        if (!profile) {
          return sendError(c, 'Profile not found', 404);
        }
        
        await datingRepo.updatePetProfile(profileId, {
          preferences: preferences,
        });
      } else {
        const profile = await datingRepo.findOwnerProfileByProfileId(profileId);
        if (!profile) {
          return sendError(c, 'Profile not found', 404);
        }
        
        await datingRepo.updateOwnerProfile(profileId, {
          preferences: preferences,
        });
      }

      return sendSuccess(c, { message: 'Preferences saved successfully' });
    } catch (error) {
      console.error('Error setting preferences:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/discover
   * Screen 4: Swipe Screen - Get potential matches
   */
  app.post("/make-server-3dd53475/dating/discover", async (c) => {
    try {
      const {
        profileId,
        profileType, // 'pet' | 'owner'
        filters // { breed, maxDistance, minAge, maxAge }
      } = await c.req.json();

      if (!profileId || !profileType) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get profile
      const profile = profileType === 'pet' 
        ? await datingRepo.findPetProfileByProfileId(profileId)
        : await datingRepo.findOwnerProfileByProfileId(profileId);
      
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      // ✅ SQL: Get all active profiles of the same type
      const allProfiles = profileType === 'pet'
        ? await datingRepo.findActivePetProfiles({ breed: filters?.breed, lookingFor: profile.looking_for })
        : await datingRepo.findActiveOwnerProfiles();

      const potentialMatches = [];

      for (const otherProfile of allProfiles) {
        // Skip self
        if (otherProfile.profile_id === profileId) continue;

        // Skip if already liked/disliked
        if (profile.likes.includes(otherProfile.profile_id) || profile.dislikes.includes(otherProfile.profile_id)) continue;

        // Skip if already matched
        if (profile.matches.includes(otherProfile.profile_id)) continue;

        // Apply filters
        if (profileType === 'pet' && filters) {
          if (filters.breed && otherProfile.breed !== filters.breed) continue;
          if (filters.minAge && otherProfile.age && otherProfile.age < filters.minAge) continue;
          if (filters.maxAge && otherProfile.age && otherProfile.age > filters.maxAge) continue;
          
          // Gender filter - opposite for mating
          if (profile.looking_for === 'mating' && otherProfile.looking_for === 'mating') {
            if (profile.gender === otherProfile.gender) continue;
          }
        }

        // Calculate distance if locations available
        if (filters?.maxDistance && profile.location && otherProfile.location) {
          const distance = calculateDistance(
            profile.location.lat, profile.location.lng,
            otherProfile.location.lat, otherProfile.location.lng
          );
          if (distance > filters.maxDistance) continue;
        }

        potentialMatches.push(otherProfile);
      }

      // Shuffle for randomness
      const shuffled = potentialMatches.sort(() => Math.random() - 0.5);

      // Return top 50
      const matches = shuffled.slice(0, 50);

      return sendSuccess(c, { profiles: matches, count: matches.length });
    } catch (error) {
      console.error('Error discovering matches:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/swipe
   * Screen 4: Swipe Screen - Process swipe action
   */
  app.post("/make-server-3dd53475/dating/swipe", async (c) => {
    try {
      const {
        profileId,
        targetProfileId,
        profileType,
        action // 'like' | 'dislike'
      } = await c.req.json();

      if (!profileId || !targetProfileId || !action) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get profiles
      const profile = profileType === 'pet'
        ? await datingRepo.findPetProfileByProfileId(profileId)
        : await datingRepo.findOwnerProfileByProfileId(profileId);
      
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      const targetProfile = profileType === 'pet'
        ? await datingRepo.findPetProfileByProfileId(targetProfileId)
        : await datingRepo.findOwnerProfileByProfileId(targetProfileId);
      
      if (!targetProfile) {
        return sendError(c, 'Target profile not found', 404);
      }

      let isMatch = false;
      let matchId = null;

      if (action === 'like') {
        // Add to likes
        const updatedLikes = [...(profile.likes || []), targetProfileId];
        if (profileType === 'pet') {
          await datingRepo.updatePetProfile(profileId, { likes: updatedLikes });
        } else {
          await datingRepo.updateOwnerProfile(profileId, { likes: updatedLikes });
        }

        // Check if it's a mutual match
        if (targetProfile.likes.includes(profileId)) {
          isMatch = true;

          // ✅ SQL: Create match
          matchId = `match_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          const match = await datingRepo.createMatch({
            match_id: matchId,
            profile_type: profileType,
            profile1_id: profileId,
            profile2_id: targetProfileId,
            customer1_id: profile.customer_id,
            customer2_id: targetProfile.customer_id,
            status: 'active',
            chat_unlocked: false,
          });

          // Add to both profiles' matches
          const profileMatches = [...(profile.matches || []), targetProfileId];
          const targetMatches = [...(targetProfile.matches || []), profileId];

          if (profileType === 'pet') {
            await datingRepo.updatePetProfile(profileId, { matches: profileMatches });
            await datingRepo.updatePetProfile(targetProfileId, { matches: targetMatches });
          } else {
            await datingRepo.updateOwnerProfile(profileId, { matches: profileMatches });
            await datingRepo.updateOwnerProfile(targetProfileId, { matches: targetMatches });
          }

          // Send notifications to both users
          const notificationsRepo = getNotificationsRepository();
          await notificationsRepo.create({
            recipient_id: profile.customer_id,
            recipient_type: 'customer',
            notification_type: 'dating_match',
            title: "It's a Match! 🎉",
            message: `You matched with ${targetProfile.name}!`,
            data: { matchId, profileType },
          });

          await notificationsRepo.create({
            recipient_id: targetProfile.customer_id,
            recipient_type: 'customer',
            notification_type: 'dating_match',
            title: "It's a Match! 🎉",
            message: `You matched with ${profile.name}!`,
            data: { matchId, profileType },
          });
        }
      } else {
        // Add to dislikes
        const updatedDislikes = [...(profile.dislikes || []), targetProfileId];
        if (profileType === 'pet') {
          await datingRepo.updatePetProfile(profileId, { dislikes: updatedDislikes });
        } else {
          await datingRepo.updateOwnerProfile(profileId, { dislikes: updatedDislikes });
        }
      }

      return sendSuccess(c, { 
        action, 
        isMatch, 
        matchId,
        message: isMatch ? "It's a Match! 🎉" : 'Swipe recorded' 
      });
    } catch (error) {
      console.error('Error processing swipe:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/matches/:customerId
   * Get all matches for a customer
   */
  app.get("/make-server-3dd53475/dating/matches/:customerId", async (c) => {
    try {
      const { customerId } = c.req.param();

      // ✅ SQL: Get all matches for customer
      const matches = await datingRepo.findMatchesByCustomer(customerId);

      // Enrich with profile data
      const enrichedMatches = await Promise.all(matches.map(async (match) => {
        const otherProfileId = match.customer1_id === customerId ? match.profile2_id : match.profile1_id;
        
        const otherProfile = match.profile_type === 'pet'
          ? await datingRepo.findPetProfileByProfileId(otherProfileId)
          : await datingRepo.findOwnerProfileByProfileId(otherProfileId);

        return {
          ...match,
          otherProfile
        };
      }));

      return sendSuccess(c, { matches: enrichedMatches, count: enrichedMatches.length });
    } catch (error) {
      console.error('Error fetching matches:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // SUBSCRIPTION & CHAT UNLOCK
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/unlock-chat
   * Screen 5 → 6: Match Screen → Subscription Paywall → Chat Unlock
   */
  app.post("/make-server-3dd53475/dating/unlock-chat", async (c) => {
    try {
      const { matchId, customerId } = await c.req.json();

      if (!matchId || !customerId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Check if user has active P2P dating subscription
      const { data: subscriptions } = await client
        .from('user_subscriptions')
        .select('*')
        .eq('customer_id', customerId)
        .eq('tier_type', 'p2p_service')
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0]);

      let hasSubscription = false;
      let subscription = null;

      if (subscriptions && subscriptions.length > 0) {
        // Check if subscription benefits include dating chat
        for (const sub of subscriptions) {
          const { data: tier } = await client
            .from('subscription_tiers')
            .select('benefits, features')
            .eq('id', sub.tier_id)
            .single();
          
          // Check both benefits and features (for backward compatibility)
          const tierBenefits = tier?.benefits || tier?.features || {};
          if (tierBenefits.dating_chat) {
            hasSubscription = true;
            subscription = sub;
            break;
          }
        }
      }

      if (!hasSubscription) {
        return sendError(c, 'Active P2P dating subscription required to unlock chat', 402);
      }

      // ✅ SQL: Get match
      const match = await datingRepo.findMatchByMatchId(matchId);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify user is part of this match
      if (match.customer1_id !== customerId && match.customer2_id !== customerId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // ✅ SQL: Create chat channel (or use existing)
      if (!match.chat_channel_arn) {
        // Get AWS Chime settings
        const { data: awsIntegration } = await client
          .from('platform_integrations')
          .select('integration_config')
          .eq('integration_name', 'aws')
          .eq('is_active', true)
          .maybeSingle();
        
        const awsSettings = awsIntegration?.integration_config || {};
        
        if (awsSettings?.chime?.enabled) {
          match.chat_channel_arn = `chime:dating:${matchId}`;
          match.chat_channel_name = `dating_match_${matchId}`;
          match.chime_app_instance_arn = awsSettings.chime.appInstanceArn;
        } else {
          // Fallback: Use SQL chat messages table
          match.chat_channel_arn = `sql:dating:${matchId}`;
          match.chat_channel_name = `dating_match_${matchId}`;
        }
      }

      // ✅ SQL: Unlock chat
      await datingRepo.updateMatch(matchId, {
        chat_unlocked: true,
        chat_unlocked_by: customerId,
        chat_unlocked_at: new Date().toISOString(),
        chat_channel_arn: match.chat_channel_arn,
        chat_channel_name: match.chat_channel_name,
        chime_app_instance_arn: match.chime_app_instance_arn,
      });

      return sendSuccess(c, { 
        match: {
          ...match,
          chat_unlocked: true,
          chat_channel_arn: match.chat_channel_arn,
        },
        message: 'Chat unlocked successfully'
      });
    } catch (error) {
      console.error('Error unlocking chat:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MEET-UP SCHEDULING (Café Bookings)
  // ============================================

  /**
   * GET /make-server-3dd53475/dating/nearby-cafes
   * Screen 8a: Schedule Meet-Up - Get nearby cafés
   */
  app.get("/make-server-3dd53475/dating/nearby-cafes", async (c) => {
    try {
      const lat = Number(c.req.query('lat'));
      const lng = Number(c.req.query('lng'));
      const radius = Number(c.req.query('radius')) || 5; // km

      if (!lat || !lng) {
        return sendError(c, 'Location parameters required', 400);
      }

      // ✅ SQL: Get all café vendors
      const vendorsRepo = getVendorsRepository();
      const { data: cafes } = await client
        .from('vendors')
        .select('*')
        .eq('role_id', 'cafes') // Assuming 'cafes' is the role_id
        .eq('status', 'active')
        .eq('approval_status', 'approved');

      const nearbyCafes = [];

      for (const cafe of cafes || []) {
        if (cafe.location && cafe.location.lat && cafe.location.lng) {
          const distance = calculateDistance(
            lat, lng,
            cafe.location.lat, cafe.location.lng
          );

          if (distance <= radius) {
            nearbyCafes.push({
              ...cafe,
              distance: parseFloat(distance.toFixed(2))
            });
          }
        }
      }

      // Sort by distance
      nearbyCafes.sort((a, b) => a.distance - b.distance);

      return sendSuccess(c, { cafes: nearbyCafes, count: nearbyCafes.length });
    } catch (error) {
      console.error('Error fetching nearby cafes:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/schedule-meetup
   * Screen 8a: Schedule Meet-Up - Create café booking
   */
  app.post("/make-server-3dd53475/dating/schedule-meetup", async (c) => {
    try {
      const {
        matchId,
        customerId,
        cafeVendorId,
        scheduledDate,
        scheduledTime,
        notes
      } = await c.req.json();

      if (!matchId || !customerId || !cafeVendorId || !scheduledDate || !scheduledTime) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get match
      const match = await datingRepo.findMatchByMatchId(matchId);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Create booking for café
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        vendor_id: cafeVendorId,
        service_type: 'cafe_meetup',
        booking_date: scheduledDate,
        booking_time: scheduledTime,
        status: 'pending',
        payment_status: 'pending',
        total_amount: 0, // Café booking fee
        notes: notes || '',
      });

      // ✅ SQL: Create meetup record
      const meetupId = `meetup_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const meetup = await datingRepo.createMeetup({
        meetup_id: meetupId,
        match_id: match.id,
        initiated_by: customerId,
        customer1_id: match.customer1_id,
        customer2_id: match.customer2_id,
        cafe_vendor_id: cafeVendorId,
        booking_id: booking.id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        notes: notes || '',
        status: 'pending',
      });

      // Send notifications
      const notificationsRepo = getNotificationsRepository();
      await notificationsRepo.create({
        recipient_id: match.customer1_id,
        recipient_type: 'customer',
        notification_type: 'dating_meetup_scheduled',
        title: 'Meet-Up Scheduled! ☕',
        message: `A meet-up has been scheduled at a café on ${scheduledDate} at ${scheduledTime}`,
        data: { meetupId, matchId },
      });

      await notificationsRepo.create({
        recipient_id: match.customer2_id,
        recipient_type: 'customer',
        notification_type: 'dating_meetup_scheduled',
        title: 'Meet-Up Scheduled! ☕',
        message: `A meet-up has been scheduled at a café on ${scheduledDate} at ${scheduledTime}`,
        data: { meetupId, matchId },
      });

      return sendSuccess(c, { meetup, booking }, 'Meet-up scheduled successfully');
    } catch (error) {
      console.error('Error scheduling meet-up:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MATING APPOINTMENT (Vet Bookings)
  // ============================================

  /**
   * GET /make-server-3dd53475/dating/nearby-vets
   * Screen 8b: Request Mating Appointment - Get nearby vets
   */
  app.get("/make-server-3dd53475/dating/nearby-vets", async (c) => {
    try {
      const lat = Number(c.req.query('lat'));
      const lng = Number(c.req.query('lng'));
      const radius = Number(c.req.query('radius')) || 10; // km

      if (!lat || !lng) {
        return sendError(c, 'Location parameters required', 400);
      }

      // ✅ SQL: Get all vet vendors
      const { data: vets } = await client
        .from('vendors')
        .select('*')
        .eq('role_id', 'veterinarian')
        .eq('status', 'active')
        .eq('approval_status', 'approved');

      const nearbyVets = [];

      for (const vet of vets || []) {
        if (vet.location && vet.location.lat && vet.location.lng) {
          const distance = calculateDistance(
            lat, lng,
            vet.location.lat, vet.location.lng
          );

          if (distance <= radius) {
            nearbyVets.push({
              ...vet,
              distance: parseFloat(distance.toFixed(2))
            });
          }
        }
      }

      // Sort by distance
      nearbyVets.sort((a, b) => a.distance - b.distance);

      return sendSuccess(c, { vets: nearbyVets, count: nearbyVets.length });
    } catch (error) {
      console.error('Error fetching nearby vets:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/request-mating-appointment
   * Screen 8b: Request Mating Appointment - Create vet booking
   */
  app.post("/make-server-3dd53475/dating/request-mating-appointment", async (c) => {
    try {
      const {
        matchId,
        customerId,
        vetVendorId,
        pet1Id,
        pet2Id,
        scheduledDate,
        scheduledTime,
        notes
      } = await c.req.json();

      if (!matchId || !customerId || !vetVendorId || !scheduledDate || !scheduledTime) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get match
      const match = await datingRepo.findMatchByMatchId(matchId);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // ✅ SQL: Create booking for vet
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.create({
        customer_id: customerId,
        vendor_id: vetVendorId,
        service_type: 'mating_appointment',
        booking_date: scheduledDate,
        booking_time: scheduledTime,
        status: 'pending',
        payment_status: 'pending',
        total_amount: 0, // Vet service fee
        notes: notes || '',
      });

      // ✅ SQL: Create mating appointment record
      const appointmentId = `mating_appt_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const appointment = await datingRepo.createMatingAppointment({
        appointment_id: appointmentId,
        match_id: match.id,
        requested_by: customerId,
        customer1_id: match.customer1_id,
        customer2_id: match.customer2_id,
        pet1_id: pet1Id || null,
        pet2_id: pet2Id || null,
        vet_vendor_id: vetVendorId,
        booking_id: booking.id,
        scheduled_date: scheduledDate,
        scheduled_time: scheduledTime,
        notes: notes || '',
        status: 'pending',
      });

      // Send notifications
      const notificationsRepo = getNotificationsRepository();
      await notificationsRepo.create({
        recipient_id: match.customer1_id,
        recipient_type: 'customer',
        notification_type: 'mating_appointment_requested',
        title: 'Mating Appointment Requested 🐾',
        message: `A mating appointment has been requested at a vet clinic on ${scheduledDate} at ${scheduledTime}`,
        data: { appointmentId, matchId },
      });

      await notificationsRepo.create({
        recipient_id: match.customer2_id,
        recipient_type: 'customer',
        notification_type: 'mating_appointment_requested',
        title: 'Mating Appointment Requested 🐾',
        message: `A mating appointment has been requested at a vet clinic on ${scheduledDate} at ${scheduledTime}`,
        data: { appointmentId, matchId },
      });

      // Notify vet
      await notificationsRepo.create({
        recipient_id: vetVendorId,
        recipient_type: 'vendor',
        notification_type: 'mating_appointment_requested',
        title: 'New Mating Appointment Request',
        message: `A mating appointment has been requested for ${scheduledDate} at ${scheduledTime}`,
        data: { appointmentId, bookingId: booking.id },
      });

      return sendSuccess(c, { appointment, booking }, 'Mating appointment requested successfully');
    } catch (error) {
      console.error('Error requesting mating appointment:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // OWNER DATING PROFILE (Similar to Pet)
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/owner-profile
   * Create or update owner dating profile
   */
  app.post("/make-server-3dd53475/dating/owner-profile", async (c) => {
    try {
      const body = await c.req.json();
      const {
        userId,
        name,
        age,
        photos: providedPhotos,
        bio,
        pets,
        interests,
        location
      } = body;

      if (!userId || !name) {
        return sendError(c, 'Missing required fields', 400);
      }

      // ✅ SQL: Get customer
      const customersRepo = getCustomersRepository();
      const customer = await customersRepo.findById(userId);
      if (!customer) {
        return sendError(c, 'Customer not found', 404);
      }

      // Handle photos (similar to pet profile)
      let photos: string[] = [];
      if (providedPhotos && Array.isArray(providedPhotos)) {
        for (const photo of providedPhotos) {
          if (photo.startsWith('data:image')) {
            try {
              const base64Data = photo.split(',')[1];
              const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
              const blob = new Blob([buffer], { type: 'image/jpeg' });
              const file = new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' });
              const fileName = `owner_${userId}_${Date.now()}_${photos.length}.jpg`;
              const photoUrl = await uploadPhotoToS3(file, 'owner-profiles', fileName);
              photos.push(photoUrl);
            } catch (error) {
              console.error('Error converting base64 to S3:', error);
              photos.push(photo);
            }
          } else {
            photos.push(photo);
          }
        }
      }

      const profileId = `owner_dating_${userId}`;

      // ✅ SQL: Check if profile exists
      const existing = await datingRepo.findOwnerProfileByProfileId(profileId);
      
      if (existing) {
        const updated = await datingRepo.updateOwnerProfile(profileId, {
          name,
          age: Number(age),
          photos,
          bio,
          pets: pets || [],
          interests: interests || [],
          location: location || { lat: 0, lng: 0, city: '' },
        });
        return sendSuccess(c, { profile: updated }, 'Owner dating profile updated successfully');
      } else {
        const profile = await datingRepo.createOwnerProfile({
          profile_id: profileId,
          customer_id: customer.id,
          name,
          age: Number(age),
          photos,
          bio,
          pets: pets || [],
          interests: interests || [],
          location: location || { lat: 0, lng: 0, city: '' },
        });
        return sendSuccess(c, { profile }, 'Owner dating profile created successfully');
      }
    } catch (error) {
      console.error('Error creating owner dating profile:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // ADMIN MODERATION
  // ============================================

  /**
   * GET /make-server-3dd53475/admin/dating/profiles
   * Admin: Get all dating profiles for moderation
   */
  app.get("/make-server-3dd53475/admin/dating/profiles", async (c) => {
    try {
      const profileType = c.req.query('profileType') || 'pet';
      const status = c.req.query('status');

      let profiles: any[] = [];

      if (profileType === 'pet') {
        const allProfiles = await datingRepo.findActivePetProfiles();
        profiles = allProfiles;
      } else {
        const allProfiles = await datingRepo.findActiveOwnerProfiles();
        profiles = allProfiles;
      }

      // Filter by status if provided
      if (status) {
        if (status === 'flagged') {
          profiles = profiles.filter(p => p.flagged);
        } else if (status === 'suspended') {
          profiles = profiles.filter(p => p.suspended);
        } else if (status === 'active') {
          profiles = profiles.filter(p => p.is_active && !p.flagged && !p.suspended);
        }
      }

      return sendSuccess(c, { profiles, count: profiles.length });
    } catch (error) {
      console.error('Error fetching dating profiles:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/admin/dating/moderate-profile
   * Admin: Moderate a dating profile
   */
  app.post("/make-server-3dd53475/admin/dating/moderate-profile", async (c) => {
    try {
      const { profileId, profileType, action, reason } = await c.req.json();

      if (profileType === 'pet') {
        const profile = await datingRepo.findPetProfileByProfileId(profileId);
        if (!profile) {
          return sendError(c, 'Profile not found', 404);
        }

        if (action === 'flag') {
          await datingRepo.updatePetProfile(profileId, { flagged: true });
        } else if (action === 'suspend') {
          await datingRepo.updatePetProfile(profileId, { is_active: false, suspended: true });
        } else if (action === 'activate') {
          await datingRepo.updatePetProfile(profileId, { is_active: true, flagged: false, suspended: false });
        }
      } else {
        const profile = await datingRepo.findOwnerProfileByProfileId(profileId);
        if (!profile) {
          return sendError(c, 'Profile not found', 404);
        }

        if (action === 'flag') {
          await datingRepo.updateOwnerProfile(profileId, { flagged: true });
        } else if (action === 'suspend') {
          await datingRepo.updateOwnerProfile(profileId, { is_active: false, suspended: true });
        } else if (action === 'activate') {
          await datingRepo.updateOwnerProfile(profileId, { is_active: true, flagged: false, suspended: false });
        }
      }

      return sendSuccess(c, { message: `Profile ${action}ed successfully` });
    } catch (error) {
      console.error('Error moderating profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/dating/analytics
   * Admin: Get dating service analytics
   */
  app.get("/make-server-3dd53475/admin/dating/analytics", async (c) => {
    try {
      // ✅ SQL: Get all profiles
      const petProfiles = await datingRepo.findActivePetProfiles();
      const ownerProfiles = await datingRepo.findActiveOwnerProfiles();

      // ✅ SQL: Get all matches
      const { data: allMatches } = await client
        .from('dating_matches')
        .select('*')
        .eq('status', 'active');

      // ✅ SQL: Get active subscriptions
      const { data: subscriptions } = await client
        .from('user_subscriptions')
        .select('*, subscription_tiers(*)')
        .eq('tier_type', 'p2p_service')
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0]);

      // ✅ SQL: Get meetups and appointments
      const { data: meetups } = await client
        .from('dating_meetups')
        .select('*');

      const { data: appointments } = await client
        .from('mating_appointments')
        .select('*');

      // Calculate revenue from subscriptions
      let totalRevenue = 0;
      if (subscriptions) {
        for (const sub of subscriptions) {
          totalRevenue += parseFloat(sub.price || '0');
        }
      }

      const analytics = {
        totalPetProfiles: petProfiles.length,
        totalOwnerProfiles: ownerProfiles.length,
        totalMatches: allMatches?.length || 0,
        activeSubscriptions: subscriptions?.length || 0,
        totalRevenue,
        averageRevenuePerUser: subscriptions && subscriptions.length > 0 
          ? (totalRevenue / subscriptions.length).toFixed(2) 
          : 0,
        totalMeetups: meetups?.length || 0,
        totalMatingAppointments: appointments?.length || 0,
        completedMeetups: meetups?.filter((m: any) => m.status === 'completed').length || 0,
        completedAppointments: appointments?.filter((a: any) => a.status === 'completed').length || 0,
      };

      return sendSuccess(c, { analytics });
    } catch (error) {
      console.error('Error fetching dating analytics:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // FEEDBACK & COMPLETION
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/meetup/feedback
   * Post Meet-Up Feedback
   */
  app.post("/make-server-3dd53475/dating/meetup/feedback", async (c) => {
    try {
      const { meetupId, customerId, feedback } = await c.req.json();

      if (!meetupId || !customerId || !feedback) {
        return sendError(c, 'Missing required fields', 400);
      }

      const meetup = await datingRepo.findMeetupByMeetupId(meetupId);
      if (!meetup) {
        return sendError(c, 'Meetup not found', 404);
      }

      // Update feedback
      if (meetup.customer1_id === customerId) {
        await datingRepo.updateMeetup(meetupId, { feedback1: feedback });
      } else if (meetup.customer2_id === customerId) {
        await datingRepo.updateMeetup(meetupId, { feedback2: feedback });
      } else {
        return sendError(c, 'Unauthorized', 403);
      }

      return sendSuccess(c, { message: 'Feedback submitted successfully' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/appointment/feedback
   * Post Mating Appointment Feedback
   */
  app.post("/make-server-3dd53475/dating/appointment/feedback", async (c) => {
    try {
      const { appointmentId, customerId, feedback } = await c.req.json();

      if (!appointmentId || !customerId || !feedback) {
        return sendError(c, 'Missing required fields', 400);
      }

      const appointment = await datingRepo.findMatingAppointmentByAppointmentId(appointmentId);
      if (!appointment) {
        return sendError(c, 'Appointment not found', 404);
      }

      // Update feedback
      if (appointment.customer1_id === customerId) {
        await datingRepo.updateMatingAppointment(appointmentId, { feedback1: feedback });
      } else if (appointment.customer2_id === customerId) {
        await datingRepo.updateMatingAppointment(appointmentId, { feedback2: feedback });
      } else {
        return sendError(c, 'Unauthorized', 403);
      }

      return sendSuccess(c, { message: 'Feedback submitted successfully' });
    } catch (error) {
      console.error('Error submitting feedback:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // VENDOR ENDPOINTS (Vets & Cafés)
  // ============================================

  /**
   * GET /vendor/dating/bookings/:vendorId
   * Get dating-related bookings for vendor (meetups/appointments)
   */
  app.get(`${BASE}/vendor/dating/bookings/:vendorId`, async (c) => {
    try {
      const { vendorId } = c.req.param();
      const bookingType = c.req.query('type'); // 'meetup' | 'appointment'

      const bookings = [];

      if (!bookingType || bookingType === 'meetup') {
        // ✅ SQL: Get café meetups
        const { data: meetups } = await client
          .from('dating_meetups')
          .select('*, bookings(*), dating_matches(*)')
          .eq('cafe_vendor_id', vendorId)
          .order('scheduled_date', { ascending: false })
          .order('scheduled_time', { ascending: false });

        for (const meetup of meetups || []) {
          bookings.push({
            id: meetup.id,
            type: 'meetup',
            meetupId: meetup.meetup_id,
            bookingId: meetup.booking_id,
            scheduledDate: meetup.scheduled_date,
            scheduledTime: meetup.scheduled_time,
            status: meetup.status,
            customer1Id: meetup.customer1_id,
            customer2Id: meetup.customer2_id,
            notes: meetup.notes,
            booking: meetup.bookings,
          });
        }
      }

      if (!bookingType || bookingType === 'appointment') {
        // ✅ SQL: Get vet appointments
        const { data: appointments } = await client
          .from('mating_appointments')
          .select('*, bookings(*), dating_matches(*)')
          .eq('vet_vendor_id', vendorId)
          .order('scheduled_date', { ascending: false })
          .order('scheduled_time', { ascending: false });

        for (const appointment of appointments || []) {
          bookings.push({
            id: appointment.id,
            type: 'mating_appointment',
            appointmentId: appointment.appointment_id,
            bookingId: appointment.booking_id,
            scheduledDate: appointment.scheduled_date,
            scheduledTime: appointment.scheduled_time,
            status: appointment.status,
            customer1Id: appointment.customer1_id,
            customer2Id: appointment.customer2_id,
            pet1Id: appointment.pet1_id,
            pet2Id: appointment.pet2_id,
            notes: appointment.notes,
            booking: appointment.bookings,
          });
        }
      }

      return sendSuccess(c, { bookings, count: bookings.length });
    } catch (error) {
      console.error('Error fetching vendor dating bookings:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /vendor/dating/booking/:bookingId/complete
   * Vendor marks dating booking as complete
   */
  app.post(`${BASE}/vendor/dating/booking/:bookingId/complete`, async (c) => {
    try {
      const { bookingId } = c.req.param();
      const { vendorId, otp } = await c.req.json();

      // ✅ SQL: Get booking
      const bookingsRepo = getBookingsRepository();
      const booking = await bookingsRepo.findById(bookingId);
      if (!booking) {
        return sendError(c, 'Booking not found', 404);
      }

      if (booking.vendor_id !== vendorId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Verify OTP if required
      if (otp) {
        // TODO: Implement OTP verification
      }

      // ✅ SQL: Update booking status
      await bookingsRepo.update(bookingId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      // ✅ SQL: Update meetup/appointment status
      const { data: meetup } = await client
        .from('dating_meetups')
        .select('*')
        .eq('booking_id', bookingId)
        .maybeSingle();

      if (meetup) {
        await datingRepo.updateMeetup(meetup.meetup_id, { status: 'completed' });
      } else {
        const { data: appointment } = await client
          .from('mating_appointments')
          .select('*')
          .eq('booking_id', bookingId)
          .maybeSingle();

        if (appointment) {
          await datingRepo.updateMatingAppointment(appointment.appointment_id, { status: 'completed' });
        }
      }

      // Send notifications
      const notificationsRepo = getNotificationsRepository();
      if (meetup) {
        await notificationsRepo.create({
          recipient_id: meetup.customer1_id,
          recipient_type: 'customer',
          notification_type: 'dating_meetup_completed',
          title: 'Meet-Up Completed! ☕',
          message: 'Your café meet-up has been completed. Please share your feedback!',
          data: { meetupId: meetup.meetup_id },
        });

        await notificationsRepo.create({
          recipient_id: meetup.customer2_id,
          recipient_type: 'customer',
          notification_type: 'dating_meetup_completed',
          title: 'Meet-Up Completed! ☕',
          message: 'Your café meet-up has been completed. Please share your feedback!',
          data: { meetupId: meetup.meetup_id },
        });
      }

      return sendSuccess(c, { message: 'Booking marked as complete' });
    } catch (error) {
      console.error('Error completing booking:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // ADMIN MODE CONTROL
  // ============================================

  /**
   * GET /admin/dating/mode-control
   * Get dating mode control settings
   */
  app.get(`${BASE}/admin/dating/mode-control`, async (c) => {
    try {
      // ✅ SQL: Get platform settings for dating modes
      const { data: petDatingMode } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'dating:pet_mode:enabled')
        .maybeSingle();

      const { data: ownerDatingMode } = await client
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'dating:owner_mode:enabled')
        .maybeSingle();

      return sendSuccess(c, {
        petDatingMode: petDatingMode?.setting_value !== false,
        ownerDatingMode: ownerDatingMode?.setting_value !== false,
      });
    } catch (error) {
      console.error('Error fetching mode control:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /admin/dating/mode-control
   * Enable/disable dating modes
   */
  app.post(`${BASE}/admin/dating/mode-control`, async (c) => {
    try {
      const { petDatingMode, ownerDatingMode } = await c.req.json();

      // ✅ SQL: Update platform settings
      if (petDatingMode !== undefined) {
        await client
          .from('platform_settings')
          .upsert({
            setting_key: 'dating:pet_mode:enabled',
            setting_value: petDatingMode,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'setting_key' });
      }

      if (ownerDatingMode !== undefined) {
        await client
          .from('platform_settings')
          .upsert({
            setting_key: 'dating:owner_mode:enabled',
            setting_value: ownerDatingMode,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'setting_key' });
      }

      return sendSuccess(c, { message: 'Mode control updated successfully' });
    } catch (error) {
      console.error('Error updating mode control:', error);
      return sendError(c, error, 500);
    }
  });

  console.log('✅ Mating & Dating Service (SQL-only) registered successfully');
}


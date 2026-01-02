import { Hono } from "hono";
import * as kv from "./kv_store";
import { sendSuccess, sendError } from "./response-utils";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

/**
 * MATING & DATING SERVICE
 * P2P matchmaking for pets and pet owners
 * Subscription-based chat unlock
 * Integration with cafés and vet services
 * All photos stored in S3
 */

export function registerMatingDatingService(app: Hono) {

  // Helper: Upload photo to S3
  async function uploadPhotoToS3(file: File, folder: string, fileName: string): Promise<string> {
    const awsSettings = await kv.get('admin:settings:aws') || {};
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

  // Helper: Delete photo from S3
  async function deletePhotoFromS3(url: string): Promise<void> {
    const awsSettings = await kv.get('admin:settings:aws') || {};
    const s3Config = awsSettings.s3 || {};

    if (!s3Config.enabled || !s3Config.bucket) return;

    const urlParts = url.split('.amazonaws.com/');
    if (urlParts.length < 2) return;

    const key = urlParts[1];
    const s3Client = new S3Client({
      region: s3Config.region || 'ap-south-1',
      credentials: {
        accessKeyId: s3Config.accessKeyId || awsSettings.credentials?.accessKeyId,
        secretAccessKey: s3Config.secretAccessKey || awsSettings.credentials?.secretAccessKey
      }
    });

    await s3Client.send(new DeleteObjectCommand({
      Bucket: s3Config.bucket,
      Key: key
    }));

    console.log(`✅ [S3] Deleted dating photo: ${key}`);
  }

  // ============================================
  // PET DATING PROFILE MANAGEMENT
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/pet-profile
   * Create or update pet dating profile
   * Supports photo uploads via multipart form or base64 (converted to S3)
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
          lookingFor, // 'mating' | 'playdate' | 'both'
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
              // Base64 image - convert to file and upload to S3
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
                // Fallback: keep original if conversion fails
                photos.push(photo);
              }
            } else if (photo.includes('.amazonaws.com/')) {
              // Already an S3 URL
              photos.push(photo);
            } else {
              // Other URL format
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

      const profileId = `pet_dating_${petId}`;

      const profile = {
        id: profileId,
        ...profileData,
        isActive: true,
        likes: [],
        dislikes: [],
        matches: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`dating_profile:pet:${profileId}`, profile);

      // Index by user
      const userProfilesKey = `user:${userId}:dating_profiles:pet`;
      const userProfiles = await kv.get(userProfilesKey) || [];
      if (!userProfiles.includes(profileId)) {
        userProfiles.push(profileId);
        await kv.set(userProfilesKey, userProfiles);
      }

      // Index by breed for matching
      const breedIndexKey = `dating_profiles:breed:${breed.toLowerCase()}`;
      const breedProfiles = await kv.get(breedIndexKey) || [];
      if (!breedProfiles.includes(profileId)) {
        breedProfiles.push(profileId);
        await kv.set(breedIndexKey, breedProfiles);
      }

      // Global index
      const allProfilesKey = 'dating_profiles:pet:all';
      const allProfiles = await kv.get(allProfilesKey) || [];
      if (!allProfiles.includes(profileId)) {
        allProfiles.push(profileId);
        await kv.set(allProfilesKey, allProfiles);
      }

      return sendSuccess(c, { profile }, 'Pet dating profile created successfully');
    } catch (error) {
      console.error('Error creating pet dating profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/pet-profile/:profileId
   * Get pet dating profile
   */
  app.get("/make-server-3dd53475/dating/pet-profile/:profileId", async (c) => {
    try {
      const { profileId } = c.req.param();

      const profile = await kv.get(`dating_profile:pet:${profileId}`);
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      return sendSuccess(c, { profile });
    } catch (error) {
      console.error('Error fetching pet dating profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/owner-profile/:profileId
   * Get owner dating profile
   */
  app.get("/make-server-3dd53475/dating/owner-profile/:profileId", async (c) => {
    try {
      const { profileId } = c.req.param();

      const profile = await kv.get(`dating_profile:owner:${profileId}`);
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      return sendSuccess(c, { profile });
    } catch (error) {
      console.error('Error fetching owner dating profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/owner-profile
   * Create or update owner dating profile
   * Supports photo uploads via multipart form or base64 (converted to S3)
   */
  app.post("/make-server-3dd53475/dating/owner-profile", async (c) => {
    try {
      const contentType = c.req.header('content-type') || '';
      let profileData: any = {};
      let photos: string[] = [];

      if (contentType.includes('multipart/form-data')) {
        const formData = await c.req.formData();
        const userId = formData.get('userId') as string;
        const name = formData.get('name') as string;

        if (!userId || !name) {
          return sendError(c, 'Missing required fields: userId, name', 400);
        }

        // Upload photos to S3
        const photoFiles = formData.getAll('photos') as File[];
        for (let i = 0; i < photoFiles.length; i++) {
          const file = photoFiles[i];
          if (file && file.size > 0) {
            const timestamp = Date.now();
            const fileExt = file.name.split('.').pop() || 'jpg';
            const fileName = `owner_${userId}_${timestamp}_${i}.${fileExt}`;
            const photoUrl = await uploadPhotoToS3(file, 'owner-profiles', fileName);
            photos.push(photoUrl);
          }
        }

        profileData = {
          userId,
          name,
          age: parseInt(formData.get('age') as string || '0'),
          photos,
          bio: formData.get('bio') as string || '',
          pets: JSON.parse(formData.get('pets') as string || '[]'),
          interests: JSON.parse(formData.get('interests') as string || '[]'),
          location: JSON.parse(formData.get('location') as string || '{"lat":0,"lng":0,"city":""}')
        };
      } else {
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

        // Handle base64 photos - convert to S3
        photos = [];
        if (providedPhotos && Array.isArray(providedPhotos)) {
          for (const photo of providedPhotos) {
            if (photo.startsWith('data:image')) {
              // Base64 image - convert to file and upload to S3
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
            } else if (photo.includes('.amazonaws.com/')) {
              photos.push(photo);
            } else {
              photos.push(photo);
            }
          }
        }

        profileData = {
          userId,
          name,
          age: Number(age),
          photos,
          bio: bio || '',
          pets: pets || [],
          interests: interests || [],
          location: location || { lat: 0, lng: 0, city: '' }
        };
      }

      const profileId = `owner_dating_${userId}`;

      const profile = {
        id: profileId,
        ...profileData,
        isActive: true,
        likes: [],
        dislikes: [],
        matches: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`dating_profile:owner:${profileId}`, profile);

      // Index by user
      await kv.set(`user:${userId}:dating_profile:owner`, profileId);

      // Global index
      const allOwnerProfilesKey = 'dating_profiles:owner:all';
      const allProfiles = await kv.get(allOwnerProfilesKey) || [];
      if (!allProfiles.includes(profileId)) {
        allProfiles.push(profileId);
        await kv.set(allOwnerProfilesKey, allProfiles);
      }

      return sendSuccess(c, { profile }, 'Owner dating profile created successfully');
    } catch (error) {
      console.error('Error creating owner dating profile:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MATCH & SWIPE SYSTEM
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/discover
   * Get potential matches for swiping
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

      const profile = await kv.get(`dating_profile:${profileType}:${profileId}`);
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      // Get all profiles of the same type
      const allProfilesKey = `dating_profiles:${profileType}:all`;
      const allProfileIds = await kv.get(allProfilesKey) || [];

      const potentialMatches = [];

      for (const otherId of allProfileIds) {
        // Skip self
        if (otherId === profileId) continue;

        const otherProfile = await kv.get(`dating_profile:${profileType}:${otherId}`);
        if (!otherProfile || !otherProfile.isActive) continue;

        // Skip if already liked/disliked
        if (profile.likes.includes(otherId) || profile.dislikes.includes(otherId)) continue;

        // Skip if already matched
        if (profile.matches.includes(otherId)) continue;

        // Apply filters
        if (profileType === 'pet' && filters) {
          if (filters.breed && otherProfile.breed !== filters.breed) continue;
          if (filters.minAge && otherProfile.age < filters.minAge) continue;
          if (filters.maxAge && otherProfile.age > filters.maxAge) continue;
          
          // Gender filter - opposite for mating
          if (profile.lookingFor === 'mating' && otherProfile.lookingFor === 'mating') {
            if (profile.gender === otherProfile.gender) continue;
          }
        }

        // TODO: Calculate distance based on location
        // For now, we'll just add all that pass filters

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
   * Swipe left (pass) or right (like)
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

      const profile = await kv.get(`dating_profile:${profileType}:${profileId}`);
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      const targetProfile = await kv.get(`dating_profile:${profileType}:${targetProfileId}`);
      if (!targetProfile) {
        return sendError(c, 'Target profile not found', 404);
      }

      let isMatch = false;
      let matchId = null;

      if (action === 'like') {
        // Add to likes
        if (!profile.likes.includes(targetProfileId)) {
          profile.likes.push(targetProfileId);
        }

        // Check if it's a mutual match
        if (targetProfile.likes.includes(profileId)) {
          isMatch = true;

          // Create match
          matchId = `match_${Date.now()}_${Math.random().toString(36).substring(7)}`;

          const match = {
            id: matchId,
            profileType,
            profile1Id: profileId,
            profile2Id: targetProfileId,
            profile1UserId: profile.userId,
            profile2UserId: targetProfile.userId,
            status: 'active',
            chatUnlocked: false,
            createdAt: new Date().toISOString()
          };

          await kv.set(`dating_match:${matchId}`, match);

          // Add to both profiles' matches
          if (!profile.matches.includes(targetProfileId)) {
            profile.matches.push(targetProfileId);
          }
          if (!targetProfile.matches.includes(profileId)) {
            targetProfile.matches.push(profileId);
          }

          // Index by user
          const user1MatchesKey = `user:${profile.userId}:dating_matches`;
          const user1Matches = await kv.get(user1MatchesKey) || [];
          user1Matches.push(matchId);
          await kv.set(user1MatchesKey, user1Matches);

          const user2MatchesKey = `user:${targetProfile.userId}:dating_matches`;
          const user2Matches = await kv.get(user2MatchesKey) || [];
          user2Matches.push(matchId);
          await kv.set(user2MatchesKey, user2Matches);

          await kv.set(`dating_profile:${profileType}:${targetProfileId}`, targetProfile);
        }
      } else {
        // Add to dislikes
        if (!profile.dislikes.includes(targetProfileId)) {
          profile.dislikes.push(targetProfileId);
        }
      }

      await kv.set(`dating_profile:${profileType}:${profileId}`, profile);

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
   * GET /make-server-3dd53475/dating/matches/:userId
   * Get all matches for a user
   */
  app.get("/make-server-3dd53475/dating/matches/:userId", async (c) => {
    try {
      const { userId } = c.req.param();

      const matchesKey = `user:${userId}:dating_matches`;
      const matchIds = await kv.get(matchesKey) || [];

      const matches = [];

      for (const matchId of matchIds) {
        const match = await kv.get(`dating_match:${matchId}`);
        if (match && match.status === 'active') {
          // Get the other profile
          const otherProfileId = match.profile1UserId === userId ? match.profile2Id : match.profile1Id;
          const otherProfile = await kv.get(`dating_profile:${match.profileType}:${otherProfileId}`);

          matches.push({
            ...match,
            otherProfile
          });
        }
      }

      // Sort by creation date (newest first)
      matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      return sendSuccess(c, { matches, count: matches.length });
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
   * Unlock chat for a match (requires subscription)
   */
  app.post("/make-server-3dd53475/dating/unlock-chat", async (c) => {
    try {
      const { matchId, userId } = await c.req.json();

      if (!matchId || !userId) {
        return sendError(c, 'Missing required fields', 400);
      }

      // Check if user has active P2P dating subscription
      const userSubsKey = `user:${userId}:subscriptions`;
      const subIds = await kv.get(userSubsKey) || [];

      let hasSubscription = false;
      let subscription = null;

      for (const subId of subIds) {
        const sub = await kv.get(`user_subscription:${subId}`);
        if (sub && sub.status === 'active' && sub.tierType === 'p2p_service') {
          // Check if subscription benefits include dating chat
          if (sub.benefits && sub.benefits.dating_chat) {
            hasSubscription = true;
            subscription = sub;
            break;
          }
        }
      }

      if (!hasSubscription) {
        return sendError(c, 'Active P2P dating subscription required to unlock chat', 402);
      }

      // Get match
      const match = await kv.get(`dating_match:${matchId}`);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Verify user is part of this match
      if (match.profile1UserId !== userId && match.profile2UserId !== userId) {
        return sendError(c, 'Unauthorized', 403);
      }

      // Create AWS Chime messaging channel if not exists
      if (!match.chatChannelArn) {
        try {
          const awsSettings = await kv.get('admin:settings:aws');
          if (awsSettings?.chime?.enabled) {
            // Use AWS Chime SDK Messaging
            const channelName = `dating_match_${matchId}`;
            // In production, create actual Chime messaging channel
            // For now, use KV store with Chime-compatible structure
            match.chatChannelArn = `chime:dating:${matchId}`;
            match.chatChannelName = channelName;
            match.chimeAppInstanceArn = awsSettings.chime.appInstanceArn;
            
            // Store channel metadata
            await kv.set(`chime:channel:${matchId}`, {
              channelArn: match.chatChannelArn,
              channelName,
              matchId,
              participants: [match.profile1UserId, match.profile2UserId],
              createdAt: new Date().toISOString()
            });
          } else {
            // Fallback: Use KV store for chat
            match.chatChannelArn = `kv:dating:${matchId}`;
            match.chatChannelName = `dating_match_${matchId}`;
          }
        } catch (error) {
          console.error('Error creating Chime channel:', error);
          // Fallback to KV store
          match.chatChannelArn = `kv:dating:${matchId}`;
          match.chatChannelName = `dating_match_${matchId}`;
        }
      }

      match.chatUnlocked = true;
      match.chatUnlockedBy = userId;
      match.chatUnlockedAt = new Date().toISOString();

      await kv.set(`dating_match:${matchId}`, match);

      return sendSuccess(c, { 
        match,
        chatChannelArn: match.chatChannelArn,
        message: 'Chat unlocked successfully'
      });
    } catch (error) {
      console.error('Error unlocking chat:', error);
      return sendError(c, error, 500);
    }
  });

  // ============================================
  // MEET-UP SCHEDULING
  // ============================================

  /**
   * POST /make-server-3dd53475/dating/schedule-meetup
   * Schedule a meet-up at a café
   */
  app.post("/make-server-3dd53475/dating/schedule-meetup", async (c) => {
    try {
      const {
        matchId,
        userId,
        cafeId,
        dateTime,
        notes
      } = await c.req.json();

      if (!matchId || !userId || !cafeId || !dateTime) {
        return sendError(c, 'Missing required fields', 400);
      }

      const match = await kv.get(`dating_match:${matchId}`);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Create meet-up booking
      const meetupId = `meetup_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const meetup = {
        id: meetupId,
        matchId,
        initiatedBy: userId,
        user1Id: match.profile1UserId,
        user2Id: match.profile2UserId,
        cafeId,
        dateTime,
        notes: notes || '',
        status: 'pending', // pending, confirmed, completed, cancelled
        createdAt: new Date().toISOString()
      };

      await kv.set(`dating_meetup:${meetupId}`, meetup);

      // Add to match
      match.meetups = match.meetups || [];
      match.meetups.push(meetupId);
      await kv.set(`dating_match:${matchId}`, match);

      return sendSuccess(c, { meetup }, 'Meet-up scheduled successfully');
    } catch (error) {
      console.error('Error scheduling meet-up:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * POST /make-server-3dd53475/dating/request-mating-appointment
   * Request a mating appointment at a vet clinic
   */
  app.post("/make-server-3dd53475/dating/request-mating-appointment", async (c) => {
    try {
      const {
        matchId,
        userId,
        vetClinicId,
        dateTime,
        notes
      } = await c.req.json();

      if (!matchId || !userId || !vetClinicId || !dateTime) {
        return sendError(c, 'Missing required fields', 400);
      }

      const match = await kv.get(`dating_match:${matchId}`);
      if (!match) {
        return sendError(c, 'Match not found', 404);
      }

      // Create mating appointment
      const appointmentId = `mating_appt_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const appointment = {
        id: appointmentId,
        matchId,
        requestedBy: userId,
        user1Id: match.profile1UserId,
        user2Id: match.profile2UserId,
        pet1Id: match.profile1Id.replace('pet_dating_', ''),
        pet2Id: match.profile2Id.replace('pet_dating_', ''),
        vetClinicId,
        dateTime,
        notes: notes || '',
        status: 'pending', // pending, confirmed, completed, cancelled
        type: 'mating_appointment',
        createdAt: new Date().toISOString()
      };

      await kv.set(`mating_appointment:${appointmentId}`, appointment);

      // Add to match
      match.matingAppointments = match.matingAppointments || [];
      match.matingAppointments.push(appointmentId);
      await kv.set(`dating_match:${matchId}`, match);

      return sendSuccess(c, { appointment }, 'Mating appointment requested successfully');
    } catch (error) {
      console.error('Error requesting mating appointment:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/dating/nearby-cafes
   * Get nearby pet-friendly cafes for meet-ups
   */
  app.get("/make-server-3dd53475/dating/nearby-cafes", async (c) => {
    try {
      const lat = Number(c.req.query('lat'));
      const lng = Number(c.req.query('lng'));
      const radius = Number(c.req.query('radius')) || 5; // km

      if (!lat || !lng) {
        return sendError(c, 'Location parameters required', 400);
      }

      // Get all cafes (in production, this would use geospatial indexing)
      const cafeVendors = await kv.getByPrefix('vendor:') || [];
      
      const nearbyCafes = [];

      for (const vendor of cafeVendors) {
        if (vendor.role === 'cafes' && vendor.status === 'approved') {
          // Simple distance calculation (in production, use proper geospatial calculation)
          if (vendor.location && vendor.location.lat && vendor.location.lng) {
            const distance = calculateDistance(
              lat, lng,
              vendor.location.lat, vendor.location.lng
            );

            if (distance <= radius) {
              nearbyCafes.push({
                ...vendor,
                distance: distance.toFixed(2)
              });
            }
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
   * GET /make-server-3dd53475/dating/nearby-vets
   * Get nearby vet clinics for mating appointments
   */
  app.get("/make-server-3dd53475/dating/nearby-vets", async (c) => {
    try {
      const lat = Number(c.req.query('lat'));
      const lng = Number(c.req.query('lng'));
      const radius = Number(c.req.query('radius')) || 10; // km

      if (!lat || !lng) {
        return sendError(c, 'Location parameters required', 400);
      }

      // Get all vet clinics
      const vetVendors = await kv.getByPrefix('vendor:') || [];
      
      const nearbyVets = [];

      for (const vendor of vetVendors) {
        if (vendor.role === 'veterinarian' && vendor.status === 'approved') {
          if (vendor.location && vendor.location.lat && vendor.location.lng) {
            const distance = calculateDistance(
              lat, lng,
              vendor.location.lat, vendor.location.lng
            );

            if (distance <= radius) {
              nearbyVets.push({
                ...vendor,
                distance: distance.toFixed(2)
              });
            }
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

  // ============================================
  // ADMIN MODERATION
  // ============================================

  /**
   * GET /make-server-3dd53475/admin/dating/profiles
   * Get all dating profiles for moderation
   */
  app.get("/make-server-3dd53475/admin/dating/profiles", async (c) => {
    try {
      const profileType = c.req.query('profileType') || 'pet'; // pet or owner
      const status = c.req.query('status'); // active, flagged, suspended

      const allProfilesKey = `dating_profiles:${profileType}:all`;
      const profileIds = await kv.get(allProfilesKey) || [];

      const profiles = [];

      for (const profileId of profileIds) {
        const profile = await kv.get(`dating_profile:${profileType}:${profileId}`);
        if (profile) {
          if (!status || profile.status === status) {
            profiles.push(profile);
          }
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
   * Moderate a dating profile (flag, suspend, activate)
   */
  app.post("/make-server-3dd53475/admin/dating/moderate-profile", async (c) => {
    try {
      const { profileId, profileType, action, reason } = await c.req.json();

      const profile = await kv.get(`dating_profile:${profileType}:${profileId}`);
      if (!profile) {
        return sendError(c, 'Profile not found', 404);
      }

      if (action === 'flag') {
        profile.flagged = true;
        profile.flagReason = reason;
      } else if (action === 'suspend') {
        profile.isActive = false;
        profile.suspended = true;
        profile.suspendReason = reason;
      } else if (action === 'activate') {
        profile.isActive = true;
        profile.flagged = false;
        profile.suspended = false;
      }

      profile.updatedAt = new Date().toISOString();

      await kv.set(`dating_profile:${profileType}:${profileId}`, profile);

      return sendSuccess(c, { profile }, `Profile ${action}ed successfully`);
    } catch (error) {
      console.error('Error moderating profile:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/admin/dating/analytics
   * Get dating service analytics
   */
  app.get("/make-server-3dd53475/admin/dating/analytics", async (c) => {
    try {
      const petProfiles = await kv.get('dating_profiles:pet:all') || [];
      const ownerProfiles = await kv.get('dating_profiles:owner:all') || [];

      let totalMatches = 0;
      let activeSubs = 0;
      let totalRevenue = 0;

      // Count matches and subscriptions
      const allUsers = new Set();
      petProfiles.forEach((p: any) => {
        const profile = kv.get(`dating_profile:pet:${p}`);
        if (profile) allUsers.add(profile.userId);
      });
      ownerProfiles.forEach((p: any) => {
        const profile = kv.get(`dating_profile:owner:${p}`);
        if (profile) allUsers.add(profile.userId);
      });

      for (const userId of allUsers) {
        const matchesKey = `user:${userId}:dating_matches`;
        const matches = await kv.get(matchesKey) || [];
        totalMatches += matches.length;

        const subsKey = `user:${userId}:subscriptions`;
        const subs = await kv.get(subsKey) || [];
        for (const subId of subs) {
          const sub = await kv.get(`user_subscription:${subId}`);
          if (sub && sub.status === 'active' && sub.tierType === 'p2p_service') {
            activeSubs++;
            totalRevenue += sub.price;
          }
        }
      }

      const analytics = {
        totalPetProfiles: petProfiles.length,
        totalOwnerProfiles: ownerProfiles.length,
        totalMatches: Math.floor(totalMatches / 2), // Divide by 2 since each match is counted twice
        activeSubscriptions: activeSubs,
        totalRevenue,
        averageRevenuePerUser: activeSubs > 0 ? (totalRevenue / activeSubs).toFixed(2) : 0
      };

      return sendSuccess(c, { analytics });
    } catch (error) {
      console.error('Error fetching dating analytics:', error);
      return sendError(c, error, 500);
    }
  });
}

// Helper function to calculate distance between two coordinates
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

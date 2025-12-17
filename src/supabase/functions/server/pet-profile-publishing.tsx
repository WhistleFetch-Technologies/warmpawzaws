/**
 * PET PROFILE PUBLISHING SYSTEM
 * Production-Grade Implementation
 * 
 * Features:
 * - Puppy/pet profile creation for breeders and adoption centers
 * - Lineage information
 * - Vaccination status
 * - Nature/behavior information
 * - Photo galleries
 * - Public listing
 */

import { Hono } from 'npm:hono@4';
import * as kv from './kv_store.tsx';

interface PetProfile {
  id: string;
  vendorId: string;
  vendorType: 'breeder' | 'adoption_center';
  petType: string;
  name: string;
  breed?: string;
  age?: string;
  gender?: 'male' | 'female';
  color?: string;
  weight?: number;
  lineage?: {
    sire?: string;
    dam?: string;
    generation?: number;
    pedigree?: string;
  };
  vaccinationStatus: {
    vaccinated: boolean;
    vaccinationDate?: string;
    nextDueDate?: string;
    vaccinationRecords?: Array<{
      vaccine: string;
      date: string;
      nextDue?: string;
    }>;
  };
  nature: {
    temperament: string[];
    behavior: string;
    goodWith: string[];
    specialNeeds?: string;
  };
  photos: string[];
  description: string;
  price?: number; // For breeders
  adoptionFee?: number; // For adoption centers
  status: 'available' | 'reserved' | 'adopted' | 'sold';
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export function petProfilePublishingEndpoints(app: Hono) {
  const BASE = '/make-server-3dd53475';

  /**
   * POST /pet-profile/create
   * Create a pet profile for publishing
   */
  app.post(`${BASE}/pet-profile/create`, async (c) => {
    try {
      const profileData: Partial<PetProfile> = await c.req.json();

      if (!profileData.vendorId || !profileData.petType || !profileData.name) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      // Verify vendor is breeder or adoption center
      const vendor = await kv.get(`vendor:${profileData.vendorId}`);
      if (!vendor) {
        return c.json({ error: 'Vendor not found' }, 404);
      }

      const vendorType = profileData.vendorType || (vendor.roleId?.includes('breeder') ? 'breeder' : 'adoption_center');
      
      if (vendorType !== 'breeder' && vendorType !== 'adoption_center') {
        return c.json({ error: 'Vendor must be a breeder or adoption center' }, 400);
      }

      const profileId = `pet_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const profile: PetProfile = {
        id: profileId,
        vendorId: profileData.vendorId,
        vendorType: vendorType as 'breeder' | 'adoption_center',
        petType: profileData.petType,
        name: profileData.name,
        breed: profileData.breed,
        age: profileData.age,
        gender: profileData.gender,
        color: profileData.color,
        weight: profileData.weight,
        lineage: profileData.lineage || {},
        vaccinationStatus: profileData.vaccinationStatus || {
          vaccinated: false,
          vaccinationRecords: []
        },
        nature: profileData.nature || {
          temperament: [],
          behavior: '',
          goodWith: []
        },
        photos: profileData.photos || [],
        description: profileData.description || '',
        price: profileData.price,
        adoptionFee: profileData.adoptionFee,
        status: 'available',
        published: profileData.published || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await kv.set(`pet_profile:${profileId}`, profile);

      // Add to vendor's profiles
      const vendorProfiles = await kv.get(`vendor:${profileData.vendorId}:pet_profiles`) || [];
      vendorProfiles.push(profileId);
      await kv.set(`vendor:${profileData.vendorId}:pet_profiles`, vendorProfiles);

      // Add to public listing if published
      if (profile.published) {
        const publicProfiles = await kv.get(`public:pet_profiles:${vendorType}`) || [];
        publicProfiles.push(profileId);
        await kv.set(`public:pet_profiles:${vendorType}`, publicProfiles);
      }

      console.log(`✅ [PET-PROFILE] Created profile: ${profileId}`);

      return c.json({
        success: true,
        profile,
        message: 'Pet profile created successfully'
      });

    } catch (error) {
      console.error('❌ [PET-PROFILE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /pet-profile/public/list
   * Get public pet profiles
   */
  app.get(`${BASE}/pet-profile/public/list`, async (c) => {
    try {
      const vendorType = c.req.query('vendorType') as 'breeder' | 'adoption_center' | undefined;
      const petType = c.req.query('petType');
      const breed = c.req.query('breed');
      const status = c.req.query('status') || 'available';
      const limit = parseInt(c.req.query('limit') || '20');
      const offset = parseInt(c.req.query('offset') || '0');

      let profileIds: string[] = [];

      if (vendorType) {
        profileIds = await kv.get(`public:pet_profiles:${vendorType}`) || [];
      } else {
        const breederProfiles = await kv.get(`public:pet_profiles:breeder`) || [];
        const adoptionProfiles = await kv.get(`public:pet_profiles:adoption_center`) || [];
        profileIds = [...breederProfiles, ...adoptionProfiles];
      }

      const profiles: PetProfile[] = [];
      for (const profileId of profileIds) {
        const profile = await kv.get(`pet_profile:${profileId}`);
        if (profile && profile.published && profile.status === status) {
          // Apply filters
          if (petType && profile.petType !== petType) continue;
          if (breed && profile.breed !== breed) continue;
          profiles.push(profile);
        }
      }

      // Sort by creation date (newest first)
      profiles.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      const paginated = profiles.slice(offset, offset + limit);

      return c.json({
        success: true,
        profiles: paginated,
        total: profiles.length,
        pagination: {
          limit,
          offset,
          hasMore: offset + limit < profiles.length
        }
      });

    } catch (error) {
      console.error('❌ [PET-PROFILE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /pet-profile/:profileId
   * Get pet profile details
   */
  app.get(`${BASE}/pet-profile/:profileId`, async (c) => {
    try {
      const { profileId } = c.req.param();
      const profile = await kv.get(`pet_profile:${profileId}`);

      if (!profile) {
        return c.json({ error: 'Profile not found' }, 404);
      }

      // Get vendor info
      const vendor = await kv.get(`vendor:${profile.vendorId}`);

      return c.json({
        success: true,
        profile: {
          ...profile,
          vendor: {
            id: vendor?.id,
            name: vendor?.businessName || vendor?.fullName,
            address: vendor?.address,
            city: vendor?.city,
            phone: vendor?.phone
          }
        }
      });

    } catch (error) {
      console.error('❌ [PET-PROFILE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * PUT /pet-profile/:profileId
   * Update pet profile
   */
  app.put(`${BASE}/pet-profile/:profileId`, async (c) => {
    try {
      const { profileId } = c.req.param();
      const updates: Partial<PetProfile> = await c.req.json();
      const { vendorId } = updates;

      const profile = await kv.get(`pet_profile:${profileId}`);
      if (!profile) {
        return c.json({ error: 'Profile not found' }, 404);
      }

      if (profile.vendorId !== vendorId) {
        return c.json({ error: 'Unauthorized' }, 403);
      }

      const updated = {
        ...profile,
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await kv.set(`pet_profile:${profileId}`, updated);

      // Update public listing if published status changed
      if (updates.published !== undefined && updates.published !== profile.published) {
        const publicProfiles = await kv.get(`public:pet_profiles:${profile.vendorType}`) || [];
        if (updates.published && !publicProfiles.includes(profileId)) {
          publicProfiles.push(profileId);
          await kv.set(`public:pet_profiles:${profile.vendorType}`, publicProfiles);
        } else if (!updates.published) {
          const filtered = publicProfiles.filter((id: string) => id !== profileId);
          await kv.set(`public:pet_profiles:${profile.vendorType}`, filtered);
        }
      }

      return c.json({
        success: true,
        profile: updated,
        message: 'Profile updated successfully'
      });

    } catch (error) {
      console.error('❌ [PET-PROFILE] Error:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  console.log('✅ Pet Profile Publishing endpoints registered');
}


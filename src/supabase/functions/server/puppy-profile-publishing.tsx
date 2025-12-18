/**
 * Puppy Profile & Pet Publishing System
 * For breeders and adoption centers
 */

import { Hono } from 'npm:hono';
import * as kv from './kv_store.tsx';

export function registerPuppyProfilePublishing(app: Hono) {
  /**
   * Create puppy profile (breeder)
   * POST /make-server-3dd53475/puppy-profile/create
   */
  app.post('/make-server-3dd53475/puppy-profile/create', async (c) => {
    try {
      const {
        vendorId,
        petId,
        name,
        breed,
        dateOfBirth,
        gender,
        color,
        weight,
        photos,
        lineage, // { sire: {}, dam: {}, grandparents: [] }
        vaccinationStatus, // [{ vaccine: string, date: string, nextDue: string }]
        healthCertificates, // [{ type: string, url: string, issuedBy: string }]
        temperament, // { energyLevel, friendliness, trainability, etc. }
        specialFeatures,
        price,
        availableForAdoption,
        adoptionFee,
      } = await c.req.json();

      if (!vendorId || !name || !breed) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const profileId = `puppy_profile_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const profile = {
        id: profileId,
        petId: petId || null,
        vendorId,
        name,
        breed,
        dateOfBirth: dateOfBirth || null,
        gender: gender || 'unknown',
        color: color || '',
        weight: weight || null,
        photos: photos || [],
        lineage: lineage || null,
        vaccinationStatus: vaccinationStatus || [],
        healthCertificates: healthCertificates || [],
        temperament: temperament || {},
        specialFeatures: specialFeatures || [],
        price: price || null,
        availableForAdoption: availableForAdoption || false,
        adoptionFee: adoptionFee || null,
        status: 'published',
        views: 0,
        inquiries: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`puppy_profile:${profileId}`, profile);

      // Add to vendor's puppy profiles
      const vendorProfilesKey = `vendor:${vendorId}:puppy_profiles`;
      const vendorProfiles = await kv.get(vendorProfilesKey) || [];
      vendorProfiles.unshift(profileId);
      await kv.set(vendorProfilesKey, vendorProfiles);

      // If petId provided, link to pet
      if (petId) {
        const pet = await kv.get(`pet:${petId}`);
        if (pet) {
          pet.puppyProfileId = profileId;
          pet.isPublished = true;
          await kv.set(`pet:${petId}`, pet);
        }
      }

      return c.json({
        success: true,
        profile,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Publish pet for adoption
   * POST /make-server-3dd53475/pet/publish-for-adoption
   */
  app.post('/make-server-3dd53475/pet/publish-for-adoption', async (c) => {
    try {
      const {
        petId,
        vendorId, // adoption center
        adoptionFee,
        adoptionRequirements, // [{ requirement: string, mandatory: boolean }]
        homeCheckRequired,
        interviewRequired,
        specialNotes,
      } = await c.req.json();

      if (!petId || !vendorId) {
        return c.json({ error: 'Missing required fields' }, 400);
      }

      const pet = await kv.get(`pet:${petId}`);
      if (!pet) {
        return c.json({ error: 'Pet not found' }, 404);
      }

      const publicationId = `adoption_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const publication = {
        id: publicationId,
        petId,
        vendorId,
        petName: pet.name,
        petBreed: pet.breed,
        petAge: pet.age,
        petType: pet.type || pet.species,
        photos: pet.photoUrl ? [pet.photoUrl] : [],
        adoptionFee: adoptionFee || 0,
        adoptionRequirements: adoptionRequirements || [],
        homeCheckRequired: homeCheckRequired || false,
        interviewRequired: interviewRequired || false,
        specialNotes: specialNotes || '',
        status: 'available',
        views: 0,
        applications: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`adoption_publication:${publicationId}`, publication);

      // Mark pet as published
      pet.isPublishedForAdoption = true;
      pet.adoptionPublicationId = publicationId;
      await kv.set(`pet:${petId}`, pet);

      // Add to vendor's adoption listings
      const vendorAdoptionsKey = `vendor:${vendorId}:adoption_listings`;
      const vendorAdoptions = await kv.get(vendorAdoptionsKey) || [];
      vendorAdoptions.unshift(publicationId);
      await kv.set(vendorAdoptionsKey, vendorAdoptions);

      return c.json({
        success: true,
        publication,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Browse puppy profiles
   * GET /make-server-3dd53475/puppy-profiles
   */
  app.get('/make-server-3dd53475/puppy-profiles', async (c) => {
    try {
      const breed = c.req.query('breed');
      const minPrice = parseFloat(c.req.query('minPrice') || '0');
      const maxPrice = parseFloat(c.req.query('maxPrice') || '999999');
      const availableOnly = c.req.query('availableOnly') === 'true';

      const allProfiles = await kv.getByPrefix('puppy_profile:');

      let filtered = allProfiles.filter((p: any) => {
        if (p.status !== 'published') return false;
        if (availableOnly && !p.availableForAdoption) return false;
        if (breed && p.breed.toLowerCase() !== breed.toLowerCase()) return false;
        if (p.price && (p.price < minPrice || p.price > maxPrice)) return false;
        return true;
      });

      return c.json({
        success: true,
        profiles: filtered,
        total: filtered.length,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Browse adoption listings
   * GET /make-server-3dd53475/adoption-listings
   */
  app.get('/make-server-3dd53475/adoption-listings', async (c) => {
    try {
      const petType = c.req.query('petType');
      const breed = c.req.query('breed');
      const ageMin = parseFloat(c.req.query('ageMin') || '0');
      const ageMax = parseFloat(c.req.query('ageMax') || '999');

      const allListings = await kv.getByPrefix('adoption_publication:');

      let filtered = allListings.filter((l: any) => {
        if (l.status !== 'available') return false;
        if (petType && l.petType !== petType) return false;
        if (breed && l.petBreed.toLowerCase() !== breed.toLowerCase()) return false;
        if (l.petAge && (l.petAge < ageMin || l.petAge > ageMax)) return false;
        return true;
      });

      return c.json({
        success: true,
        listings: filtered,
        total: filtered.length,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Get puppy profile details
   * GET /make-server-3dd53475/puppy-profile/:profileId
   */
  app.get('/make-server-3dd53475/puppy-profile/:profileId', async (c) => {
    try {
      const { profileId } = c.req.param();
      const profile = await kv.get(`puppy_profile:${profileId}`);

      if (!profile) {
        return c.json({ error: 'Profile not found' }, 404);
      }

      // Increment views
      profile.views = (profile.views || 0) + 1;
      await kv.set(`puppy_profile:${profileId}`, profile);

      // Get vendor info
      const vendor = await kv.get(`vendor:${profile.vendorId}`);

      return c.json({
        success: true,
        profile,
        vendor: vendor ? {
          id: vendor.id,
          name: vendor.businessName || vendor.name,
          phone: vendor.phone,
          address: vendor.address,
        } : null,
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * Apply for adoption
   * POST /make-server-3dd53475/adoption/:publicationId/apply
   */
  app.post('/make-server-3dd53475/adoption/:publicationId/apply', async (c) => {
    try {
      const { publicationId } = c.req.param();
      const {
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        address,
        experienceWithPets,
        homeEnvironment,
        otherPets,
        applicationNotes,
      } = await c.req.json();

      const publication = await kv.get(`adoption_publication:${publicationId}`);
      if (!publication) {
        return c.json({ error: 'Adoption listing not found' }, 404);
      }

      if (publication.status !== 'available') {
        return c.json({ error: 'Pet no longer available for adoption' }, 400);
      }

      const applicationId = `adoption_app_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const application = {
        id: applicationId,
        publicationId,
        petId: publication.petId,
        vendorId: publication.vendorId,
        customerId,
        customerName,
        customerPhone,
        customerEmail,
        address,
        experienceWithPets: experienceWithPets || '',
        homeEnvironment: homeEnvironment || '',
        otherPets: otherPets || [],
        applicationNotes: applicationNotes || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`adoption_application:${applicationId}`, application);

      // Add to publication applications
      publication.applications = (publication.applications || 0) + 1;
      await kv.set(`adoption_publication:${publicationId}`, publication);

      // Add to vendor applications
      const vendorApplicationsKey = `vendor:${publication.vendorId}:adoption_applications`;
      const vendorApplications = await kv.get(vendorApplicationsKey) || [];
      vendorApplications.unshift(applicationId);
      await kv.set(vendorApplicationsKey, vendorApplications);

      return c.json({
        success: true,
        application,
        message: 'Adoption application submitted successfully',
      });
    } catch (error) {
      return c.json({ error: String(error) }, 500);
    }
  });
}


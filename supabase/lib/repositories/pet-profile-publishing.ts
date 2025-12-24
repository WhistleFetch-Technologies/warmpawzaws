/**
 * ============================================================================
 * PET PROFILE PUBLISHING REPOSITORY
 * ============================================================================
 * 
 * Repository for breeder profiles, pet listings, and adoption center profiles.
 * Replaces: breeder:profile:{breederId}, pet:listing:{listingId}, 
 *           adoption:center:{centerId}, pet:inquiry:{inquiryId} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// TYPES
// ============================================================================

export interface BreederProfile {
  id: string;
  breeder_id: string;
  vendor_id: string;
  business_name: string;
  owner_name: string;
  license_number?: string | null;
  kci_registration?: string | null;
  years_in_business: number;
  specialized_breeds: string[];
  location: any;
  contact: any;
  certifications: any[];
  gallery: any[];
  rating: number;
  total_sales: number;
  description: string;
  facilities: string[];
  is_verified: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateBreederProfileInput {
  breeder_id: string;
  vendor_id: string;
  business_name: string;
  owner_name: string;
  license_number?: string;
  kci_registration?: string;
  years_in_business?: number;
  specialized_breeds?: string[];
  location: any;
  contact: any;
  certifications?: any[];
  gallery?: any[];
  description?: string;
  facilities?: string[];
  is_verified?: boolean;
  is_published?: boolean;
}

export interface PetListing {
  id: string;
  listing_id: string;
  breeder_id: string;
  breeder_name: string;
  pet_type: 'dog' | 'cat' | 'bird' | 'other';
  breed: string;
  sub_breed?: string | null;
  name?: string | null;
  gender: 'male' | 'female';
  date_of_birth: string;
  age_months?: number | null;
  age_display_text?: string | null;
  color: string;
  markings?: string | null;
  price: number;
  negotiable: boolean;
  lineage: any;
  health: any;
  temperament: any;
  registration: any;
  media: any;
  availability: 'available' | 'reserved' | 'sold';
  ready_to_leave: boolean;
  ready_date?: string | null;
  location: any;
  delivery_options: any;
  view_count: number;
  inquiry_count: number;
  is_published: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePetListingInput {
  listing_id: string;
  breeder_id: string;
  breeder_name: string;
  pet_type: 'dog' | 'cat' | 'bird' | 'other';
  breed: string;
  sub_breed?: string;
  name?: string;
  gender: 'male' | 'female';
  date_of_birth: string;
  age_months?: number;
  age_display_text?: string;
  color?: string;
  markings?: string;
  price: number;
  negotiable?: boolean;
  lineage?: any;
  health?: any;
  temperament?: any;
  registration?: any;
  media?: any;
  availability?: 'available' | 'reserved' | 'sold';
  ready_to_leave?: boolean;
  ready_date?: string;
  location?: any;
  delivery_options?: any;
  is_published?: boolean;
  is_featured?: boolean;
}

export interface AdoptionCenterProfile {
  id: string;
  center_id: string;
  vendor_id: string;
  center_name: string;
  registration_number?: string | null;
  type: 'shelter' | 'rescue' | 'ngo' | 'government';
  years_active: number;
  location: any;
  contact: any;
  capacity: number;
  current_animals: number;
  animal_types: string[];
  services: string[];
  adoption_process: any;
  volunteer_program: boolean;
  donation_accepted: boolean;
  gallery: any[];
  success_stories: any[];
  rating: number;
  total_adoptions: number;
  is_verified: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAdoptionCenterProfileInput {
  center_id: string;
  vendor_id: string;
  center_name: string;
  registration_number?: string;
  type: 'shelter' | 'rescue' | 'ngo' | 'government';
  years_active?: number;
  location: any;
  contact: any;
  capacity?: number;
  current_animals?: number;
  animal_types?: string[];
  services?: string[];
  adoption_process?: any;
  volunteer_program?: boolean;
  donation_accepted?: boolean;
  gallery?: any[];
  success_stories?: any[];
  is_verified?: boolean;
  is_published?: boolean;
}

export interface PetInquiry {
  id: string;
  inquiry_id: string;
  listing_id: string;
  customer_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  message: string;
  status: 'pending' | 'responded' | 'closed' | 'declined';
  responded_at?: string | null;
  responded_by?: string | null;
  response_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePetInquiryInput {
  inquiry_id: string;
  listing_id: string;
  customer_id?: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  message: string;
  status?: 'pending' | 'responded' | 'closed' | 'declined';
}

// ============================================================================
// REPOSITORY
// ============================================================================

export function getPetProfilePublishingRepository() {
  const client = getDbClient();

  return {
    // ========================================================================
    // BREEDER PROFILES
    // ========================================================================

    async createBreederProfile(input: CreateBreederProfileInput): Promise<BreederProfile> {
      const { data, error } = await client
        .from('breeder_profiles')
        .insert({
          breeder_id: input.breeder_id,
          vendor_id: input.vendor_id,
          business_name: input.business_name,
          owner_name: input.owner_name,
          license_number: input.license_number,
          kci_registration: input.kci_registration,
          years_in_business: input.years_in_business || 0,
          specialized_breeds: input.specialized_breeds || [],
          location: input.location || {},
          contact: input.contact || {},
          certifications: input.certifications || [],
          gallery: input.gallery || [],
          description: input.description || '',
          facilities: input.facilities || [],
          is_verified: input.is_verified || false,
          is_published: input.is_published !== undefined ? input.is_published : true
        })
        .select()
        .single();

      if (error) throw error;
      return data as BreederProfile;
    },

    async getBreederProfileByBreederId(breederId: string): Promise<BreederProfile | null> {
      const { data, error } = await client
        .from('breeder_profiles')
        .select('*')
        .eq('breeder_id', breederId)
        .maybeSingle();

      if (error) throw error;
      return data as BreederProfile | null;
    },

    async getBreederProfileByVendorId(vendorId: string): Promise<BreederProfile | null> {
      const { data, error } = await client
        .from('breeder_profiles')
        .select('*')
        .eq('vendor_id', vendorId)
        .maybeSingle();

      if (error) throw error;
      return data as BreederProfile | null;
    },

    // ========================================================================
    // PET LISTINGS
    // ========================================================================

    async createPetListing(input: CreatePetListingInput): Promise<PetListing> {
      const { data, error } = await client
        .from('pet_listings')
        .insert({
          listing_id: input.listing_id,
          breeder_id: input.breeder_id,
          breeder_name: input.breeder_name,
          pet_type: input.pet_type,
          breed: input.breed,
          sub_breed: input.sub_breed,
          name: input.name,
          gender: input.gender,
          date_of_birth: input.date_of_birth,
          age_months: input.age_months,
          age_display_text: input.age_display_text,
          color: input.color || '',
          markings: input.markings,
          price: input.price,
          negotiable: input.negotiable || false,
          lineage: input.lineage || {},
          health: input.health || {},
          temperament: input.temperament || {},
          registration: input.registration || {},
          media: input.media || {},
          availability: input.availability || 'available',
          ready_to_leave: input.ready_to_leave !== undefined ? input.ready_to_leave : true,
          ready_date: input.ready_date,
          location: input.location || {},
          delivery_options: input.delivery_options || {},
          is_published: input.is_published !== undefined ? input.is_published : true,
          is_featured: input.is_featured || false
        })
        .select()
        .single();

      if (error) throw error;
      return data as PetListing;
    },

    async getPetListingByListingId(listingId: string): Promise<PetListing | null> {
      const { data, error } = await client
        .from('pet_listings')
        .select('*')
        .eq('listing_id', listingId)
        .maybeSingle();

      if (error) throw error;
      return data as PetListing | null;
    },

    async getPetListings(filters?: {
      breed?: string;
      city?: string;
      minPrice?: number;
      maxPrice?: number;
      petType?: string;
    }): Promise<PetListing[]> {
      let query = client
        .from('pet_listings')
        .select('*')
        .eq('is_published', true)
        .eq('availability', 'available');

      if (filters?.petType) {
        query = query.eq('pet_type', filters.petType);
      }
      if (filters?.breed) {
        query = query.ilike('breed', `%${filters.breed}%`);
      }
      if (filters?.minPrice !== undefined) {
        query = query.gte('price', filters.minPrice);
      }
      if (filters?.maxPrice !== undefined) {
        query = query.lte('price', filters.maxPrice);
      }

      query = query.order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      let listings = (data || []) as PetListing[];
      
      // Filter by city (stored in JSONB location field)
      if (filters?.city) {
        listings = listings.filter((l: any) => 
          l.location?.city?.toLowerCase() === filters.city?.toLowerCase()
        );
      }

      return listings;
    },

    async updatePetListing(listingId: string, updates: {
      view_count?: number;
      inquiry_count?: number;
      availability?: 'available' | 'reserved' | 'sold';
      [key: string]: any;
    }): Promise<PetListing> {
      const updateData: any = {
        updated_at: new Date().toISOString(),
        ...updates
      };

      const { data, error } = await client
        .from('pet_listings')
        .update(updateData)
        .eq('listing_id', listingId)
        .select()
        .single();

      if (error) throw error;
      return data as PetListing;
    },

    // ========================================================================
    // ADOPTION CENTER PROFILES
    // ========================================================================

    async createAdoptionCenterProfile(input: CreateAdoptionCenterProfileInput): Promise<AdoptionCenterProfile> {
      const { data, error } = await client
        .from('adoption_center_profiles')
        .insert({
          center_id: input.center_id,
          vendor_id: input.vendor_id,
          center_name: input.center_name,
          registration_number: input.registration_number,
          type: input.type,
          years_active: input.years_active || 0,
          location: input.location || {},
          contact: input.contact || {},
          capacity: input.capacity || 50,
          current_animals: input.current_animals || 0,
          animal_types: input.animal_types || [],
          services: input.services || [],
          adoption_process: input.adoption_process || {},
          volunteer_program: input.volunteer_program || false,
          donation_accepted: input.donation_accepted || false,
          gallery: input.gallery || [],
          success_stories: input.success_stories || [],
          is_verified: input.is_verified || false,
          is_published: input.is_published !== undefined ? input.is_published : true
        })
        .select()
        .single();

      if (error) throw error;
      return data as AdoptionCenterProfile;
    },

    async getAdoptionCenters(filters?: {
      city?: string;
      type?: string;
    }): Promise<AdoptionCenterProfile[]> {
      let query = client
        .from('adoption_center_profiles')
        .select('*')
        .eq('is_published', true);

      if (filters?.type) {
        query = query.eq('type', filters.type);
      }

      query = query.order('rating', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      
      let centers = (data || []) as AdoptionCenterProfile[];
      
      // Filter by city (stored in JSONB location field)
      if (filters?.city) {
        centers = centers.filter((c: any) => 
          c.location?.city?.toLowerCase() === filters.city?.toLowerCase()
        );
      }

      return centers;
    },

    // ========================================================================
    // PET INQUIRIES
    // ========================================================================

    async createPetInquiry(input: CreatePetInquiryInput): Promise<PetInquiry> {
      const { data, error } = await client
        .from('pet_inquiries')
        .insert({
          inquiry_id: input.inquiry_id,
          listing_id: input.listing_id,
          customer_id: input.customer_id,
          customer_name: input.customer_name,
          customer_phone: input.customer_phone,
          customer_email: input.customer_email,
          message: input.message,
          status: input.status || 'pending'
        })
        .select()
        .single();

      if (error) throw error;
      return data as PetInquiry;
    }
  };
}


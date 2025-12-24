/**
 * ============================================================================
 * ADOPTION REPOSITORY
 * ============================================================================
 * 
 * Repository for adoption listings and applications data access.
 * Replaces: adoption:{id}, adoption:application:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * ✅ All queries use prepared statements
 * 
 * Date: 2025-01-27
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface AdoptionListing {
  id: string;
  listingId: string;
  vendorId: string;
  petName: string;
  petType: 'dog' | 'cat' | 'rabbit' | 'bird' | 'other';
  breed?: string;
  age?: number;
  ageUnit?: 'weeks' | 'months' | 'years';
  gender?: 'male' | 'female' | 'unknown';
  size?: 'small' | 'medium' | 'large' | 'extra_large';
  color?: string;
  description?: string;
  medicalHistory?: string;
  vaccinationStatus?: string;
  spayedNeutered?: boolean;
  microchipped?: boolean;
  specialNeeds?: string;
  photos: string[];
  videos: string[];
  adoptionFee: number;
  status: 'available' | 'pending' | 'adopted' | 'withdrawn';
  locationCity?: string;
  locationState?: string;
  contactEmail?: string;
  contactPhone?: string;
  requirements: Record<string, any>;
  applicationCount: number;
  createdAt: string;
  updatedAt: string;
  adoptedAt?: string;
}

export interface AdoptionApplication {
  id: string;
  applicationId: string;
  listingId: string;
  customerId: string;
  applicantName: string;
  applicantEmail: string;
  applicantPhone: string;
  applicantAddress?: string;
  applicationMessage?: string;
  previousPetExperience?: string;
  currentPets?: string;
  livingSituation?: string;
  homeOwnership?: string;
  yardSpace?: string;
  workSchedule?: string;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected' | 'withdrawn';
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class AdoptionRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  /**
   * Get listing by ID
   */
  async getListingById(listingId: string): Promise<AdoptionListing | null> {
    try {
      const { data, error } = await this.client
        .from('adoption_listings')
        .select('*')
        .or(`id.eq.${listingId},listing_id.eq.${listingId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapListingFromDb(data);
    } catch (error) {
      console.error('Error fetching adoption listing:', error);
      return null;
    }
  }

  /**
   * Get all listings (with optional filters)
   */
  async getAllListings(options?: {
    vendorId?: string;
    petType?: string;
    status?: string;
    locationCity?: string;
  }): Promise<AdoptionListing[]> {
    try {
      let query = this.client.from('adoption_listings').select('*');

      if (options?.vendorId) {
        query = query.eq('vendor_id', options.vendorId);
      }

      if (options?.petType) {
        query = query.eq('pet_type', options.petType);
      }

      if (options?.status) {
        query = query.eq('status', options.status);
      } else {
        query = query.eq('status', 'available');
      }

      if (options?.locationCity) {
        query = query.ilike('location_city', `%${options.locationCity}%`);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching adoption listings:', error);
        return [];
      }

      return (data || []).map(this.mapListingFromDb);
    } catch (error) {
      console.error('Error in getAllListings:', error);
      return [];
    }
  }

  /**
   * Create listing
   */
  async createListing(listingData: Partial<AdoptionListing>): Promise<AdoptionListing> {
    try {
      const listingId = `adopt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        listing_id: listingData.listingId || listingId,
        vendor_id: listingData.vendorId!,
        pet_name: listingData.petName!,
        pet_type: listingData.petType!,
        breed: listingData.breed || null,
        age: listingData.age || null,
        age_unit: listingData.ageUnit || null,
        gender: listingData.gender || null,
        size: listingData.size || null,
        color: listingData.color || null,
        description: listingData.description || null,
        medical_history: listingData.medicalHistory || null,
        vaccination_status: listingData.vaccinationStatus || null,
        spayed_neutered: listingData.spayedNeutered || null,
        microchipped: listingData.microchipped || null,
        special_needs: listingData.specialNeeds || null,
        photos: listingData.photos || [],
        videos: listingData.videos || [],
        adoption_fee: listingData.adoptionFee || 0,
        status: listingData.status || 'available',
        location_city: listingData.locationCity || null,
        location_state: listingData.locationState || null,
        contact_email: listingData.contactEmail || null,
        contact_phone: listingData.contactPhone || null,
        requirements: listingData.requirements || {},
        application_count: listingData.applicationCount || 0,
      };

      const { data, error } = await this.client
        .from('adoption_listings')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return this.mapListingFromDb(data);
    } catch (error) {
      console.error('Error creating adoption listing:', error);
      throw error;
    }
  }

  /**
   * Update listing
   */
  async updateListing(listingId: string, updates: Partial<AdoptionListing>): Promise<AdoptionListing | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.adoptedAt !== undefined) updateData.adopted_at = updates.adoptedAt;
      if (updates.applicationCount !== undefined) updateData.application_count = updates.applicationCount;

      const { data, error } = await this.client
        .from('adoption_listings')
        .update(updateData)
        .or(`id.eq.${listingId},listing_id.eq.${listingId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapListingFromDb(data);
    } catch (error) {
      console.error('Error updating adoption listing:', error);
      return null;
    }
  }

  /**
   * Get application by ID
   */
  async getApplicationById(applicationId: string): Promise<AdoptionApplication | null> {
    try {
      const { data, error } = await this.client
        .from('adoption_applications')
        .select('*')
        .or(`id.eq.${applicationId},application_id.eq.${applicationId}`)
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapApplicationFromDb(data);
    } catch (error) {
      console.error('Error fetching adoption application:', error);
      return null;
    }
  }

  /**
   * Get applications by listing
   */
  async getListingApplications(listingId: string): Promise<AdoptionApplication[]> {
    try {
      const { data, error } = await this.client
        .from('adoption_applications')
        .select('*')
        .eq('listing_id', listingId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching listing applications:', error);
        return [];
      }

      return (data || []).map(this.mapApplicationFromDb);
    } catch (error) {
      console.error('Error in getListingApplications:', error);
      return [];
    }
  }

  /**
   * Get applications by customer
   */
  async getCustomerApplications(customerId: string): Promise<AdoptionApplication[]> {
    try {
      const { data, error } = await this.client
        .from('adoption_applications')
        .select('*')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer applications:', error);
        return [];
      }

      return (data || []).map(this.mapApplicationFromDb);
    } catch (error) {
      console.error('Error in getCustomerApplications:', error);
      return [];
    }
  }

  /**
   * Create application
   */
  async createApplication(applicationData: Partial<AdoptionApplication>): Promise<AdoptionApplication> {
    try {
      const applicationId = `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const insertData: any = {
        application_id: applicationData.applicationId || applicationId,
        listing_id: applicationData.listingId!,
        customer_id: applicationData.customerId!,
        applicant_name: applicationData.applicantName!,
        applicant_email: applicationData.applicantEmail!,
        applicant_phone: applicationData.applicantPhone!,
        applicant_address: applicationData.applicantAddress || null,
        application_message: applicationData.applicationMessage || null,
        previous_pet_experience: applicationData.previousPetExperience || null,
        current_pets: applicationData.currentPets || null,
        living_situation: applicationData.livingSituation || null,
        home_ownership: applicationData.homeOwnership || null,
        yard_space: applicationData.yardSpace || null,
        work_schedule: applicationData.workSchedule || null,
        status: applicationData.status || 'pending',
      };

      const { data, error } = await this.client
        .from('adoption_applications')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        throw error;
      }

      // Increment application count on listing
      const listing = await this.getListingById(applicationData.listingId!);
      if (listing) {
        await this.updateListing(applicationData.listingId!, {
          applicationCount: listing.applicationCount + 1,
        });
      }

      return this.mapApplicationFromDb(data);
    } catch (error) {
      console.error('Error creating adoption application:', error);
      throw error;
    }
  }

  /**
   * Update application
   */
  async updateApplication(applicationId: string, updates: Partial<AdoptionApplication>): Promise<AdoptionApplication | null> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.reviewedBy !== undefined) updateData.reviewed_by = updates.reviewedBy;
      if (updates.reviewedAt !== undefined) updateData.reviewed_at = updates.reviewedAt;
      if (updates.rejectionReason !== undefined) updateData.rejection_reason = updates.rejectionReason;
      if (updates.approvedAt !== undefined) updateData.approved_at = updates.approvedAt;

      const { data, error } = await this.client
        .from('adoption_applications')
        .update(updateData)
        .or(`id.eq.${applicationId},application_id.eq.${applicationId}`)
        .select()
        .single();

      if (error || !data) {
        return null;
      }

      return this.mapApplicationFromDb(data);
    } catch (error) {
      console.error('Error updating adoption application:', error);
      return null;
    }
  }

  /**
   * Map database row to AdoptionListing
   */
  private mapListingFromDb(row: any): AdoptionListing {
    return {
      id: row.id,
      listingId: row.listing_id,
      vendorId: row.vendor_id,
      petName: row.pet_name,
      petType: row.pet_type,
      breed: row.breed || undefined,
      age: row.age || undefined,
      ageUnit: row.age_unit || undefined,
      gender: row.gender || undefined,
      size: row.size || undefined,
      color: row.color || undefined,
      description: row.description || undefined,
      medicalHistory: row.medical_history || undefined,
      vaccinationStatus: row.vaccination_status || undefined,
      spayedNeutered: row.spayed_neutered || undefined,
      microchipped: row.microchipped || undefined,
      specialNeeds: row.special_needs || undefined,
      photos: row.photos || [],
      videos: row.videos || [],
      adoptionFee: parseFloat(row.adoption_fee || 0),
      status: row.status,
      locationCity: row.location_city || undefined,
      locationState: row.location_state || undefined,
      contactEmail: row.contact_email || undefined,
      contactPhone: row.contact_phone || undefined,
      requirements: row.requirements || {},
      applicationCount: row.application_count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      adoptedAt: row.adopted_at || undefined,
    };
  }

  /**
   * Map database row to AdoptionApplication
   */
  private mapApplicationFromDb(row: any): AdoptionApplication {
    return {
      id: row.id,
      applicationId: row.application_id,
      listingId: row.listing_id,
      customerId: row.customer_id,
      applicantName: row.applicant_name,
      applicantEmail: row.applicant_email,
      applicantPhone: row.applicant_phone,
      applicantAddress: row.applicant_address || undefined,
      applicationMessage: row.application_message || undefined,
      previousPetExperience: row.previous_pet_experience || undefined,
      currentPets: row.current_pets || undefined,
      livingSituation: row.living_situation || undefined,
      homeOwnership: row.home_ownership || undefined,
      yardSpace: row.yard_space || undefined,
      workSchedule: row.work_schedule || undefined,
      status: row.status,
      reviewedBy: row.reviewed_by || undefined,
      reviewedAt: row.reviewed_at || undefined,
      rejectionReason: row.rejection_reason || undefined,
      approvedAt: row.approved_at || undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

let adoptionRepositoryInstance: AdoptionRepository | null = null;

export function getAdoptionRepository(): AdoptionRepository {
  if (!adoptionRepositoryInstance) {
    adoptionRepositoryInstance = new AdoptionRepository();
  }
  return adoptionRepositoryInstance;
}


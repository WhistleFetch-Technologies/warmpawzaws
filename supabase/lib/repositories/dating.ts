/**
 * ============================================================================
 * DATING REPOSITORY
 * ============================================================================
 * 
 * Repository for dating & mating service data access.
 * Replaces: dating_profile:{type}:{id}, dating_match:{id} KV keys
 * 
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 * 
 * Date: 2025-01-23
 * ============================================================================
 */

import { getDbClient, selectQuery, insertQuery, updateQuery } from "../db.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface DatingProfilePet {
  id: string;
  profile_id: string;
  pet_id: string;
  customer_id: string;
  name: string;
  breed: string;
  age?: number | null;
  gender?: string | null;
  photos: any[];
  temperament: string;
  vaccinated: boolean;
  bio?: string | null;
  looking_for: string;
  location?: any | null;
  is_active: boolean;
  likes: string[];
  dislikes: string[];
  matches: string[];
  preferences?: any | null;
  flagged: boolean;
  suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatingProfileOwner {
  id: string;
  profile_id: string;
  customer_id: string;
  name: string;
  age?: number | null;
  photos: any[];
  bio?: string | null;
  pets: any[];
  interests: any[];
  location?: any | null;
  is_active: boolean;
  likes: string[];
  dislikes: string[];
  matches: string[];
  preferences?: any | null;
  flagged: boolean;
  suspended: boolean;
  created_at: string;
  updated_at: string;
}

export interface DatingMatch {
  id: string;
  match_id: string;
  profile_type: 'pet' | 'owner';
  profile1_id: string;
  profile2_id: string;
  customer1_id: string;
  customer2_id: string;
  status: string;
  chat_unlocked: boolean;
  chat_unlocked_by?: string | null;
  chat_unlocked_at?: string | null;
  chat_channel_arn?: string | null;
  chat_channel_name?: string | null;
  chime_app_instance_arn?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DatingMeetup {
  id: string;
  meetup_id: string;
  match_id: string;
  initiated_by: string;
  customer1_id: string;
  customer2_id: string;
  cafe_vendor_id?: string | null;
  booking_id?: string | null;
  scheduled_date: string;
  scheduled_time: string;
  notes?: string | null;
  status: string;
  feedback1?: any | null;
  feedback2?: any | null;
  created_at: string;
  updated_at: string;
}

export interface MatingAppointment {
  id: string;
  appointment_id: string;
  match_id: string;
  requested_by: string;
  customer1_id: string;
  customer2_id: string;
  pet1_id?: string | null;
  pet2_id?: string | null;
  vet_vendor_id: string;
  booking_id?: string | null;
  scheduled_date: string;
  scheduled_time: string;
  notes?: string | null;
  status: string;
  feedback1?: any | null;
  feedback2?: any | null;
  created_at: string;
  updated_at: string;
}

export class DatingRepository {
  private client: SupabaseClient;

  constructor(client?: SupabaseClient) {
    this.client = client || getDbClient();
  }

  // ============================================
  // PET PROFILES
  // ============================================

  async createPetProfile(input: Partial<DatingProfilePet>): Promise<DatingProfilePet> {
    const results = await insertQuery<DatingProfilePet>("dating_profiles_pet", {
      ...input,
      likes: input.likes || [],
      dislikes: input.dislikes || [],
      matches: input.matches || [],
      photos: input.photos || [],
      preferences: input.preferences || {},
      is_active: input.is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to create pet profile");
    }
    
    return results[0];
  }

  async findPetProfileByProfileId(profileId: string): Promise<DatingProfilePet | null> {
    const results = await selectQuery<DatingProfilePet>("dating_profiles_pet", { profile_id: profileId }, { limit: 1 });
    return results[0] || null;
  }

  async findPetProfileByPetId(petId: string): Promise<DatingProfilePet | null> {
    const results = await selectQuery<DatingProfilePet>("dating_profiles_pet", { pet_id: petId }, { limit: 1 });
    return results[0] || null;
  }

  async findPetProfilesByCustomer(customerId: string): Promise<DatingProfilePet[]> {
    return selectQuery<DatingProfilePet>("dating_profiles_pet", { customer_id: customerId, is_active: true });
  }

  async findActivePetProfiles(filters?: { breed?: string; lookingFor?: string }): Promise<DatingProfilePet[]> {
    let query = this.client
      .from('dating_profiles_pet')
      .select('*')
      .eq('is_active', true)
      .eq('flagged', false)
      .eq('suspended', false);
    
    if (filters?.breed) {
      query = query.eq('breed', filters.breed);
    }
    
    if (filters?.lookingFor) {
      query = query.eq('looking_for', filters.lookingFor);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updatePetProfile(profileId: string, updates: Partial<DatingProfilePet>): Promise<DatingProfilePet> {
    const results = await updateQuery<DatingProfilePet>(
      "dating_profiles_pet",
      { profile_id: profileId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Pet profile not found: ${profileId}`);
    }
    
    return results[0];
  }

  // ============================================
  // OWNER PROFILES
  // ============================================

  async createOwnerProfile(input: Partial<DatingProfileOwner>): Promise<DatingProfileOwner> {
    const results = await insertQuery<DatingProfileOwner>("dating_profiles_owner", {
      ...input,
      likes: input.likes || [],
      dislikes: input.dislikes || [],
      matches: input.matches || [],
      photos: input.photos || [],
      pets: input.pets || [],
      interests: input.interests || [],
      preferences: input.preferences || {},
      is_active: input.is_active !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to create owner profile");
    }
    
    return results[0];
  }

  async findOwnerProfileByProfileId(profileId: string): Promise<DatingProfileOwner | null> {
    const results = await selectQuery<DatingProfileOwner>("dating_profiles_owner", { profile_id: profileId }, { limit: 1 });
    return results[0] || null;
  }

  async findOwnerProfileByCustomer(customerId: string): Promise<DatingProfileOwner | null> {
    const results = await selectQuery<DatingProfileOwner>("dating_profiles_owner", { customer_id: customerId }, { limit: 1 });
    return results[0] || null;
  }

  async findActiveOwnerProfiles(): Promise<DatingProfileOwner[]> {
    const { data, error } = await this.client
      .from('dating_profiles_owner')
      .select('*')
      .eq('is_active', true)
      .eq('flagged', false)
      .eq('suspended', false);
    
    if (error) throw error;
    return data || [];
  }

  async updateOwnerProfile(profileId: string, updates: Partial<DatingProfileOwner>): Promise<DatingProfileOwner> {
    const results = await updateQuery<DatingProfileOwner>(
      "dating_profiles_owner",
      { profile_id: profileId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Owner profile not found: ${profileId}`);
    }
    
    return results[0];
  }

  // ============================================
  // MATCHES
  // ============================================

  async createMatch(input: Partial<DatingMatch>): Promise<DatingMatch> {
    const results = await insertQuery<DatingMatch>("dating_matches", {
      ...input,
      status: input.status || 'active',
      chat_unlocked: input.chat_unlocked || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to create match");
    }
    
    return results[0];
  }

  async findMatchByMatchId(matchId: string): Promise<DatingMatch | null> {
    const results = await selectQuery<DatingMatch>("dating_matches", { match_id: matchId }, { limit: 1 });
    return results[0] || null;
  }

  async findMatchesByCustomer(customerId: string): Promise<DatingMatch[]> {
    const { data, error } = await this.client
      .from('dating_matches')
      .select('*')
      .or(`customer1_id.eq.${customerId},customer2_id.eq.${customerId}`)
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return data || [];
  }

  async updateMatch(matchId: string, updates: Partial<DatingMatch>): Promise<DatingMatch> {
    const results = await updateQuery<DatingMatch>(
      "dating_matches",
      { match_id: matchId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Match not found: ${matchId}`);
    }
    
    return results[0];
  }

  // ============================================
  // MEETUPS
  // ============================================

  async createMeetup(input: Partial<DatingMeetup>): Promise<DatingMeetup> {
    const results = await insertQuery<DatingMeetup>("dating_meetups", {
      ...input,
      status: input.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to create meetup");
    }
    
    return results[0];
  }

  async findMeetupByMeetupId(meetupId: string): Promise<DatingMeetup | null> {
    const results = await selectQuery<DatingMeetup>("dating_meetups", { meetup_id: meetupId }, { limit: 1 });
    return results[0] || null;
  }

  async findMeetupsByMatch(matchId: string): Promise<DatingMeetup[]> {
    return selectQuery<DatingMeetup>("dating_meetups", { match_id: matchId });
  }

  async updateMeetup(meetupId: string, updates: Partial<DatingMeetup>): Promise<DatingMeetup> {
    const results = await updateQuery<DatingMeetup>(
      "dating_meetups",
      { meetup_id: meetupId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Meetup not found: ${meetupId}`);
    }
    
    return results[0];
  }

  // ============================================
  // MATING APPOINTMENTS
  // ============================================

  async createMatingAppointment(input: Partial<MatingAppointment>): Promise<MatingAppointment> {
    const results = await insertQuery<MatingAppointment>("mating_appointments", {
      ...input,
      status: input.status || 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (!results[0]) {
      throw new Error("Failed to create mating appointment");
    }
    
    return results[0];
  }

  async findMatingAppointmentByAppointmentId(appointmentId: string): Promise<MatingAppointment | null> {
    const results = await selectQuery<MatingAppointment>("mating_appointments", { appointment_id: appointmentId }, { limit: 1 });
    return results[0] || null;
  }

  async findMatingAppointmentsByMatch(matchId: string): Promise<MatingAppointment[]> {
    return selectQuery<MatingAppointment>("mating_appointments", { match_id: matchId });
  }

  async updateMatingAppointment(appointmentId: string, updates: Partial<MatingAppointment>): Promise<MatingAppointment> {
    const results = await updateQuery<MatingAppointment>(
      "mating_appointments",
      { appointment_id: appointmentId },
      {
        ...updates,
        updated_at: new Date().toISOString(),
      }
    );
    
    if (!results[0]) {
      throw new Error(`Mating appointment not found: ${appointmentId}`);
    }
    
    return results[0];
  }
}

let repositoryInstance: DatingRepository | null = null;

export function getDatingRepository(): DatingRepository {
  if (!repositoryInstance) {
    repositoryInstance = new DatingRepository();
  }
  return repositoryInstance;
}


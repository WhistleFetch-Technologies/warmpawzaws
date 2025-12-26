/**
 * ============================================================================
 * PET SUGGESTION SYSTEM - SQL-ONLY VERSION
 * ============================================================================
 * 
 * ✅ SQL-ONLY: Removed all KV usage, using SQL repositories only
 * 
 * Features:
 * - Matches pets (for adoption or buying) based on questionnaire
 * - Scoring algorithm for pet matching
 * - Saves suggestions for future reference
 * 
 * CHANGES:
 * - Removed `kv` imports
 * - Replaced all `kv.get()`, `kv.set()`, `kv.getByPrefix()` with SQL queries
 * - Uses `pets` table (customer pets)
 * - Uses `adoption_listings` table (adoption pets)
 * - Uses `pet_listings` table (breeder pets for sale)
 * - Uses `PetsRepository`, `AdoptionRepository`
 * - Stores suggestions in `platform_settings` JSONB
 * 
 * Date: 2025-01-28
 * Migration: Batch 13 - KV to SQL (12 KV operations removed)
 * ============================================================================
 */

import { Hono } from "npm:hono";
import { getDbClient } from '../../lib/db.ts';
import { getPetsRepository } from '../../lib/repositories/pets.ts';
import { getAdoptionRepository } from '../../lib/repositories/adoption.ts';
import { getCustomersRepository } from '../../lib/repositories/customers.ts';

export function registerPetSuggestionSystem(app: Hono) {
  /**
   * POST /make-server-3dd53475/customer/pet-suggestions
   * Get pet suggestions based on questionnaire answers
   */
  app.post("/make-server-3dd53475/customer/pet-suggestions", async (c) => {
    try {
      const {
        phone,
        questionnaireData
      } = await c.req.json();

      if (!questionnaireData) {
        return c.json({ error: 'Questionnaire data is required' }, 400);
      }

      // Extract questionnaire answers
      const {
        timeCommitment,
        children,
        otherPets,
        allergies,
        dogSize,
        energyLevel,
        importantTraits,
        selectedBreeds,
        livingSituation,
        experience
      } = questionnaireData;

      // ✅ SQL: Get all available pets from different sources
      const db = getDbClient();
      
      // Get customer pets (for reference, not for adoption)
      const petsRepo = getPetsRepository();
      
      // Get adoption listings
      const adoptionRepo = getAdoptionRepository();
      const adoptionListings = await adoptionRepo.getAllListings({ status: 'available' });
      
      // Get pet listings (breeder pets for sale)
      const { data: petListings } = await db
        .from('pet_listings')
        .select('*')
        .eq('availability', 'available')
        .limit(100);

      // Combine all pets
      const combinedPets: any[] = [];
      
      // Add adoption pets
      adoptionListings.forEach((listing: any) => {
        combinedPets.push({
          id: listing.id,
          source: 'adoption',
          name: listing.petName,
          breed: listing.breed,
          size: listing.size,
          age: listing.age,
          gender: listing.gender,
          energyLevel: null, // Would need to add to schema
          goodWithChildren: null,
          goodWithOtherPets: null,
          hypoallergenic: null,
          traits: [],
          suitableFor: [],
          suitableForBeginners: null,
          vaccinationStatus: listing.vaccinationStatus,
          healthStatus: 'good',
          isActive: listing.status === 'available',
          status: listing.status
        });
      });
      
      // Add breeder pets
      (petListings || []).forEach((listing: any) => {
        combinedPets.push({
          id: listing.id,
          source: 'breeder',
          name: listing.name,
          breed: listing.breed,
          size: null, // Would need to calculate from breed
          age: listing.age_months,
          gender: listing.gender,
          energyLevel: listing.temperament?.energy_level,
          goodWithChildren: listing.temperament?.good_with_children,
          goodWithOtherPets: listing.temperament?.good_with_other_pets,
          hypoallergenic: listing.health?.hypoallergenic,
          traits: listing.temperament?.traits || [],
          suitableFor: listing.location?.suitable_for || [],
          suitableForBeginners: listing.temperament?.suitable_for_beginners,
          vaccinationStatus: listing.health?.vaccination_status,
          healthStatus: listing.health?.status || 'good',
          isActive: listing.availability === 'available',
          status: listing.availability
        });
      });

      // Score and match pets based on questionnaire
      const scoredPets: any[] = [];

      for (const pet of combinedPets) {
        if (!pet || !pet.isActive || pet.status !== 'available') continue;

        let score = 0;
        const matchReasons: string[] = [];

        // Size matching
        if (dogSize && pet.size) {
          const petSize = pet.size.toLowerCase();
          const preferredSize = dogSize.toLowerCase();
          if (petSize === preferredSize || 
              (preferredSize === 'medium' && (petSize === 'small' || petSize === 'large'))) {
            score += 20;
            matchReasons.push('Size match');
          }
        }

        // Energy level matching
        if (energyLevel && pet.energyLevel) {
          const petEnergy = pet.energyLevel.toLowerCase();
          const preferredEnergy = energyLevel.toLowerCase();
          if (petEnergy === preferredEnergy) {
            score += 20;
            matchReasons.push('Energy level match');
          }
        }

        // Breed matching
        if (selectedBreeds && selectedBreeds.length > 0 && pet.breed) {
          const petBreed = pet.breed.toLowerCase();
          if (selectedBreeds.some((breed: string) => breed.toLowerCase() === petBreed)) {
            score += 30;
            matchReasons.push('Breed preference match');
          }
        }

        // Living situation matching
        if (livingSituation && pet.suitableFor) {
          const suitableFor = Array.isArray(pet.suitableFor) ? pet.suitableFor : [pet.suitableFor];
          if (suitableFor.includes(livingSituation)) {
            score += 15;
            matchReasons.push('Living situation compatible');
          }
        }

        // Children compatibility
        if (children === 'yes' && pet.goodWithChildren !== false) {
          score += 10;
          matchReasons.push('Good with children');
        }

        // Other pets compatibility
        if (otherPets === 'yes' && pet.goodWithOtherPets !== false) {
          score += 10;
          matchReasons.push('Good with other pets');
        }

        // Allergy considerations
        if (allergies === 'yes' && pet.hypoallergenic === true) {
          score += 15;
          matchReasons.push('Hypoallergenic');
        }

        // Trait matching
        if (importantTraits && importantTraits.length > 0 && pet.traits) {
          const petTraits = Array.isArray(pet.traits) ? pet.traits : [];
          const matchingTraits = importantTraits.filter((trait: string) =>
            petTraits.some((pt: string) => pt.toLowerCase().includes(trait.toLowerCase()))
          );
          if (matchingTraits.length > 0) {
            score += matchingTraits.length * 5;
            matchReasons.push(`Traits: ${matchingTraits.join(', ')}`);
          }
        }

        // Experience level matching
        if (experience === 'first_time' && pet.suitableForBeginners === true) {
          score += 10;
          matchReasons.push('Suitable for beginners');
        }

        // Vaccination status bonus
        if (pet.vaccinationStatus === 'complete' || pet.vaccinationStatus === 'fully_vaccinated') {
          score += 5;
          matchReasons.push('Fully vaccinated');
        }

        // Health status bonus
        if (pet.healthStatus === 'excellent' || pet.healthStatus === 'good') {
          score += 5;
        }

        if (score > 0) {
          scoredPets.push({
            ...pet,
            matchScore: score,
            matchReasons,
            matchPercentage: Math.min(100, Math.round(score))
          });
        }
      }

      // Sort by match score (highest first)
      scoredPets.sort((a, b) => b.matchScore - a.matchScore);

      // Return top 20 matches
      const topMatches = scoredPets.slice(0, 20);

      // ✅ SQL: Save suggestion in platform_settings
      const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const suggestionRecord = {
        id: suggestionId,
        phone,
        questionnaireData,
        matches: topMatches.map((p: any) => ({ petId: p.id, score: p.matchScore })),
        createdAt: new Date().toISOString()
      };

      // Get or create pet_suggestions setting
      const { data: existing } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'pet_suggestions')
        .single();

      const suggestions = existing?.setting_value?.suggestions || [];
      suggestions.push(suggestionRecord);
      
      // Keep only last 1000 suggestions
      if (suggestions.length > 1000) {
        suggestions.splice(0, suggestions.length - 1000);
      }

      await db
        .from('platform_settings')
        .upsert({
          setting_key: 'pet_suggestions',
          setting_value: { suggestions },
          setting_type: 'object',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'setting_key'
        });

      return c.json({
        success: true,
        suggestions: topMatches,
        count: topMatches.length,
        suggestionId
      });
    } catch (error) {
      console.error('Error generating pet suggestions:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/pet-suggestions/:suggestionId
   * Get saved pet suggestions
   */
  app.get("/make-server-3dd53475/customer/pet-suggestions/:suggestionId", async (c) => {
    try {
      const { suggestionId } = c.req.param();

      // ✅ SQL: Get suggestion from platform_settings
      const db = getDbClient();
      const { data: settings } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'pet_suggestions')
        .single();

      const suggestions = settings?.setting_value?.suggestions || [];
      const suggestion = suggestions.find((s: any) => s.id === suggestionId);

      if (!suggestion) {
        return c.json({ error: 'Suggestion not found' }, 404);
      }

      // Fetch full pet details for matches
      const matchesWithDetails = [];
      for (const match of suggestion.matches || []) {
        // Try to get from adoption_listings or pet_listings
        const { data: adoptionPet } = await db
          .from('adoption_listings')
          .select('*')
          .eq('id', match.petId)
          .single();

        const { data: breederPet } = await db
          .from('pet_listings')
          .select('*')
          .eq('id', match.petId)
          .single();

        const pet = adoptionPet || breederPet;
        if (pet) {
          matchesWithDetails.push({
            ...pet,
            matchScore: match.score
          });
        }
      }

      return c.json({
        success: true,
        suggestion: {
          ...suggestion,
          matches: matchesWithDetails
        }
      });
    } catch (error) {
      console.error('Error fetching pet suggestions:', error);
      return c.json({ error: String(error) }, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/:phone/pet-suggestions
   * Get all pet suggestions for a customer
   */
  app.get("/make-server-3dd53475/customer/:phone/pet-suggestions", async (c) => {
    try {
      const { phone } = c.req.param();

      // ✅ SQL: Get suggestions from platform_settings
      const db = getDbClient();
      const { data: settings } = await db
        .from('platform_settings')
        .select('*')
        .eq('setting_key', 'pet_suggestions')
        .single();

      const allSuggestions = settings?.setting_value?.suggestions || [];
      const suggestions = allSuggestions.filter((s: any) => s.phone === phone);

      // Sort by creation date (newest first)
      suggestions.sort((a: any, b: any) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return c.json({
        success: true,
        suggestions,
        count: suggestions.length
      });
    } catch (error) {
      console.error('Error fetching customer pet suggestions:', error);
      return c.json({ error: String(error) }, 500);
    }
  });
}

export default registerPetSuggestionSystem;


import { Hono } from "npm:hono";
import * as kv from "./kv_store.tsx";
import { sendSuccess, sendError } from "./response-utils.ts";

/**
 * PET SUGGESTION SYSTEM
 * Matches pets (for adoption or buying) based on customer questionnaire answers
 * Used in customer onboarding journey (planning flow)
 */

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
        return sendError(c, 'Questionnaire data is required', 400);
      }

      // Extract questionnaire answers
      const {
        timeCommitment, // 'low' | 'medium' | 'high'
        children, // 'yes' | 'no'
        otherPets, // 'yes' | 'no'
        allergies, // 'yes' | 'no'
        dogSize, // 'small' | 'medium' | 'large'
        energyLevel, // 'low' | 'medium' | 'high'
        importantTraits, // Array of trait strings
        selectedBreeds, // Array of breed names
        livingSituation, // 'apartment' | 'house_yard' | 'house_no_yard'
        experience // 'first_time' | 'experienced'
      } = questionnaireData;

      // Get all available pets (from breeders and adoption centers)
      const allPets = await kv.getByPrefix('pet_profile:') || [];
      const vendorPets = await kv.getByPrefix('vendor:pet:') || [];
      const adoptionPets = await kv.getByPrefix('adoption:pet:') || [];

      // Combine all pets
      const combinedPets = [...allPets, ...vendorPets, ...adoptionPets];

      // Score and match pets based on questionnaire
      const scoredPets = [];

      for (const pet of combinedPets) {
        if (!pet || !pet.isActive || pet.status !== 'available') continue;

        let score = 0;
        const matchReasons = [];

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
          } else if (Math.abs(['low', 'medium', 'high'].indexOf(petEnergy) - 
                              ['low', 'medium', 'high'].indexOf(preferredEnergy)) === 1) {
            score += 10;
            matchReasons.push('Similar energy level');
          }
        }

        // Breed matching (if user selected specific breeds)
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
        } else if (children === 'no' && pet.goodWithChildren === false) {
          score += 5;
        }

        // Other pets compatibility
        if (otherPets === 'yes' && pet.goodWithOtherPets !== false) {
          score += 10;
          matchReasons.push('Good with other pets');
        } else if (otherPets === 'no' && pet.goodWithOtherPets === false) {
          score += 5;
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

        // Age consideration (prefer younger pets for first-time owners)
        if (experience === 'first_time' && pet.age && pet.age < 2) {
          score += 5;
        }

        // Vaccination status bonus
        if (pet.vaccinationStatus === 'complete' || pet.fullyVaccinated === true) {
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

      // Save questionnaire and suggestions for future reference
      const suggestionId = `suggestion_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      const suggestionRecord = {
        id: suggestionId,
        phone,
        questionnaireData,
        matches: topMatches.map(p => ({ petId: p.id, score: p.matchScore })),
        createdAt: new Date().toISOString()
      };

      await kv.set(`pet_suggestion:${suggestionId}`, suggestionRecord);

      // Index by phone
      const phoneSuggestionsKey = `customer:${phone}:pet_suggestions`;
      const phoneSuggestions = await kv.get(phoneSuggestionsKey) || [];
      phoneSuggestions.push(suggestionId);
      await kv.set(phoneSuggestionsKey, phoneSuggestions);

      return sendSuccess(c, {
        suggestions: topMatches,
        count: topMatches.length,
        suggestionId
      });
    } catch (error) {
      console.error('Error generating pet suggestions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/pet-suggestions/:suggestionId
   * Get saved pet suggestions
   */
  app.get("/make-server-3dd53475/customer/pet-suggestions/:suggestionId", async (c) => {
    try {
      const { suggestionId } = c.req.param();

      const suggestion = await kv.get(`pet_suggestion:${suggestionId}`);
      if (!suggestion) {
        return sendError(c, 'Suggestion not found', 404);
      }

      // Fetch full pet details for matches
      const matchesWithDetails = [];
      for (const match of suggestion.matches || []) {
        const pet = await kv.get(`pet_profile:${match.petId}`) ||
                   await kv.get(`vendor:pet:${match.petId}`) ||
                   await kv.get(`adoption:pet:${match.petId}`);
        if (pet) {
          matchesWithDetails.push({
            ...pet,
            matchScore: match.score
          });
        }
      }

      return sendSuccess(c, {
        suggestion: {
          ...suggestion,
          matches: matchesWithDetails
        }
      });
    } catch (error) {
      console.error('Error fetching pet suggestions:', error);
      return sendError(c, error, 500);
    }
  });

  /**
   * GET /make-server-3dd53475/customer/:phone/pet-suggestions
   * Get all pet suggestions for a customer
   */
  app.get("/make-server-3dd53475/customer/:phone/pet-suggestions", async (c) => {
    try {
      const { phone } = c.req.param();

      const phoneSuggestionsKey = `customer:${phone}:pet_suggestions`;
      const suggestionIds = await kv.get(phoneSuggestionsKey) || [];

      const suggestions = [];
      for (const suggestionId of suggestionIds) {
        const suggestion = await kv.get(`pet_suggestion:${suggestionId}`);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      }

      // Sort by creation date (newest first)
      suggestions.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      return sendSuccess(c, {
        suggestions,
        count: suggestions.length
      });
    } catch (error) {
      console.error('Error fetching customer pet suggestions:', error);
      return sendError(c, error, 500);
    }
  });
}


/**
 * Shared loyalty response fields for pet save handlers (action_sources middleware).
 */

import {
  petPayloadHasVaccinations,
  petVaccinationsMeaningfullyUpdated,
} from './pet-vaccination-loyalty';

export type PetLoyaltyPetRef = { petId: string };

export type PetLoyaltyBatchState = {
  loyaltyEligibleCreates: PetLoyaltyPetRef[];
  loyaltyEligibleVaccinationUpdates: PetLoyaltyPetRef[];
};

export function createEmptyPetLoyaltyBatchState(): PetLoyaltyBatchState {
  return {
    loyaltyEligibleCreates: [],
    loyaltyEligibleVaccinationUpdates: [],
  };
}

export function recordPetInsertLoyalty(
  state: PetLoyaltyBatchState,
  petId: string,
  payload: Record<string, unknown>
): void {
  const id = String(petId);
  state.loyaltyEligibleCreates.push({ petId: id });
  if (petPayloadHasVaccinations(payload)) {
    state.loyaltyEligibleVaccinationUpdates.push({ petId: id });
  }
}

export function recordPetUpdateLoyalty(
  state: PetLoyaltyBatchState,
  petId: string,
  beforePet: Record<string, unknown>,
  afterPet: Record<string, unknown>,
  payload: Record<string, unknown>
): void {
  const payloadHadVac = petPayloadHasVaccinations(payload);
  if (
    petVaccinationsMeaningfullyUpdated(beforePet, afterPet, payloadHadVac)
  ) {
    state.loyaltyEligibleVaccinationUpdates.push({ petId: String(petId) });
  }
}

/** Single-pet create response fields (POST /pets). */
export function buildSinglePetCreateLoyaltyFields(
  customerId: string,
  petId: string,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const state = createEmptyPetLoyaltyBatchState();
  recordPetInsertLoyalty(state, petId, payload);
  return buildPetLoyaltyResponseFields(state, customerId, petId);
}

/** Single-pet update response fields (PUT /pets/:petId). */
export function buildSinglePetUpdateLoyaltyFields(
  customerId: string,
  petId: string,
  beforePet: Record<string, unknown>,
  afterPet: Record<string, unknown>,
  payload: Record<string, unknown>
): Record<string, unknown> {
  const state = createEmptyPetLoyaltyBatchState();
  recordPetUpdateLoyalty(state, petId, beforePet, afterPet, payload);
  return buildPetLoyaltyResponseFields(state, customerId, petId);
}

export function buildPetLoyaltyResponseFields(
  state: PetLoyaltyBatchState,
  customerId: string,
  primaryPetId?: string | null
): Record<string, unknown> {
  const creates = state.loyaltyEligibleCreates;
  const vacUpdates = state.loyaltyEligibleVaccinationUpdates;
  const petId =
    primaryPetId ??
    creates[0]?.petId ??
    vacUpdates[0]?.petId ??
    null;

  return {
    customerId,
    petId,
    petCreated: creates.length > 0,
    vaccinationUpdated: vacUpdates.length > 0,
    loyaltyEligibleCreates: creates,
    loyaltyEligibleVaccinationUpdates: vacUpdates,
  };
}

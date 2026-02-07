/**
 * Build Test File for Three Components
 * This file imports and tests the three main components to verify they compile correctly
 */

import { RelocationBookingRouter } from './components/customer/relocation/RelocationBookingRouter';
import { PetProfile } from './components/customer/PetProfile';
import { VetBookingRouter } from './components/customer/vet/VetBookingRouter';

// Type verification - ensures components are properly typed
type RelocationComponent = typeof RelocationBookingRouter;
type PetProfileComponent = typeof PetProfile;
type VetComponent = typeof VetBookingRouter;

// Export to ensure they're used (prevents unused import warnings)
export type {
  RelocationComponent,
  PetProfileComponent,
  VetComponent
};

// Test that components can be referenced
const testComponents = {
  RelocationBookingRouter,
  PetProfile,
  VetBookingRouter
};

export default testComponents;

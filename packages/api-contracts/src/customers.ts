/**
 * ============================================================================
 * CUSTOMER API CONTRACTS
 * ============================================================================
 */

import { z } from 'zod';

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

const ProfileCoordinatesSchema = z.union([
  z.object({ lat: z.number(), lng: z.number() }),
  z.object({ latitude: z.number(), longitude: z.number() }),
  z.string().min(2, 'Invalid coordinates'),
]);

export const UpdateCustomerProfileRequestSchema = z.object({
  firstName: z.string().min(1, 'First name required').max(100, 'First name too long').optional(),
  lastName: z.string().min(1, 'Last name required').max(100, 'Last name too long').optional(),
  email: z.string().email('Invalid email format').optional(),
  address: z.string().max(500, 'Address too long').optional(),
  pincode: z.string().regex(/^\d{6}$/, 'Invalid pincode format').optional(),
  city: z.string().max(100, 'City too long').optional(),
  state: z.string().max(100, 'State too long').optional(),
  houseNo: z.string().max(200, 'House number too long').optional(),
  floor: z.string().max(100, 'Floor too long').optional(),
  photo: z.string().url('Invalid photo URL').optional(),
  /** From Google Places / device location — persisted on `customers` and default `customer_addresses` row */
  latitude: z.number().gte(-90).lte(90).nullish(),
  longitude: z.number().gte(-180).lte(180).nullish(),
  coordinates: ProfileCoordinatesSchema.nullish(),
});

const AddPetItemSchema = z
  .object({
    name: z.string().min(1, 'Pet name required').max(100, 'Pet name too long'),
    type: z.enum(['Dog', 'Cat'], {
      errorMap: () => ({ message: 'Invalid pet type — Dog or Cat only' }),
    }),
    breed: z.string().min(1, 'Breed required').max(100, 'Breed name too long'),
    /** ISO date string; age may also be sent but DOB is preferred */
    dob: z.string().min(1, 'Date of birth required').max(50).optional(),
    dateOfBirth: z.string().min(1).max(50).optional(),
    age: z.string().max(50, 'Age too long').optional(),
    gender: z.enum(['Male', 'Female', 'male', 'female', 'neutered', 'spayed', 'Neutered', 'Spayed'], {
      errorMap: () => ({ message: 'Gender required' }),
    }),
    photo: z.string().min(1, 'Profile photo required'),
    weight: z.string().max(50, 'Weight too long').optional(),
    color: z.string().max(100, 'Color too long').optional(),
    microchipId: z.string().max(100, 'Microchip ID too long').optional(),
    medicalHistory: z.string().max(2000, 'Medical history too long').optional(),
    healthRecords: z.string().max(2000, 'Health records too long').optional(),
    vaccinations: z.string().max(2000, 'Vaccination info too long').optional(),
  })
  .refine((pet) => !!(pet.dob?.trim() || pet.dateOfBirth?.trim() || pet.age?.trim()), {
    message: 'Date of birth or age is required',
    path: ['dob'],
  });

export const AddPetRequestSchema = z.object({
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
  pets: z.array(AddPetItemSchema).min(1, 'At least one pet required'),
});

export const UpdatePetRequestSchema = z.object({
  name: z.string().min(1, 'Pet name required').max(100, 'Pet name too long').optional(),
  type: z.enum(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other']).optional(),
  breed: z.string().max(100, 'Breed name too long').optional(),
  age: z.string().max(50, 'Age too long').optional(),
  gender: z.enum(['Male', 'Female', 'Unknown']).optional(),
  weight: z.string().max(50, 'Weight too long').optional(),
  color: z.string().max(100, 'Color too long').optional(),
  photo: z.string().url('Invalid photo URL').optional(),
  microchipId: z.string().max(100, 'Microchip ID too long').optional(),
  medicalHistory: z.string().max(2000, 'Medical history too long').optional(),
  healthRecords: z.string().max(2000, 'Health records too long').optional(),
  vaccinations: z.string().max(2000, 'Vaccination info too long').optional(),
});

// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================

export const CustomerSchema = z.object({
  id: z.string().uuid(),
  phone: z.string(),
  email: z.string().nullable(),
  full_name: z.string().nullable(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  address: z.record(z.unknown()).nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  pincode: z.string().nullable(),
  preferences: z.record(z.unknown()).nullable(),
  is_active: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const PetSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  name: z.string(),
  type: z.string(),
  breed: z.string().nullable(),
  age: z.string().nullable(),
  gender: z.string().nullable(),
  weight: z.string().nullable(),
  color: z.string().nullable(),
  photo: z.string().nullable(),
  microchipId: z.string().nullable(),
  medicalHistory: z.string().nullable(),
  healthRecords: z.string().nullable(),
  vaccinations: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const GetCustomerResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    customer: CustomerSchema,
  }),
});

export const UpdateCustomerProfileResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    profile: CustomerSchema,
  }),
});

export const PetListResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    pets: z.array(PetSchema),
  }),
});

export const AddPetResponseSchema = z.object({
  success: z.literal(true),
  data: z.object({
    message: z.string(),
    pets: z.array(PetSchema),
  }),
});

// ============================================================================
// TYPES
// ============================================================================

export type UpdateCustomerProfileRequest = z.infer<typeof UpdateCustomerProfileRequestSchema>;
export type AddPetRequest = z.infer<typeof AddPetRequestSchema>;
export type UpdatePetRequest = z.infer<typeof UpdatePetRequestSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Pet = z.infer<typeof PetSchema>;
export type GetCustomerResponse = z.infer<typeof GetCustomerResponseSchema>;
export type UpdateCustomerProfileResponse = z.infer<typeof UpdateCustomerProfileResponseSchema>;
export type PetListResponse = z.infer<typeof PetListResponseSchema>;
export type AddPetResponse = z.infer<typeof AddPetResponseSchema>;


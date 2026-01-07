"use strict";
/**
 * ============================================================================
 * CUSTOMER API CONTRACTS
 * ============================================================================
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddPetResponseSchema = exports.PetListResponseSchema = exports.UpdateCustomerProfileResponseSchema = exports.GetCustomerResponseSchema = exports.PetSchema = exports.CustomerSchema = exports.UpdatePetRequestSchema = exports.AddPetRequestSchema = exports.UpdateCustomerProfileRequestSchema = void 0;
const zod_1 = require("zod");
// ============================================================================
// REQUEST SCHEMAS
// ============================================================================
exports.UpdateCustomerProfileRequestSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(1, 'First name required').max(100, 'First name too long').optional(),
    lastName: zod_1.z.string().min(1, 'Last name required').max(100, 'Last name too long').optional(),
    email: zod_1.z.string().email('Invalid email format').optional(),
    address: zod_1.z.string().max(500, 'Address too long').optional(),
    pincode: zod_1.z.string().regex(/^\d{6}$/, 'Invalid pincode format').optional(),
    photo: zod_1.z.string().url('Invalid photo URL').optional(),
});
exports.AddPetRequestSchema = zod_1.z.object({
    phone: zod_1.z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format'),
    pets: zod_1.z.array(zod_1.z.object({
        name: zod_1.z.string().min(1, 'Pet name required').max(100, 'Pet name too long'),
        type: zod_1.z.enum(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other'], {
            errorMap: () => ({ message: 'Invalid pet type' }),
        }),
        breed: zod_1.z.string().max(100, 'Breed name too long').optional(),
        age: zod_1.z.string().max(50, 'Age too long').optional(),
        gender: zod_1.z.enum(['Male', 'Female', 'Unknown']).optional(),
        weight: zod_1.z.string().max(50, 'Weight too long').optional(),
        color: zod_1.z.string().max(100, 'Color too long').optional(),
        photo: zod_1.z.string().url('Invalid photo URL').optional(),
        microchipId: zod_1.z.string().max(100, 'Microchip ID too long').optional(),
        medicalHistory: zod_1.z.string().max(2000, 'Medical history too long').optional(),
        healthRecords: zod_1.z.string().max(2000, 'Health records too long').optional(),
        vaccinations: zod_1.z.string().max(2000, 'Vaccination info too long').optional(),
    })).min(1, 'At least one pet required'),
});
exports.UpdatePetRequestSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Pet name required').max(100, 'Pet name too long').optional(),
    type: zod_1.z.enum(['Dog', 'Cat', 'Bird', 'Rabbit', 'Other']).optional(),
    breed: zod_1.z.string().max(100, 'Breed name too long').optional(),
    age: zod_1.z.string().max(50, 'Age too long').optional(),
    gender: zod_1.z.enum(['Male', 'Female', 'Unknown']).optional(),
    weight: zod_1.z.string().max(50, 'Weight too long').optional(),
    color: zod_1.z.string().max(100, 'Color too long').optional(),
    photo: zod_1.z.string().url('Invalid photo URL').optional(),
    microchipId: zod_1.z.string().max(100, 'Microchip ID too long').optional(),
    medicalHistory: zod_1.z.string().max(2000, 'Medical history too long').optional(),
    healthRecords: zod_1.z.string().max(2000, 'Health records too long').optional(),
    vaccinations: zod_1.z.string().max(2000, 'Vaccination info too long').optional(),
});
// ============================================================================
// RESPONSE SCHEMAS
// ============================================================================
exports.CustomerSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    phone: zod_1.z.string(),
    email: zod_1.z.string().nullable(),
    full_name: zod_1.z.string().nullable(),
    firstName: zod_1.z.string().optional(),
    lastName: zod_1.z.string().optional(),
    address: zod_1.z.record(zod_1.z.unknown()).nullable(),
    city: zod_1.z.string().nullable(),
    state: zod_1.z.string().nullable(),
    pincode: zod_1.z.string().nullable(),
    preferences: zod_1.z.record(zod_1.z.unknown()).nullable(),
    is_active: zod_1.z.boolean(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.PetSchema = zod_1.z.object({
    id: zod_1.z.string().uuid(),
    customer_id: zod_1.z.string().uuid(),
    name: zod_1.z.string(),
    type: zod_1.z.string(),
    breed: zod_1.z.string().nullable(),
    age: zod_1.z.string().nullable(),
    gender: zod_1.z.string().nullable(),
    weight: zod_1.z.string().nullable(),
    color: zod_1.z.string().nullable(),
    photo: zod_1.z.string().nullable(),
    microchipId: zod_1.z.string().nullable(),
    medicalHistory: zod_1.z.string().nullable(),
    healthRecords: zod_1.z.string().nullable(),
    vaccinations: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
exports.GetCustomerResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        customer: exports.CustomerSchema,
    }),
});
exports.UpdateCustomerProfileResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        message: zod_1.z.string(),
        profile: exports.CustomerSchema,
    }),
});
exports.PetListResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        pets: zod_1.z.array(exports.PetSchema),
    }),
});
exports.AddPetResponseSchema = zod_1.z.object({
    success: zod_1.z.literal(true),
    data: zod_1.z.object({
        message: zod_1.z.string(),
        pets: zod_1.z.array(exports.PetSchema),
    }),
});

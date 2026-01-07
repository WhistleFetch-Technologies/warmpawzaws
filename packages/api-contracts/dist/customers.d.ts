/**
 * ============================================================================
 * CUSTOMER API CONTRACTS
 * ============================================================================
 */
import { z } from 'zod';
export declare const UpdateCustomerProfileRequestSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    pincode: z.ZodOptional<z.ZodString>;
    photo: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    address?: string | undefined;
    pincode?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    photo?: string | undefined;
}, {
    email?: string | undefined;
    address?: string | undefined;
    pincode?: string | undefined;
    firstName?: string | undefined;
    lastName?: string | undefined;
    photo?: string | undefined;
}>;
export declare const AddPetRequestSchema: z.ZodObject<{
    phone: z.ZodString;
    pets: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["Dog", "Cat", "Bird", "Rabbit", "Other"]>;
        breed: z.ZodOptional<z.ZodString>;
        age: z.ZodOptional<z.ZodString>;
        gender: z.ZodOptional<z.ZodEnum<["Male", "Female", "Unknown"]>>;
        weight: z.ZodOptional<z.ZodString>;
        color: z.ZodOptional<z.ZodString>;
        photo: z.ZodOptional<z.ZodString>;
        microchipId: z.ZodOptional<z.ZodString>;
        medicalHistory: z.ZodOptional<z.ZodString>;
        healthRecords: z.ZodOptional<z.ZodString>;
        vaccinations: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "Dog" | "Cat" | "Bird" | "Rabbit" | "Other";
        name: string;
        photo?: string | undefined;
        breed?: string | undefined;
        age?: string | undefined;
        gender?: "Male" | "Female" | "Unknown" | undefined;
        weight?: string | undefined;
        color?: string | undefined;
        microchipId?: string | undefined;
        medicalHistory?: string | undefined;
        healthRecords?: string | undefined;
        vaccinations?: string | undefined;
    }, {
        type: "Dog" | "Cat" | "Bird" | "Rabbit" | "Other";
        name: string;
        photo?: string | undefined;
        breed?: string | undefined;
        age?: string | undefined;
        gender?: "Male" | "Female" | "Unknown" | undefined;
        weight?: string | undefined;
        color?: string | undefined;
        microchipId?: string | undefined;
        medicalHistory?: string | undefined;
        healthRecords?: string | undefined;
        vaccinations?: string | undefined;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    phone: string;
    pets: {
        type: "Dog" | "Cat" | "Bird" | "Rabbit" | "Other";
        name: string;
        photo?: string | undefined;
        breed?: string | undefined;
        age?: string | undefined;
        gender?: "Male" | "Female" | "Unknown" | undefined;
        weight?: string | undefined;
        color?: string | undefined;
        microchipId?: string | undefined;
        medicalHistory?: string | undefined;
        healthRecords?: string | undefined;
        vaccinations?: string | undefined;
    }[];
}, {
    phone: string;
    pets: {
        type: "Dog" | "Cat" | "Bird" | "Rabbit" | "Other";
        name: string;
        photo?: string | undefined;
        breed?: string | undefined;
        age?: string | undefined;
        gender?: "Male" | "Female" | "Unknown" | undefined;
        weight?: string | undefined;
        color?: string | undefined;
        microchipId?: string | undefined;
        medicalHistory?: string | undefined;
        healthRecords?: string | undefined;
        vaccinations?: string | undefined;
    }[];
}>;
export declare const UpdatePetRequestSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    type: z.ZodOptional<z.ZodEnum<["Dog", "Cat", "Bird", "Rabbit", "Other"]>>;
    breed: z.ZodOptional<z.ZodString>;
    age: z.ZodOptional<z.ZodString>;
    gender: z.ZodOptional<z.ZodEnum<["Male", "Female", "Unknown"]>>;
    weight: z.ZodOptional<z.ZodString>;
    color: z.ZodOptional<z.ZodString>;
    photo: z.ZodOptional<z.ZodString>;
    microchipId: z.ZodOptional<z.ZodString>;
    medicalHistory: z.ZodOptional<z.ZodString>;
    healthRecords: z.ZodOptional<z.ZodString>;
    vaccinations: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type?: "Dog" | "Cat" | "Bird" | "Rabbit" | "Other" | undefined;
    name?: string | undefined;
    photo?: string | undefined;
    breed?: string | undefined;
    age?: string | undefined;
    gender?: "Male" | "Female" | "Unknown" | undefined;
    weight?: string | undefined;
    color?: string | undefined;
    microchipId?: string | undefined;
    medicalHistory?: string | undefined;
    healthRecords?: string | undefined;
    vaccinations?: string | undefined;
}, {
    type?: "Dog" | "Cat" | "Bird" | "Rabbit" | "Other" | undefined;
    name?: string | undefined;
    photo?: string | undefined;
    breed?: string | undefined;
    age?: string | undefined;
    gender?: "Male" | "Female" | "Unknown" | undefined;
    weight?: string | undefined;
    color?: string | undefined;
    microchipId?: string | undefined;
    medicalHistory?: string | undefined;
    healthRecords?: string | undefined;
    vaccinations?: string | undefined;
}>;
export declare const CustomerSchema: z.ZodObject<{
    id: z.ZodString;
    phone: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    full_name: z.ZodNullable<z.ZodString>;
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    address: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    city: z.ZodNullable<z.ZodString>;
    state: z.ZodNullable<z.ZodString>;
    pincode: z.ZodNullable<z.ZodString>;
    preferences: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    is_active: z.ZodBoolean;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    email: string | null;
    id: string;
    is_active: boolean;
    address: Record<string, unknown> | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    createdAt: string;
    updatedAt: string;
    full_name: string | null;
    preferences: Record<string, unknown> | null;
    firstName?: string | undefined;
    lastName?: string | undefined;
}, {
    phone: string;
    email: string | null;
    id: string;
    is_active: boolean;
    address: Record<string, unknown> | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    createdAt: string;
    updatedAt: string;
    full_name: string | null;
    preferences: Record<string, unknown> | null;
    firstName?: string | undefined;
    lastName?: string | undefined;
}>;
export declare const PetSchema: z.ZodObject<{
    id: z.ZodString;
    customer_id: z.ZodString;
    name: z.ZodString;
    type: z.ZodString;
    breed: z.ZodNullable<z.ZodString>;
    age: z.ZodNullable<z.ZodString>;
    gender: z.ZodNullable<z.ZodString>;
    weight: z.ZodNullable<z.ZodString>;
    color: z.ZodNullable<z.ZodString>;
    photo: z.ZodNullable<z.ZodString>;
    microchipId: z.ZodNullable<z.ZodString>;
    medicalHistory: z.ZodNullable<z.ZodString>;
    healthRecords: z.ZodNullable<z.ZodString>;
    vaccinations: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: string;
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    photo: string | null;
    breed: string | null;
    age: string | null;
    gender: string | null;
    weight: string | null;
    color: string | null;
    microchipId: string | null;
    medicalHistory: string | null;
    healthRecords: string | null;
    vaccinations: string | null;
    customer_id: string;
}, {
    type: string;
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
    photo: string | null;
    breed: string | null;
    age: string | null;
    gender: string | null;
    weight: string | null;
    color: string | null;
    microchipId: string | null;
    medicalHistory: string | null;
    healthRecords: string | null;
    vaccinations: string | null;
    customer_id: string;
}>;
export declare const GetCustomerResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        customer: z.ZodObject<{
            id: z.ZodString;
            phone: z.ZodString;
            email: z.ZodNullable<z.ZodString>;
            full_name: z.ZodNullable<z.ZodString>;
            firstName: z.ZodOptional<z.ZodString>;
            lastName: z.ZodOptional<z.ZodString>;
            address: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            city: z.ZodNullable<z.ZodString>;
            state: z.ZodNullable<z.ZodString>;
            pincode: z.ZodNullable<z.ZodString>;
            preferences: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            is_active: z.ZodBoolean;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        }, {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        customer: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    }, {
        customer: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        customer: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    };
}, {
    success: true;
    data: {
        customer: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    };
}>;
export declare const UpdateCustomerProfileResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        message: z.ZodString;
        profile: z.ZodObject<{
            id: z.ZodString;
            phone: z.ZodString;
            email: z.ZodNullable<z.ZodString>;
            full_name: z.ZodNullable<z.ZodString>;
            firstName: z.ZodOptional<z.ZodString>;
            lastName: z.ZodOptional<z.ZodString>;
            address: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            city: z.ZodNullable<z.ZodString>;
            state: z.ZodNullable<z.ZodString>;
            pincode: z.ZodNullable<z.ZodString>;
            preferences: z.ZodNullable<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            is_active: z.ZodBoolean;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        }, {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        message: string;
        profile: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    }, {
        message: string;
        profile: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        message: string;
        profile: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    };
}, {
    success: true;
    data: {
        message: string;
        profile: {
            phone: string;
            email: string | null;
            id: string;
            is_active: boolean;
            address: Record<string, unknown> | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            createdAt: string;
            updatedAt: string;
            full_name: string | null;
            preferences: Record<string, unknown> | null;
            firstName?: string | undefined;
            lastName?: string | undefined;
        };
    };
}>;
export declare const PetListResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        pets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            customer_id: z.ZodString;
            name: z.ZodString;
            type: z.ZodString;
            breed: z.ZodNullable<z.ZodString>;
            age: z.ZodNullable<z.ZodString>;
            gender: z.ZodNullable<z.ZodString>;
            weight: z.ZodNullable<z.ZodString>;
            color: z.ZodNullable<z.ZodString>;
            photo: z.ZodNullable<z.ZodString>;
            microchipId: z.ZodNullable<z.ZodString>;
            medicalHistory: z.ZodNullable<z.ZodString>;
            healthRecords: z.ZodNullable<z.ZodString>;
            vaccinations: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }, {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    }, {
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    };
}, {
    success: true;
    data: {
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    };
}>;
export declare const AddPetResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        message: z.ZodString;
        pets: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            customer_id: z.ZodString;
            name: z.ZodString;
            type: z.ZodString;
            breed: z.ZodNullable<z.ZodString>;
            age: z.ZodNullable<z.ZodString>;
            gender: z.ZodNullable<z.ZodString>;
            weight: z.ZodNullable<z.ZodString>;
            color: z.ZodNullable<z.ZodString>;
            photo: z.ZodNullable<z.ZodString>;
            microchipId: z.ZodNullable<z.ZodString>;
            medicalHistory: z.ZodNullable<z.ZodString>;
            healthRecords: z.ZodNullable<z.ZodString>;
            vaccinations: z.ZodNullable<z.ZodString>;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }, {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        message: string;
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    }, {
        message: string;
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        message: string;
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    };
}, {
    success: true;
    data: {
        message: string;
        pets: {
            type: string;
            id: string;
            name: string;
            createdAt: string;
            updatedAt: string;
            photo: string | null;
            breed: string | null;
            age: string | null;
            gender: string | null;
            weight: string | null;
            color: string | null;
            microchipId: string | null;
            medicalHistory: string | null;
            healthRecords: string | null;
            vaccinations: string | null;
            customer_id: string;
        }[];
    };
}>;
export type UpdateCustomerProfileRequest = z.infer<typeof UpdateCustomerProfileRequestSchema>;
export type AddPetRequest = z.infer<typeof AddPetRequestSchema>;
export type UpdatePetRequest = z.infer<typeof UpdatePetRequestSchema>;
export type Customer = z.infer<typeof CustomerSchema>;
export type Pet = z.infer<typeof PetSchema>;
export type GetCustomerResponse = z.infer<typeof GetCustomerResponseSchema>;
export type UpdateCustomerProfileResponse = z.infer<typeof UpdateCustomerProfileResponseSchema>;
export type PetListResponse = z.infer<typeof PetListResponseSchema>;
export type AddPetResponse = z.infer<typeof AddPetResponseSchema>;
//# sourceMappingURL=customers.d.ts.map
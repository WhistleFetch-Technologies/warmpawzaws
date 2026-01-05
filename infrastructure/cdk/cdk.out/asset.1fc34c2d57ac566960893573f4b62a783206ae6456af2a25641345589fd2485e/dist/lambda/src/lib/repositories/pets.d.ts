/**
 * ============================================================================
 * PETS REPOSITORY
 * ============================================================================
 *
 * Repository for pet data access.
 * Replaces: pet:{petId}, customer:{id}:pets KV keys
 *
 * RULES:
 * ❌ NO KV imports allowed
 * ✅ All operations use SQL only
 *
 * Date: 2024-12-22
 * ============================================================================
 */
import type { Pool } from "../db";
export interface Pet {
    id: string;
    customer_id: string;
    name: string;
    type?: string | null;
    breed?: string | null;
    age?: number | null;
    gender?: string | null;
    weight?: number | null;
    color?: string | null;
    photo_url?: string | null;
    medical_conditions?: any;
    allergies?: any;
    vaccinations?: any;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}
export interface CreatePetInput {
    customer_id: string;
    name: string;
    type?: string;
    breed?: string;
    age?: number;
    gender?: string;
    weight?: number;
    color?: string;
    photo_url?: string;
    medical_conditions?: any;
    allergies?: any;
    vaccinations?: any;
    is_active?: boolean;
}
export declare class PetsRepository {
    private pool;
    constructor(pool?: Pool);
    private getPool;
    findById(petId: string): Promise<Pet | null>;
    findByCustomer(customerId: string, options?: {
        limit?: number;
        offset?: number;
    }): Promise<Pet[]>;
    create(input: CreatePetInput): Promise<Pet>;
    update(petId: string, input: Partial<CreatePetInput>): Promise<Pet>;
    delete(petId: string): Promise<void>;
}
export declare function getPetsRepository(): PetsRepository;
//# sourceMappingURL=pets.d.ts.map
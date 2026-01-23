/**
 * ============================================================================
 * VENDOR API CONTRACTS
 * ============================================================================
 */
import { z } from 'zod';
export declare const SubmitVendorApplicationRequestSchema: z.ZodObject<{
    phone: z.ZodEffects<z.ZodString, string, string>;
    application_payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    uploaded_documents: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        type: z.ZodString;
        url: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        name: z.ZodDefault<z.ZodOptional<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: string;
        name: string;
        url: string;
    }, {
        type: string;
        name?: string | undefined;
        url?: string | undefined;
    }>, "many">>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    application_payload: Record<string, unknown>;
    uploaded_documents: {
        type: string;
        name: string;
        url: string;
    }[];
}, {
    phone: string;
    application_payload: Record<string, unknown>;
    uploaded_documents?: {
        type: string;
        name?: string | undefined;
        url?: string | undefined;
    }[] | undefined;
}>;
export declare const SelectVendorRoleRequestSchema: z.ZodObject<{
    phone: z.ZodString;
    role_id: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    role_id: string;
}, {
    phone: string;
    role_id: string;
}>;
export declare const SelectVendorTypeRequestSchema: z.ZodObject<{
    phone: z.ZodString;
    vendor_type: z.ZodEnum<["solo", "business"]>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    vendor_type: "solo" | "business";
}, {
    phone: string;
    vendor_type: "solo" | "business";
}>;
export declare const AdminReviewApplicationRequestSchema: z.ZodObject<{
    action: z.ZodEnum<["APPROVE", "REQUEST_CLARIFICATION", "REJECT"]>;
    admin_id: z.ZodString;
    comments: z.ZodOptional<z.ZodString>;
    rejection_reason: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action: "APPROVE" | "REQUEST_CLARIFICATION" | "REJECT";
    admin_id: string;
    comments?: string | undefined;
    rejection_reason?: string | undefined;
}, {
    action: "APPROVE" | "REQUEST_CLARIFICATION" | "REJECT";
    admin_id: string;
    comments?: string | undefined;
    rejection_reason?: string | undefined;
}>;
export declare const UpdateVendorProfileRequestSchema: z.ZodObject<{
    business_name: z.ZodOptional<z.ZodString>;
    owner_name: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    state: z.ZodOptional<z.ZodString>;
    pincode: z.ZodOptional<z.ZodString>;
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
    description: z.ZodOptional<z.ZodString>;
    logo_url: z.ZodOptional<z.ZodString>;
    cover_image_url: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    email?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    business_name?: string | undefined;
    owner_name?: string | undefined;
    description?: string | undefined;
    logo_url?: string | undefined;
    cover_image_url?: string | undefined;
}, {
    email?: string | undefined;
    address?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    business_name?: string | undefined;
    owner_name?: string | undefined;
    description?: string | undefined;
    logo_url?: string | undefined;
    cover_image_url?: string | undefined;
}>;
export declare const VendorSchema: z.ZodObject<{
    id: z.ZodString;
    phone: z.ZodString;
    email: z.ZodNullable<z.ZodString>;
    business_name: z.ZodString;
    owner_name: z.ZodString;
    role_id: z.ZodNullable<z.ZodString>;
    vendor_type: z.ZodEnum<["solo", "business"]>;
    status: z.ZodEnum<["pending", "approved", "rejected", "active", "inactive", "suspended"]>;
    tier: z.ZodString;
    address: z.ZodNullable<z.ZodString>;
    city: z.ZodNullable<z.ZodString>;
    state: z.ZodNullable<z.ZodString>;
    pincode: z.ZodNullable<z.ZodString>;
    latitude: z.ZodNullable<z.ZodNumber>;
    longitude: z.ZodNullable<z.ZodNumber>;
    description: z.ZodNullable<z.ZodString>;
    logo_url: z.ZodNullable<z.ZodString>;
    cover_image_url: z.ZodNullable<z.ZodString>;
    onboarding_status: z.ZodString;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phone: string;
    status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
    email: string | null;
    id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    updatedAt: string;
    role_id: string | null;
    vendor_type: "solo" | "business";
    business_name: string;
    owner_name: string;
    description: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    tier: string;
    onboarding_status: string;
}, {
    phone: string;
    status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
    email: string | null;
    id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    latitude: number | null;
    longitude: number | null;
    createdAt: string;
    updatedAt: string;
    role_id: string | null;
    vendor_type: "solo" | "business";
    business_name: string;
    owner_name: string;
    description: string | null;
    logo_url: string | null;
    cover_image_url: string | null;
    tier: string;
    onboarding_status: string;
}>;
export declare const VendorOnboardingApplicationSchema: z.ZodObject<{
    id: z.ZodString;
    vendor_identity_id: z.ZodString;
    role_id: z.ZodString;
    vendor_type: z.ZodEnum<["solo", "business"]>;
    status: z.ZodEnum<["DRAFT", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CLARIFICATION_REQUIRED", "ACTIVATED"]>;
    application_payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    uploaded_documents: z.ZodArray<z.ZodUnknown, "many">;
    form_version: z.ZodString;
    admin_comments: z.ZodNullable<z.ZodString>;
    rejection_reason: z.ZodNullable<z.ZodString>;
    reviewed_by: z.ZodNullable<z.ZodString>;
    reviewed_at: z.ZodNullable<z.ZodString>;
    submitted_at: z.ZodNullable<z.ZodString>;
    createdAt: z.ZodString;
    updatedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CLARIFICATION_REQUIRED" | "ACTIVATED";
    id: string;
    createdAt: string;
    updatedAt: string;
    application_payload: Record<string, unknown>;
    uploaded_documents: unknown[];
    role_id: string;
    vendor_type: "solo" | "business";
    rejection_reason: string | null;
    vendor_identity_id: string;
    form_version: string;
    admin_comments: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    submitted_at: string | null;
}, {
    status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "CLARIFICATION_REQUIRED" | "ACTIVATED";
    id: string;
    createdAt: string;
    updatedAt: string;
    application_payload: Record<string, unknown>;
    uploaded_documents: unknown[];
    role_id: string;
    vendor_type: "solo" | "business";
    rejection_reason: string | null;
    vendor_identity_id: string;
    form_version: string;
    admin_comments: string | null;
    reviewed_by: string | null;
    reviewed_at: string | null;
    submitted_at: string | null;
}>;
export declare const VendorRoleSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    display_name: z.ZodString;
    description: z.ZodNullable<z.ZodString>;
    is_active: z.ZodBoolean;
    config: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
}, "strip", z.ZodTypeAny, {
    id: string;
    name: string;
    is_active: boolean;
    description: string | null;
    display_name: string;
    config?: Record<string, unknown> | undefined;
    capabilities?: string[] | undefined;
}, {
    id: string;
    name: string;
    is_active: boolean;
    description: string | null;
    display_name: string;
    config?: Record<string, unknown> | undefined;
    capabilities?: string[] | undefined;
}>;
export declare const SubmitApplicationResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        message: z.ZodString;
        applicationId: z.ZodString;
        nextStep: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        message: string;
        applicationId: string;
        nextStep: string;
    }, {
        message: string;
        applicationId: string;
        nextStep: string;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        message: string;
        applicationId: string;
        nextStep: string;
    };
}, {
    success: true;
    data: {
        message: string;
        applicationId: string;
        nextStep: string;
    };
}>;
export declare const GetVendorResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        vendor: z.ZodObject<{
            id: z.ZodString;
            phone: z.ZodString;
            email: z.ZodNullable<z.ZodString>;
            business_name: z.ZodString;
            owner_name: z.ZodString;
            role_id: z.ZodNullable<z.ZodString>;
            vendor_type: z.ZodEnum<["solo", "business"]>;
            status: z.ZodEnum<["pending", "approved", "rejected", "active", "inactive", "suspended"]>;
            tier: z.ZodString;
            address: z.ZodNullable<z.ZodString>;
            city: z.ZodNullable<z.ZodString>;
            state: z.ZodNullable<z.ZodString>;
            pincode: z.ZodNullable<z.ZodString>;
            latitude: z.ZodNullable<z.ZodNumber>;
            longitude: z.ZodNullable<z.ZodNumber>;
            description: z.ZodNullable<z.ZodString>;
            logo_url: z.ZodNullable<z.ZodString>;
            cover_image_url: z.ZodNullable<z.ZodString>;
            onboarding_status: z.ZodString;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }, {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }>;
    }, "strip", z.ZodTypeAny, {
        vendor: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        };
    }, {
        vendor: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        vendor: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        };
    };
}, {
    success: true;
    data: {
        vendor: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        };
    };
}>;
export declare const VendorListResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        vendors: z.ZodArray<z.ZodObject<{
            id: z.ZodString;
            phone: z.ZodString;
            email: z.ZodNullable<z.ZodString>;
            business_name: z.ZodString;
            owner_name: z.ZodString;
            role_id: z.ZodNullable<z.ZodString>;
            vendor_type: z.ZodEnum<["solo", "business"]>;
            status: z.ZodEnum<["pending", "approved", "rejected", "active", "inactive", "suspended"]>;
            tier: z.ZodString;
            address: z.ZodNullable<z.ZodString>;
            city: z.ZodNullable<z.ZodString>;
            state: z.ZodNullable<z.ZodString>;
            pincode: z.ZodNullable<z.ZodString>;
            latitude: z.ZodNullable<z.ZodNumber>;
            longitude: z.ZodNullable<z.ZodNumber>;
            description: z.ZodNullable<z.ZodString>;
            logo_url: z.ZodNullable<z.ZodString>;
            cover_image_url: z.ZodNullable<z.ZodString>;
            onboarding_status: z.ZodString;
            createdAt: z.ZodString;
            updatedAt: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }, {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }>, "many">;
        total: z.ZodNumber;
        page: z.ZodOptional<z.ZodNumber>;
        limit: z.ZodOptional<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        total: number;
        vendors: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }[];
        page?: number | undefined;
        limit?: number | undefined;
    }, {
        total: number;
        vendors: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }[];
        page?: number | undefined;
        limit?: number | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        total: number;
        vendors: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }[];
        page?: number | undefined;
        limit?: number | undefined;
    };
}, {
    success: true;
    data: {
        total: number;
        vendors: {
            phone: string;
            status: "pending" | "approved" | "rejected" | "active" | "inactive" | "suspended";
            email: string | null;
            id: string;
            address: string | null;
            city: string | null;
            state: string | null;
            pincode: string | null;
            latitude: number | null;
            longitude: number | null;
            createdAt: string;
            updatedAt: string;
            role_id: string | null;
            vendor_type: "solo" | "business";
            business_name: string;
            owner_name: string;
            description: string | null;
            logo_url: string | null;
            cover_image_url: string | null;
            tier: string;
            onboarding_status: string;
        }[];
        page?: number | undefined;
        limit?: number | undefined;
    };
}>;
export type SubmitVendorApplicationRequest = z.infer<typeof SubmitVendorApplicationRequestSchema>;
export type SelectVendorRoleRequest = z.infer<typeof SelectVendorRoleRequestSchema>;
export type SelectVendorTypeRequest = z.infer<typeof SelectVendorTypeRequestSchema>;
export type AdminReviewApplicationRequest = z.infer<typeof AdminReviewApplicationRequestSchema>;
export type UpdateVendorProfileRequest = z.infer<typeof UpdateVendorProfileRequestSchema>;
export type Vendor = z.infer<typeof VendorSchema>;
export type VendorOnboardingApplication = z.infer<typeof VendorOnboardingApplicationSchema>;
export type VendorRole = z.infer<typeof VendorRoleSchema>;
export type SubmitApplicationResponse = z.infer<typeof SubmitApplicationResponseSchema>;
export type GetVendorResponse = z.infer<typeof GetVendorResponseSchema>;
export type VendorListResponse = z.infer<typeof VendorListResponseSchema>;
//# sourceMappingURL=vendors.d.ts.map
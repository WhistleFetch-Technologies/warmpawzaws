/**
 * ============================================================================
 * AUTHENTICATION API CONTRACTS
 * ============================================================================
 */
import { z } from 'zod';
export declare const SendOtpRequestSchema: z.ZodObject<{
    phone: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["customer", "vendor", "admin"]>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    role?: "customer" | "vendor" | "admin" | undefined;
}, {
    phone: string;
    role?: "customer" | "vendor" | "admin" | undefined;
}>;
export declare const VerifyOtpRequestSchema: z.ZodObject<{
    phone: z.ZodString;
    otp: z.ZodString;
    role: z.ZodOptional<z.ZodEnum<["customer", "vendor", "admin"]>>;
}, "strip", z.ZodTypeAny, {
    phone: string;
    otp: string;
    role?: "customer" | "vendor" | "admin" | undefined;
}, {
    phone: string;
    otp: string;
    role?: "customer" | "vendor" | "admin" | undefined;
}>;
export declare const AdminLoginRequestSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, "strip", z.ZodTypeAny, {
    email: string;
    password: string;
}, {
    email: string;
    password: string;
}>;
export declare const RefreshTokenRequestSchema: z.ZodObject<{
    refresh_token: z.ZodString;
}, "strip", z.ZodTypeAny, {
    refresh_token: string;
}, {
    refresh_token: string;
}>;
export declare const AuthTokenSchema: z.ZodObject<{
    access_token: z.ZodString;
    refresh_token: z.ZodString;
    expires_in: z.ZodNumber;
    token_type: z.ZodLiteral<"Bearer">;
}, "strip", z.ZodTypeAny, {
    refresh_token: string;
    access_token: string;
    expires_in: number;
    token_type: "Bearer";
}, {
    refresh_token: string;
    access_token: string;
    expires_in: number;
    token_type: "Bearer";
}>;
export declare const UserSchema: z.ZodObject<{
    id: z.ZodString;
    phone: z.ZodOptional<z.ZodString>;
    email: z.ZodOptional<z.ZodString>;
    name: z.ZodOptional<z.ZodString>;
    role: z.ZodEnum<["customer", "vendor", "admin", "staff"]>;
    is_active: z.ZodBoolean;
    created_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    role: "customer" | "vendor" | "admin" | "staff";
    id: string;
    is_active: boolean;
    created_at: string;
    phone?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
}, {
    role: "customer" | "vendor" | "admin" | "staff";
    id: string;
    is_active: boolean;
    created_at: string;
    phone?: string | undefined;
    email?: string | undefined;
    name?: string | undefined;
}>;
export declare const AuthResponseSchema: z.ZodObject<{
    success: z.ZodLiteral<true>;
    data: z.ZodObject<{
        token: z.ZodObject<{
            access_token: z.ZodString;
            refresh_token: z.ZodString;
            expires_in: z.ZodNumber;
            token_type: z.ZodLiteral<"Bearer">;
        }, "strip", z.ZodTypeAny, {
            refresh_token: string;
            access_token: string;
            expires_in: number;
            token_type: "Bearer";
        }, {
            refresh_token: string;
            access_token: string;
            expires_in: number;
            token_type: "Bearer";
        }>;
        user: z.ZodObject<{
            id: z.ZodString;
            phone: z.ZodOptional<z.ZodString>;
            email: z.ZodOptional<z.ZodString>;
            name: z.ZodOptional<z.ZodString>;
            role: z.ZodEnum<["customer", "vendor", "admin", "staff"]>;
            is_active: z.ZodBoolean;
            created_at: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            role: "customer" | "vendor" | "admin" | "staff";
            id: string;
            is_active: boolean;
            created_at: string;
            phone?: string | undefined;
            email?: string | undefined;
            name?: string | undefined;
        }, {
            role: "customer" | "vendor" | "admin" | "staff";
            id: string;
            is_active: boolean;
            created_at: string;
            phone?: string | undefined;
            email?: string | undefined;
            name?: string | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        token: {
            refresh_token: string;
            access_token: string;
            expires_in: number;
            token_type: "Bearer";
        };
        user: {
            role: "customer" | "vendor" | "admin" | "staff";
            id: string;
            is_active: boolean;
            created_at: string;
            phone?: string | undefined;
            email?: string | undefined;
            name?: string | undefined;
        };
    }, {
        token: {
            refresh_token: string;
            access_token: string;
            expires_in: number;
            token_type: "Bearer";
        };
        user: {
            role: "customer" | "vendor" | "admin" | "staff";
            id: string;
            is_active: boolean;
            created_at: string;
            phone?: string | undefined;
            email?: string | undefined;
            name?: string | undefined;
        };
    }>;
}, "strip", z.ZodTypeAny, {
    success: true;
    data: {
        token: {
            refresh_token: string;
            access_token: string;
            expires_in: number;
            token_type: "Bearer";
        };
        user: {
            role: "customer" | "vendor" | "admin" | "staff";
            id: string;
            is_active: boolean;
            created_at: string;
            phone?: string | undefined;
            email?: string | undefined;
            name?: string | undefined;
        };
    };
}, {
    success: true;
    data: {
        token: {
            refresh_token: string;
            access_token: string;
            expires_in: number;
            token_type: "Bearer";
        };
        user: {
            role: "customer" | "vendor" | "admin" | "staff";
            id: string;
            is_active: boolean;
            created_at: string;
            phone?: string | undefined;
            email?: string | undefined;
            name?: string | undefined;
        };
    };
}>;
export type SendOtpRequest = z.infer<typeof SendOtpRequestSchema>;
export type VerifyOtpRequest = z.infer<typeof VerifyOtpRequestSchema>;
export type AdminLoginRequest = z.infer<typeof AdminLoginRequestSchema>;
export type RefreshTokenRequest = z.infer<typeof RefreshTokenRequestSchema>;
export type AuthToken = z.infer<typeof AuthTokenSchema>;
export type User = z.infer<typeof UserSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
//# sourceMappingURL=auth.d.ts.map
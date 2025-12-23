# Warmpawz NextJS - API Client & Contracts Architecture

**Version:** 1.0.0  
**Status:** PHASE 0 Complete

---

## 🌐 API Client Architecture Overview

This document defines how frontend applications communicate with Next.js API routes, which act as thin adapters to backend services.

---

## 📦 API Contracts (Zod-Based)

### Package Structure: `packages/api-contracts/`

API contracts are the **source of truth** for all client-server communication. They are defined once and used everywhere.

```typescript
// packages/api-contracts/src/index.ts
export * from "./auth";
export * from "./bookings";
export * from "./vendors";
export * from "./services";
export * from "./payments";
export * from "./common";
```

### Common Response Envelope

```typescript
// packages/api-contracts/src/common/response.ts
import { z } from "zod";

export const ApiSuccessSchema = z.object({
	success: z.literal(true),
	data: z.unknown(),
	error: z.null(),
	meta: z.object({
		timestamp: z.string().datetime(),
		requestId: z.string(),
		version: z.literal("v1"),
	}),
});

export const ApiErrorSchema = z.object({
	success: z.literal(false),
	data: z.null(),
	error: z.object({
		code: z.string(),
		message: z.string(),
		details: z.record(z.unknown()).optional(),
	}),
	meta: z.object({
		timestamp: z.string().datetime(),
		requestId: z.string(),
		version: z.literal("v1"),
	}),
});

export const ApiResponseSchema = z.union([ApiSuccessSchema, ApiErrorSchema]);

export type ApiSuccess<T = any> = z.infer<typeof ApiSuccessSchema> & {
	data: T;
};

export type ApiError = z.infer<typeof ApiErrorSchema>;

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;
```

### Common Error Codes

```typescript
// packages/api-contracts/src/common/errors.ts
export const ERROR_CODES = {
	// Validation
	INVALID_REQUEST: "INVALID_REQUEST",
	INVALID_EMAIL: "INVALID_EMAIL",
	INVALID_PHONE: "INVALID_PHONE",
	MISSING_FIELD: "MISSING_FIELD",

	// Authentication
	UNAUTHORIZED: "UNAUTHORIZED",
	INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
	TOKEN_EXPIRED: "TOKEN_EXPIRED",
	TOKEN_INVALID: "TOKEN_INVALID",

	// Authorization
	FORBIDDEN: "FORBIDDEN",
	INSUFFICIENT_PERMISSIONS: "INSUFFICIENT_PERMISSIONS",

	// Resource
	NOT_FOUND: "NOT_FOUND",
	DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
	CONFLICT: "CONFLICT",

	// Business Logic
	BOOKING_SLOT_UNAVAILABLE: "BOOKING_SLOT_UNAVAILABLE",
	VENDOR_INACTIVE: "VENDOR_INACTIVE",
	INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
	SERVICE_NOT_AVAILABLE: "SERVICE_NOT_AVAILABLE",

	// Server
	INTERNAL_ERROR: "INTERNAL_ERROR",
	SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
	DATABASE_ERROR: "DATABASE_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
```

---

## 🔐 Authentication Contracts

### Login Contract

```typescript
// packages/api-contracts/src/auth/login.ts
import { z } from "zod";

export const LoginRequestSchema = z.object({
	email: z.string().email("Invalid email format"),
	password: z.string().min(8, "Password must be at least 8 characters"),
	rememberMe: z.boolean().default(false),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const LoginResponseSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	name: z.string(),
	persona: z.enum(["customer", "vendor", "admin", "staff"]),
	avatarUrl: z.string().url().nullable(),
	createdAt: z.string().datetime(),
});

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

// API Endpoint
export const AUTH_LOGIN_ENDPOINT = "/api/v1/auth/login" as const;
```

### Get Current User Contract

```typescript
// packages/api-contracts/src/auth/me.ts
import { z } from "zod";

export const MeResponseSchema = z.object({
	id: z.string(),
	email: z.string().email(),
	name: z.string(),
	persona: z.enum(["customer", "vendor", "admin", "staff"]),
	avatarUrl: z.string().url().nullable(),
	role: z.string().optional(),
	permissions: z.array(z.string()).optional(),
	createdAt: z.string().datetime(),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;

export const AUTH_ME_ENDPOINT = "/api/v1/auth/me" as const;
```

---

## 📅 Booking Contracts

### Create Booking

```typescript
// packages/api-contracts/src/bookings/create.ts
import { z } from "zod";

export const CreateBookingRequestSchema = z.object({
	vendorId: z.string().startsWith("vendor_", "Invalid vendor ID"),
	serviceId: z.string().startsWith("service_", "Invalid service ID"),
	scheduledAt: z.string().datetime("Invalid date format"),
	petIds: z
		.array(z.string().startsWith("pet_"))
		.min(1, "At least one pet required"),
	notes: z.string().max(500).optional(),
	customPaymentAmount: z.number().positive().optional(),
});

export type CreateBookingRequest = z.infer<typeof CreateBookingRequestSchema>;

export const BookingEntitySchema = z.object({
	id: z.string().startsWith("booking_"),
	customerId: z.string().startsWith("user_"),
	vendorId: z.string().startsWith("vendor_"),
	serviceId: z.string().startsWith("service_"),
	status: z.enum([
		"pending",
		"confirmed",
		"in_progress",
		"completed",
		"cancelled",
	]),
	scheduledAt: z.string().datetime(),
	completedAt: z.string().datetime().nullable(),
	amount: z.number().positive(),
	commission: z.number().nonnegative(),
	vendorPayout: z.number().nonnegative(),
	paymentStatus: z.enum(["pending", "paid", "refunded"]),
	cancellationReason: z.string().nullable(),
	notes: z.string().nullable(),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export type Booking = z.infer<typeof BookingEntitySchema>;

export type CreateBookingResponse = Booking;

export const BOOKINGS_CREATE_ENDPOINT = "/api/v1/bookings" as const;
```

### List Bookings

```typescript
// packages/api-contracts/src/bookings/list.ts
import { z } from "zod";
import { BookingEntitySchema } from "./create";

export const BookingsListQuerySchema = z.object({
	page: z.number().int().positive().default(1),
	limit: z.number().int().positive().max(100).default(20),
	status: z
		.array(
			z.enum(["pending", "confirmed", "in_progress", "completed", "cancelled"])
		)
		.optional(),
	sortBy: z.enum(["createdAt", "scheduledAt", "amount"]).default("scheduledAt"),
	sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type BookingsListQuery = z.infer<typeof BookingsListQuerySchema>;

export const BookingsListResponseSchema = z.object({
	bookings: z.array(BookingEntitySchema),
	total: z.number().nonnegative(),
	page: z.number().positive(),
	limit: z.number().positive(),
	totalPages: z.number().nonnegative(),
});

export type BookingsListResponse = z.infer<typeof BookingsListResponseSchema>;

export const BOOKINGS_LIST_ENDPOINT = "/api/v1/bookings" as const;
```

### Cancel Booking

```typescript
// packages/api-contracts/src/bookings/cancel.ts
import { z } from "zod";
import { BookingEntitySchema } from "./create";

export const CancelBookingRequestSchema = z.object({
	reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export type CancelBookingRequest = z.infer<typeof CancelBookingRequestSchema>;

export type CancelBookingResponse = BookingEntitySchema;

export const BOOKINGS_CANCEL_ENDPOINT = (bookingId: string) =>
	`/api/v1/bookings/${bookingId}/cancel`;
```

---

## 🏪 Vendor Contracts

### Search Vendors

```typescript
// packages/api-contracts/src/vendors/search.ts
import { z } from "zod";

export const VendorsSearchQuerySchema = z.object({
	q: z.string().optional(),
	latitude: z.number().min(-90).max(90).optional(),
	longitude: z.number().min(-180).max(180).optional(),
	radiusKm: z.number().positive().default(50),
	category: z.string().optional(),
	minRating: z.number().min(0).max(5).default(0),
	page: z.number().int().positive().default(1),
	limit: z.number().int().positive().max(100).default(20),
});

export type VendorsSearchQuery = z.infer<typeof VendorsSearchQuerySchema>;

export const VendorEntitySchema = z.object({
	id: z.string().startsWith("vendor_"),
	name: z.string(),
	description: z.string().nullable(),
	category: z.string(),
	avatarUrl: z.string().url().nullable(),
	rating: z.number().min(0).max(5),
	reviewCount: z.number().nonnegative(),
	isActive: z.boolean(),
	isPremium: z.boolean(),
	latitude: z.number().min(-90).max(90).nullable(),
	longitude: z.number().min(-180).max(180).nullable(),
	distance: z.number().nullable(), // Distance from search location
	createdAt: z.string().datetime(),
});

export type Vendor = z.infer<typeof VendorEntitySchema>;

export const VendorsSearchResponseSchema = z.object({
	vendors: z.array(VendorEntitySchema),
	total: z.number().nonnegative(),
	page: z.number().positive(),
	limit: z.number().positive(),
	totalPages: z.number().nonnegative(),
});

export type VendorsSearchResponse = z.infer<typeof VendorsSearchResponseSchema>;

export const VENDORS_SEARCH_ENDPOINT = "/api/v1/vendors" as const;
```

### Get Vendor Details

```typescript
// packages/api-contracts/src/vendors/get.ts
import { z } from "zod";
import { VendorEntitySchema } from "./search";

export const VendorDetailSchema = VendorEntitySchema.extend({
	email: z.string().email(),
	phone: z.string(),
	address: z.string(),
	city: z.string(),
	state: z.string(),
	zipCode: z.string(),
	businessLicense: z.string().url(),
	insuranceValid: z.boolean(),
	insuranceExpiry: z.string().datetime().nullable(),
	bankAccountNumber: z.string().nullable(), // Masked
	availableServices: z.array(
		z.object({
			id: z.string().startsWith("service_"),
			name: z.string(),
			basePrice: z.number().positive(),
		})
	),
});

export type VendorDetail = z.infer<typeof VendorDetailSchema>;

export const VENDORS_GET_ENDPOINT = (vendorId: string) =>
	`/api/v1/vendors/${vendorId}`;
```

### Get Vendor Availability

```typescript
// packages/api-contracts/src/vendors/availability.ts
import { z } from "zod";

export const VendorAvailabilityQuerySchema = z.object({
	serviceId: z.string().startsWith("service_"),
	startDate: z.string().datetime(),
	endDate: z.string().datetime(),
	timeSlotDuration: z.number().int().positive().default(60), // minutes
});

export type VendorAvailabilityQuery = z.infer<
	typeof VendorAvailabilityQuerySchema
>;

export const TimeSlotSchema = z.object({
	startTime: z.string().datetime(),
	endTime: z.string().datetime(),
	isAvailable: z.boolean(),
	price: z.number().positive().nullable(),
});

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const VendorAvailabilityResponseSchema = z.object({
	vendorId: z.string().startsWith("vendor_"),
	serviceId: z.string().startsWith("service_"),
	slots: z.array(TimeSlotSchema),
	basePrice: z.number().positive(),
});

export type VendorAvailabilityResponse = z.infer<
	typeof VendorAvailabilityResponseSchema
>;

export const VENDORS_AVAILABILITY_ENDPOINT = (vendorId: string) =>
	`/api/v1/vendors/${vendorId}/availability`;
```

---

## 🐾 Pet Contracts

### Create Pet

```typescript
// packages/api-contracts/src/pets/create.ts
import { z } from "zod";

export const CreatePetRequestSchema = z.object({
	name: z.string().min(1, "Pet name required").max(50),
	species: z.enum(["dog", "cat", "bird", "rabbit", "other"]),
	breed: z.string().max(50).optional(),
	age: z.number().int().nonnegative().optional(),
	weight: z.number().positive().optional(),
	color: z.string().optional(),
	medicalHistory: z.string().optional(),
	allergies: z.array(z.string()).optional(),
	vaccinationStatus: z
		.object({
			rabies: z.boolean().optional(),
			dhlpp: z.boolean().optional(),
			fvrcp: z.boolean().optional(),
		})
		.optional(),
	emergencyContact: z
		.object({
			name: z.string(),
			phone: z.string(),
		})
		.optional(),
});

export type CreatePetRequest = z.infer<typeof CreatePetRequestSchema>;

export const PetEntitySchema = z.object({
	id: z.string().startsWith("pet_"),
	customerId: z.string().startsWith("user_"),
	name: z.string(),
	species: z.enum(["dog", "cat", "bird", "rabbit", "other"]),
	breed: z.string().nullable(),
	age: z.number().int().nonnegative().nullable(),
	weight: z.number().positive().nullable(),
	color: z.string().nullable(),
	photoUrl: z.string().url().nullable(),
	medicalHistory: z.string().nullable(),
	allergies: z.array(z.string()),
	createdAt: z.string().datetime(),
	updatedAt: z.string().datetime(),
});

export type Pet = z.infer<typeof PetEntitySchema>;

export type CreatePetResponse = Pet;

export const PETS_CREATE_ENDPOINT = "/api/v1/pets";
```

---

## 🛠️ API Client Implementation

### Axios Instance with Interceptors

```typescript
// lib/api-client.ts
import axios, {
	AxiosInstance,
	InternalAxiosRequestConfig,
	AxiosError,
} from "axios";
import { ApiResponse, ApiError, ERROR_CODES } from "@warmpawz/api-contracts";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

// Create axios instance
export const apiClient: AxiosInstance = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true, // Include cookies
	headers: {
		"Content-Type": "application/json",
	},
});

// Request Interceptor: Add auth token
apiClient.interceptors.request.use(
	(config: InternalAxiosRequestConfig) => {
		// Tokens are sent via HTTP-only cookies, but we can add custom headers if needed
		const requestId = `req_${Date.now()}_${Math.random()
			.toString(36)
			.substr(2, 9)}`;
		config.headers["X-Request-ID"] = requestId;
		return config;
	},
	(error) => Promise.reject(error)
);

// Response Interceptor: Handle errors universally
apiClient.interceptors.response.use(
	(response) => {
		// Validate response matches contract
		const data = response.data as ApiResponse;

		if (!data.success) {
			return Promise.reject(data.error);
		}

		return response;
	},
	(error: AxiosError<ApiError>) => {
		// Network error
		if (!error.response) {
			return Promise.reject({
				code: "NETWORK_ERROR",
				message: "Unable to connect to server",
			});
		}

		// Server returned error response
		const apiError = error.response.data?.error || {
			code: "UNKNOWN_ERROR",
			message: "An unexpected error occurred",
		};

		return Promise.reject(apiError);
	}
);

export default apiClient;
```

### Response Formatter

```typescript
// lib/api-helpers.ts
import { ApiSuccess, ApiError, ApiResponse } from "@warmpawz/api-contracts";

export function isApiSuccess<T>(
	response: ApiResponse<T>
): response is ApiSuccess<T> {
	return response.success === true;
}

export function isApiError(response: any): response is ApiError {
	return response.success === false;
}

// Type-safe response handling
export function handleApiResponse<T>(
	response: ApiResponse<T>,
	onSuccess: (data: T) => void,
	onError: (error: ApiError) => void
) {
	if (isApiSuccess(response)) {
		onSuccess(response.data);
	} else if (isApiError(response)) {
		onError(response.error);
	}
}
```

---

## 🎯 API Resource Classes

### Booking API

```typescript
// lib/api-resources/booking.ts
import apiClient from "../api-client";
import {
	BOOKINGS_CREATE_ENDPOINT,
	BOOKINGS_LIST_ENDPOINT,
	BOOKINGS_CANCEL_ENDPOINT,
	CreateBookingRequest,
	CreateBookingResponse,
	BookingsListQuery,
	BookingsListResponse,
	CancelBookingRequest,
	CancelBookingResponse,
	Booking,
} from "@warmpawz/api-contracts";

export const bookingApi = {
	async create(request: CreateBookingRequest): Promise<CreateBookingResponse> {
		const { data } = await apiClient.post(BOOKINGS_CREATE_ENDPOINT, request);
		return data.data;
	},

	async list(
		query?: Partial<BookingsListQuery>
	): Promise<BookingsListResponse> {
		const { data } = await apiClient.get(BOOKINGS_LIST_ENDPOINT, {
			params: query,
		});
		return data.data;
	},

	async get(bookingId: string): Promise<Booking> {
		const { data } = await apiClient.get(
			`${BOOKINGS_LIST_ENDPOINT}/${bookingId}`
		);
		return data.data;
	},

	async cancel(
		bookingId: string,
		request: CancelBookingRequest
	): Promise<CancelBookingResponse> {
		const { data } = await apiClient.post(
			BOOKINGS_CANCEL_ENDPOINT(bookingId),
			request
		);
		return data.data;
	},
};
```

### Vendor API

```typescript
// lib/api-resources/vendor.ts
import apiClient from "../api-client";
import {
	VENDORS_SEARCH_ENDPOINT,
	VENDORS_GET_ENDPOINT,
	VENDORS_AVAILABILITY_ENDPOINT,
	VendorsSearchQuery,
	VendorsSearchResponse,
	VendorDetail,
	VendorAvailabilityQuery,
	VendorAvailabilityResponse,
} from "@warmpawz/api-contracts";

export const vendorApi = {
	async search(
		query: Partial<VendorsSearchQuery>
	): Promise<VendorsSearchResponse> {
		const { data } = await apiClient.get(VENDORS_SEARCH_ENDPOINT, {
			params: query,
		});
		return data.data;
	},

	async get(vendorId: string): Promise<VendorDetail> {
		const { data } = await apiClient.get(VENDORS_GET_ENDPOINT(vendorId));
		return data.data;
	},

	async getAvailability(
		vendorId: string,
		query: VendorAvailabilityQuery
	): Promise<VendorAvailabilityResponse> {
		const { data } = await apiClient.get(
			VENDORS_AVAILABILITY_ENDPOINT(vendorId),
			{ params: query }
		);
		return data.data;
	},
};
```

### Auth API

```typescript
// lib/api-resources/auth.ts
import apiClient from "../api-client";
import {
	AUTH_LOGIN_ENDPOINT,
	AUTH_ME_ENDPOINT,
	LoginRequest,
	LoginResponse,
	MeResponse,
} from "@warmpawz/api-contracts";

export const authApi = {
	async login(request: LoginRequest): Promise<LoginResponse> {
		const { data } = await apiClient.post(AUTH_LOGIN_ENDPOINT, request);
		return data.data;
	},

	async getMe(): Promise<MeResponse> {
		const { data } = await apiClient.get(AUTH_ME_ENDPOINT);
		return data.data;
	},

	async logout(): Promise<void> {
		await apiClient.post("/api/v1/auth/logout", {});
	},
};
```

### Aggregate API Client

```typescript
// lib/api-client/index.ts
import { authApi } from "./auth";
import { bookingApi } from "./booking";
import { vendorApi } from "./vendor";
import { petApi } from "./pet";

export const api = {
	auth: authApi,
	bookings: bookingApi,
	vendors: vendorApi,
	pets: petApi,
};

export default api;
```

---

## 🔌 React Query Integration

### Query Hooks

```typescript
// hooks/queries/useBookings.ts
import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { bookingApi } from "@/lib/api-resources/booking";
import {
	BookingsListResponse,
	BookingsListQuery,
} from "@warmpawz/api-contracts";

export function useBookings(
	query?: Partial<BookingsListQuery>
): UseQueryResult<BookingsListResponse> {
	return useQuery({
		queryKey: ["bookings", query],
		queryFn: () => bookingApi.list(query),
		staleTime: 5 * 60 * 1000, // 5 minutes
		retry: 2,
		retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
	});
}

export function useBooking(bookingId: string) {
	return useQuery({
		queryKey: ["booking", bookingId],
		queryFn: () => bookingApi.get(bookingId),
		staleTime: 10 * 60 * 1000,
	});
}
```

### Mutation Hooks

```typescript
// hooks/mutations/useCreateBooking.ts
import {
	useMutation,
	useQueryClient,
	UseMutationResult,
} from "@tanstack/react-query";
import { bookingApi } from "@/lib/api-resources/booking";
import { CreateBookingRequest, Booking } from "@warmpawz/api-contracts";

export function useCreateBooking(): UseMutationResult<
	Booking,
	any,
	CreateBookingRequest
> {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (request) => bookingApi.create(request),
		onSuccess: (newBooking) => {
			// Invalidate list queries
			queryClient.invalidateQueries({
				queryKey: ["bookings"],
			});

			// Update specific booking in cache
			queryClient.setQueryData(["booking", newBooking.id], newBooking);
		},
		onError: (error) => {
			console.error("Failed to create booking:", error);
		},
	});
}
```

---

## 🛣️ API Route Implementation (Next.js)

### Pattern: Thin Adapter

```typescript
// apps/customer-web/src/app/api/v1/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
	CreateBookingRequestSchema,
	ApiSuccessSchema,
	ApiErrorSchema,
	ERROR_CODES,
} from "@warmpawz/api-contracts";
import { BookingService } from "@warmpawz/services";
import { SupabaseBookingRepository } from "@/infrastructure/repositories";

/**
 * Create a new booking
 * This is a thin adapter - minimal logic, delegates to services
 */
export async function POST(request: NextRequest) {
	try {
		// 1. Parse request body
		const body = await request.json();

		// 2. Validate against contract
		const parseResult = CreateBookingRequestSchema.safeParse(body);
		if (!parseResult.success) {
			return NextResponse.json(
				{
					success: false,
					data: null,
					error: {
						code: ERROR_CODES.INVALID_REQUEST,
						message: "Invalid request format",
						details: parseResult.error.flatten(),
					},
					meta: {
						timestamp: new Date().toISOString(),
						requestId: request.headers.get("x-request-id") || "unknown",
						version: "v1",
					},
				},
				{ status: 400 }
			);
		}

		// 3. Extract identity from middleware
		const userId = request.headers.get("x-user-id");
		if (!userId) {
			return NextResponse.json(
				{
					success: false,
					data: null,
					error: {
						code: ERROR_CODES.UNAUTHORIZED,
						message: "Authentication required",
					},
					meta: {
						timestamp: new Date().toISOString(),
						requestId: request.headers.get("x-request-id") || "unknown",
						version: "v1",
					},
				},
				{ status: 401 }
			);
		}

		// 4. Call service layer (business logic lives there)
		const bookingService = new BookingService(new SupabaseBookingRepository());

		const result = await bookingService.createBooking(userId, parseResult.data);

		// 5. Handle service result
		if (result.isErr()) {
			const status =
				result.error.code === ERROR_CODES.BOOKING_SLOT_UNAVAILABLE
					? 422
					: result.error.code === ERROR_CODES.NOT_FOUND
					? 404
					: 500;

			return NextResponse.json(
				{
					success: false,
					data: null,
					error: {
						code: result.error.code,
						message: result.error.message,
					},
					meta: {
						timestamp: new Date().toISOString(),
						requestId: request.headers.get("x-request-id") || "unknown",
						version: "v1",
					},
				},
				{ status }
			);
		}

		// 6. Return success response
		return NextResponse.json(
			{
				success: true,
				data: result.value,
				error: null,
				meta: {
					timestamp: new Date().toISOString(),
					requestId: request.headers.get("x-request-id") || "unknown",
					version: "v1",
				},
			},
			{ status: 201 }
		);
	} catch (error) {
		console.error("Booking creation error:", error);

		return NextResponse.json(
			{
				success: false,
				data: null,
				error: {
					code: ERROR_CODES.INTERNAL_ERROR,
					message: "An unexpected error occurred",
				},
				meta: {
					timestamp: new Date().toISOString(),
					requestId: request.headers.get("x-request-id") || "unknown",
					version: "v1",
				},
			},
			{ status: 500 }
		);
	}
}
```

---

## ✅ Best Practices

### 1. Always Validate Input

```typescript
// ✅ Good
const schema = CreateBookingRequestSchema;
const result = schema.safeParse(userInput);

if (!result.success) {
	return error(400, "INVALID_REQUEST", result.error.message);
}

// ❌ Bad
const booking = userInput as Booking; // Dangerous!
```

### 2. Semantic Error Codes

```typescript
// ✅ Good
{
  code: 'BOOKING_SLOT_UNAVAILABLE',
  message: 'The selected time slot is no longer available'
}

// ❌ Bad
{
  error: 'Foreign key constraint violation on table bookings'
}
```

### 3. Cache Management

```typescript
// ✅ Good
const queryClient = useQueryClient();

useMutation({
  mutationFn: createBooking,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['bookings'] });
  }
});

// ❌ Bad (manual refetch)
const { refetch } = useQuery({...});
useMutation({
  mutationFn: createBooking,
  onSuccess: refetch
});
```

### 4. Proper Loading States

```typescript
// ✅ Good
const { data, isLoading, error } = useQuery({...});

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;

return <Content data={data} />;

// ❌ Bad
const { data } = useQuery({...});
return <Content data={data} />;  // Might be null!
```

---

## 📊 API Versioning

```typescript
// Always prefix with version
// /api/v1/bookings       ← Current version
// /api/v2/bookings       ← Future version (breaking changes)
// /api/v1/bookings/legacy  ← Deprecated endpoint

// In package.json or constant
export const API_VERSION = "v1" as const;
```

---

**END OF API CLIENT ARCHITECTURE DOCUMENT**

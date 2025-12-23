# Warmpawz NextJS Architecture Design

**Version:** 1.0.0  
**Status:** PHASE 0 - CONTRACT & RULE FREEZE  
**Last Updated:** December 23, 2025

---

## 🎯 Executive Summary

This document defines the complete architecture for migrating Warmpawz from Vite + Deno monolith to **Next.js App Router with AWS microservices**. The migration is **API-contract-first**, with strict separation of concerns across 3 independent Next.js deployments.

### Architecture Pillars

| Pillar               | Implementation                                                      |
| -------------------- | ------------------------------------------------------------------- |
| **Frontend**         | 3 separate Next.js deployments (App Router)                         |
| **Shared Code**      | `packages/domain`, `packages/api-contracts`, `packages/shared-libs` |
| **BFF Layer**        | Next.js API routes (thin adapter)                                   |
| **Backend Services** | AWS Lambda microservices                                            |
| **Data Layer**       | Supabase KV (temp) + Aurora (Phase 5) + DynamoDB (Phase 5)          |
| **Authentication**   | 3 separate Cognito user pools (customer, vendor, admin)             |
| **File Storage**     | S3 (replaces Supabase Storage)                                      |
| **State Management** | Context + TanStack Query + Zustand                                  |
| **API Contracts**    | Zod-validated, TypeScript-first                                     |
| **Mobile Support**   | Shared `packages/domain` for React Native                           |

---

## 🏗️ Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CDN / CloudFront                          │
└────────┬─────────────┬─────────────┬────────────────────────┘
         │             │             │
    ┌────▼─────┐  ┌────▼─────┐  ┌───▼──────┐
    │ Customer  │  │  Vendor   │  │  Admin   │
    │ Web       │  │  Web      │  │  Portal  │
    │(Next.js)  │  │(Next.js)  │  │(Next.js) │
    └────┬─────┘  └────┬─────┘  └───┬──────┘
         │             │             │
    ┌────▼─────────────▼─────────────▼────┐
    │         API Gateway + Lambda         │
    │  (BFF layer - thin adapter only)     │
    └────────────┬────────────────────────┘
                 │
    ┌────────────▼────────────────────────┐
    │    AWS Lambda Microservices         │
    │  ├── Booking Service                │
    │  ├── Vendor Service                 │
    │  ├── Customer Service               │
    │  ├── Payment Service                │
    │  ├── Notification Service           │
    │  └── Admin Service                  │
    └────────────┬────────────────────────┘
                 │
    ┌────────────┴────────────────────────┐
    │      Data Layer                     │
    │  ├── Aurora (Postgres)              │
    │  ├── DynamoDB (Cache/Idempotency)   │
    │  └── S3 (Files)                     │
    └─────────────────────────────────────┘
```

---

## 📦 Repository Structure (Monorepo)

```
warmpawz/
├── 📱 apps/
│   ├── customer-web/           # Customer app (Next.js)
│   ├── vendor-web/             # Vendor app (Next.js)
│   ├── admin-web/              # Admin portal (Next.js)
│   └── mobile/                 # React Native/Expo (future)
│
├── 📦 packages/
│   ├── api-contracts/          # Zod schemas + TypeScript types
│   ├── domain/                 # Pure business logic (0 framework deps)
│   ├── services/               # Application services
│   ├── shared-libs/            # Utilities, helpers, constants
│   └── types/                  # Global TypeScript definitions
│
├── 🔧 infrastructure/
│   ├── lambda/                 # Lambda function source code
│   ├── cdk/                    # AWS CDK definitions
│   └── terraform/              # IaC (alternative to CDK)
│
├── 📚 docs/
│   ├── ARCHITECTURE.md         # This file
│   ├── FOLDER_STRUCTURE.md     # Detailed folder layout
│   ├── COMPONENT_ARCHITECTURE.md
│   ├── API_CLIENT_ARCHITECTURE.md
│   └── API_CONTRACTS.md        # API contract specifications
│
└── 📋 Root Config Files
    ├── package.json            # Monorepo root
    ├── pnpm-workspace.yaml     # pnpm workspaces
    ├── tsconfig.base.json      # Shared TypeScript config
    ├── .eslintrc.json          # Shared ESLint rules
    └── turbo.json              # Turborepo config

```

---

## 🔐 Authentication Architecture

### Per-Persona Cognito Pools

```typescript
// 3 separate Cognito User Pools
{
  "CustomerPool": {
    "poolId": "us-east-1_xxxxxxxxx",
    "clientId": "customer-client-id",
    "domain": "customer-auth.warmpawz.com",
    "redirectUri": "https://customer.warmpawz.com/auth/callback"
  },
  "VendorPool": {
    "poolId": "us-east-1_yyyyyyyyy",
    "clientId": "vendor-client-id",
    "domain": "vendor-auth.warmpawz.com",
    "redirectUri": "https://vendor.warmpawz.com/auth/callback"
  },
  "AdminPool": {
    "poolId": "us-east-1_zzzzzzzzz",
    "clientId": "admin-client-id",
    "domain": "admin-auth.warmpawz.com",
    "redirectUri": "https://admin.warmpawz.com/auth/callback"
  }
}
```

### Auth Flow (HTTP-Only Cookies)

```
┌──────────────────┐
│  Frontend App    │
│  (Next.js)       │
└────────┬─────────┘
         │
    1. POST /auth/login
         │
         ▼
┌──────────────────────────────────────┐
│  Next.js API Route                   │
│  /api/v1/auth/login                  │
│  (thin adapter)                      │
└────────┬─────────────────────────────┘
         │
    2. Call Cognito (AWS SDK)
         │
         ▼
┌──────────────────────────────────────┐
│  AWS Cognito User Pool               │
│  (return JWT tokens + user data)     │
└────────┬─────────────────────────────┘
         │
    3. Set secure HTTP-only cookie
         │
         ▼
┌──────────────────┐
│  Frontend        │
│  (cookie stored) │
└──────────────────┘

ALL SUBSEQUENT REQUESTS:
- Cookie sent automatically
- Next.js middleware validates cookie
- Lambda receives validated identity
```

### Session Cookie Format

```typescript
// Secure, HTTP-only cookie set by Next.js API route
{
  name: "__warmpawz_session",
  value: "encrypted_jwt_token",
  httpOnly: true,
  secure: true,        // HTTPS only
  sameSite: "strict",
  maxAge: 3600,        // 1 hour
  path: "/"
}

// Refresh token (longer lived, also HTTP-only)
{
  name: "__warmpawz_refresh",
  value: "encrypted_refresh_token",
  httpOnly: true,
  secure: true,
  sameSite: "strict",
  maxAge: 604800,      // 7 days
  path: "/"
}
```

---

## 📡 API Contract Architecture (Phase 0)

### Principle: API-Contract-First

All API shapes are **frozen early** in Phase 0. Frontend & backend are developed against frozen contracts.

### Response Envelope (Universal)

**Success Response:**

```typescript
{
  success: true,
  data: {
    // ... response payload
  },
  error: null,
  meta: {
    timestamp: "2025-12-23T10:30:00Z",
    requestId: "req_01JBXYZ",
    version: "v1"
  }
}
```

**Error Response:**

```typescript
{
  success: false,
  data: null,
  error: {
    code: "BOOKING_SLOT_UNAVAILABLE",     // Semantic, not technical
    message: "Selected slot is no longer available",
    details: {
      availableSlots: ["2025-12-24T10:00:00Z", "2025-12-24T11:00:00Z"],
      vendorId: "vendor_xyz"
    }
  },
  meta: {
    timestamp: "2025-12-23T10:30:00Z",
    requestId: "req_01JBXYZ",
    version: "v1"
  }
}
```

### Error Code Categories

| Category           | Examples                                  | HTTP Status |
| ------------------ | ----------------------------------------- | ----------- |
| **Validation**     | INVALID_EMAIL, INVALID_PHONE              | 400         |
| **Authentication** | UNAUTHORIZED, INVALID_TOKEN               | 401         |
| **Authorization**  | FORBIDDEN, INSUFFICIENT_PERMISSIONS       | 403         |
| **Resource**       | NOT_FOUND, DUPLICATE_ENTRY                | 404/409     |
| **Business Logic** | BOOKING_SLOT_UNAVAILABLE, VENDOR_INACTIVE | 422         |
| **Server**         | INTERNAL_ERROR, SERVICE_UNAVAILABLE       | 500/503     |

### ID Format (Opaque ULIDs)

All IDs must be **unguessable, opaque ULIDs** with type prefixes:

```typescript
// Format: ${prefix}_${ulid}
"user_01JBXV7F41ANKJSDQQ69G69FP3"      // Customer/Vendor/Admin
"booking_01JBXV7F41ANKJSDQQ69G69FP3"   // Booking
"vendor_01JBXV7F41ANKJSDQQ69G69FP3"    // Vendor profile
"service_01JBXV7F41ANKJSDQQ69G69FP3"   // Service offering
"payment_01JBXV7F41ANKJSDQQ69G69FP3"   // Payment transaction

// Forbidden:
123, "booking_123", "vendor-456", sequential IDs
```

---

## 🧠 Domain Logic Architecture

### Core Principle: Framework-Free Business Logic

Domain logic lives in `packages/domain/` with **zero dependencies** on Next.js, AWS, or any external framework.

```typescript
// ✅ CORRECT - Pure domain logic
packages / domain / booking / rules.ts;

export function validateBookingTimeSlot(
	requestedSlot: TimeSlot,
	existingBookings: Booking[],
	vendorAvailability: Availability[]
): Result<ValidatedSlot, BookingError> {
	// Pure business logic, no imports from frameworks
	if (requestedSlot.startTime < new Date()) {
		return Err({ code: "PAST_DATE" });
	}
	// ... more validation
	return Ok(validatedSlot);
}

// ❌ WRONG - Framework-dependent
import { NextRequest } from "next/server";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function validateBookingTimeSlot(req: NextRequest) {
	const db = new DynamoDBClient();
	// ...
}
```

### Domain Layer Structure

```
packages/domain/
├── booking/
│   ├── types.ts              # Domain entities (Booking, BookingStatus, etc.)
│   ├── repository.ts         # Interface only (no impl)
│   ├── rules.ts              # Pure business logic
│   ├── state-machine.ts      # Booking lifecycle state transitions
│   └── errors.ts             # Domain-specific errors
│
├── vendor/
│   ├── types.ts
│   ├── repository.ts
│   ├── rules.ts
│   ├── capabilities.ts       # Role-based capabilities
│   └── errors.ts
│
├── customer/
│   ├── types.ts
│   ├── repository.ts
│   ├── rules.ts
│   └── errors.ts
│
├── payment/
│   ├── types.ts
│   ├── repository.ts
│   ├── rules.ts
│   └── errors.ts
│
└── shared/
    ├── result.ts             # Result<T, E> type
    ├── errors.ts             # Common errors
    └── types.ts              # Common domain types
```

### Repository Pattern (Abstraction)

Repositories are **interfaces only** in domain layer. Implementations live in infrastructure/adapters.

```typescript
// packages/domain/booking/repository.ts
export interface IBookingRepository {
	save(booking: ValidatedBooking): Promise<Result<Booking, RepositoryError>>;
	findById(id: string): Promise<Result<Booking | null, RepositoryError>>;
	findByVendorId(vendorId: string): Promise<Result<Booking[], RepositoryError>>;
	findByCustomerId(
		customerId: string
	): Promise<Result<Booking[], RepositoryError>>;
}

// Implementation in infrastructure layer (replaceable)
// Phase 2: SupabaseBookingRepository (KV)
// Phase 5: AuroraBookingRepository (SQL) or DynamoBookingRepository
```

---

## 🌐 API Routes Architecture (BFF Layer)

### Principle: Thin Adapter Only

Next.js API routes are **thin adapters** that:

1. Parse HTTP request
2. Call service layer
3. Format response envelope
4. Handle errors semantically
5. Manage sessions

**They DO NOT:**

- Contain business logic
- Call databases directly
- Make decisions about data

### API Route Structure

```
apps/{app-name}/src/app/api/v1/
├── auth/
│   ├── login/route.ts              # POST /api/v1/auth/login
│   ├── logout/route.ts             # POST /api/v1/auth/logout
│   ├── refresh/route.ts            # POST /api/v1/auth/refresh
│   └── me/route.ts                 # GET /api/v1/auth/me
│
├── bookings/
│   ├── route.ts                    # GET /api/v1/bookings (list)
│   │                               # POST /api/v1/bookings (create)
│   └── [id]/
│       ├── route.ts                # GET /api/v1/bookings/[id]
│       │                           # PUT /api/v1/bookings/[id]
│       └── confirm/route.ts        # POST /api/v1/bookings/[id]/confirm
│
├── vendors/
│   ├── route.ts                    # GET /api/v1/vendors (search)
│   └── [id]/
│       ├── route.ts                # GET /api/v1/vendors/[id]
│       └── availability/route.ts   # GET /api/v1/vendors/[id]/availability
│
└── middleware/
    ├── auth.ts                     # Auth validation middleware
    ├── error-handler.ts            # Centralized error handling
    └── response-formatter.ts       # Format all responses
```

### API Route Example

```typescript
// apps/customer-web/src/app/api/v1/bookings/route.ts
import { NextRequest, NextResponse } from "next/server";
import {
	validateRequest,
	respondWithError,
	respondWithSuccess,
} from "@/lib/api-helpers";
import { BookingService } from "@warmpawz/services";
import { CreateBookingRequestSchema } from "@warmpawz/api-contracts";

export async function POST(request: NextRequest) {
	try {
		// 1. Parse & validate request
		const body = await request.json();
		const parseResult = CreateBookingRequestSchema.safeParse(body);

		if (!parseResult.success) {
			return respondWithError(
				400,
				"INVALID_REQUEST",
				parseResult.error.message
			);
		}

		// 2. Extract identity from middleware-set header
		const userId = request.headers.get("x-user-id");
		if (!userId) {
			return respondWithError(401, "UNAUTHORIZED", "No valid session");
		}

		// 3. Call service (business logic lives there)
		const bookingService = new BookingService(
			new SupabaseBookingRepository(),
			new SupabaseVendorRepository()
		);

		const result = await bookingService.createBooking(userId, parseResult.data);

		// 4. Format response
		if (result.isErr()) {
			return respondWithError(422, result.error.code, result.error.message);
		}

		return respondWithSuccess(201, result.value, {
			message: "Booking created successfully",
		});
	} catch (error) {
		return respondWithError(
			500,
			"INTERNAL_ERROR",
			"An unexpected error occurred"
		);
	}
}
```

---

## 🔄 Request Flow (Complete)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. USER INTERACTION (Browser/App)                                   │
│    User clicks "Book Service" button                                 │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 2. REACT COMPONENT USES ZUSTAND + REACT QUERY                       │
│    const mutation = useMutation(bookingApi.create)                  │
│    mutation.mutate({ serviceId, vendorId, slotId })                 │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 3. API CLIENT (packages/api-client)                                 │
│    - Validates request against Zod schema                           │
│    - Adds auth header (from cookie)                                 │
│    - Makes POST /api/v1/bookings                                    │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 4. NEXT.JS MIDDLEWARE (Auth validation)                             │
│    - Validates cookie/JWT                                           │
│    - Sets x-user-id header                                          │
│    - Continues to route handler                                     │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 5. API ROUTE HANDLER (apps/*/src/app/api/v1/bookings/route.ts)     │
│    - Parses request body                                            │
│    - Validates schema with Zod                                      │
│    - Extracts identity from header (set by middleware)              │
│    - Calls BookingService                                           │
│    - Formats response envelope                                      │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 6. SERVICE LAYER (packages/services)                                │
│    class BookingService {                                           │
│      async createBooking(userId, request) {                         │
│        // Orchestrates domain + repository                          │
│      }                                                              │
│    }                                                                │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 7. DOMAIN LAYER (packages/domain)                                   │
│    // Pure business logic - no framework knowledge                  │
│    validateBookingTimeSlot(slot, existingBookings, availability)    │
│    checkVendorCapabilities(vendor, service)                         │
│    validatePaymentAmount(booking, vendor)                           │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 8. REPOSITORY LAYER (Phase 2: Supabase KV)                          │
│    await bookingRepository.save(validatedBooking)                   │
│    // Returns booking with ID                                       │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 9. RESPONSE PROPAGATES BACK UP STACK                                │
│    Service → API Route → Middleware → Response Header               │
└────────────────────┬────────────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────────────┐
│ 10. REACT QUERY CACHE UPDATED                                       │
│    onSuccess callback fires                                         │
│    Component re-renders with new booking                            │
│    Zustand global state updated if needed                           │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📦 State Management Strategy

### Layer 1: Server State (React Query)

```typescript
// Managed by TanStack Query
useQuery({
	queryKey: ["bookings", userId],
	queryFn: () => api.bookings.list(userId),
	staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Layer 2: Client State (Zustand)

```typescript
// Global client-side state (not from server)
export const useUIStore = create((set) => ({
	isDrawerOpen: false,
	currentTab: "active",
	setDrawerOpen: (open) => set({ isDrawerOpen: open }),
}));
```

### Layer 3: Component Local State (useState)

```typescript
// Component-specific state
const [searchQuery, setSearchQuery] = useState("");
const [filters, setFilters] = useState<Filters>({});
```

### Layer 4: URL State (Next.js Router)

```typescript
// Persistent state in URL
const router = useRouter();
const { serviceType, location, minRating } = router.query;
// Bookmarkable, shareable URLs
```

### Priority Order

1. **Server state first** (React Query) - source of truth
2. **URL state** for navigation/filtering
3. **Zustand** for global UI state only
4. **Component state** for temporary UI data

---

## 🎨 Component Structure

### File Organization Per App

```
apps/customer-web/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (auth)/                       # Auth layout group
│   │   ├── (protected)/                  # Protected routes layout group
│   │   ├── page.tsx                      # Home page
│   │   └── layout.tsx                    # Root layout
│   │
│   ├── components/                       # UI Components
│   │   ├── booking/
│   │   │   ├── BookingCard.tsx
│   │   │   ├── BookingForm.tsx
│   │   │   ├── BookingHistory.tsx
│   │   │   └── BookingStatus.tsx
│   │   │
│   │   ├── vendor/
│   │   │   ├── VendorCard.tsx
│   │   │   ├── VendorProfile.tsx
│   │   │   └── VendorReviews.tsx
│   │   │
│   │   ├── common/
│   │   │   ├── Navbar.tsx
│   │   │   ├── Footer.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   │
│   │   └── ui/                           # Radix UI + Tailwind
│   │       ├── Button.tsx
│   │       ├── Dialog.tsx
│   │       ├── Input.tsx
│   │       └── ...
│   │
│   ├── lib/
│   │   ├── api-client.ts                 # HTTP client instance
│   │   ├── api-helpers.ts                # Response formatting
│   │   ├── hooks.ts                      # Custom hooks
│   │   └── utils.ts                      # Utility functions
│   │
│   ├── hooks/
│   │   ├── useBooking.ts                 # Domain-specific hooks
│   │   ├── useVendorSearch.ts
│   │   └── usePayment.ts
│   │
│   ├── stores/
│   │   ├── uiStore.ts                    # Zustand stores
│   │   ├── filterStore.ts
│   │   └── cartStore.ts
│   │
│   ├── context/
│   │   └── AuthContext.tsx               # Auth provider wrapper
│   │
│   └── middleware.ts                     # Next.js middleware (auth)
│
├── next.config.js
├── tsconfig.json
└── tailwind.config.js
```

---

## 📋 Development Environment Setup

### Package Manager: pnpm

```bash
# Install pnpm first
npm install -g pnpm

# Install all dependencies
pnpm install

# Run specific app
pnpm --filter customer-web dev    # Port 3001
pnpm --filter vendor-web dev      # Port 3002
pnpm --filter admin-web dev       # Port 3003

# Build all
pnpm build

# Build specific app
pnpm --filter customer-web build
```

### Environment Variables Per App

```bash
# .env.local (customer-web)
NEXT_PUBLIC_API_URL=http://localhost:3000  # Own API routes
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_CLIENT_ID=xxx
NEXT_PUBLIC_COGNITO_POOL_ID=xxx

# apps/vendor-web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_COGNITO_REGION=us-east-1
NEXT_PUBLIC_COGNITO_CLIENT_ID=yyy
NEXT_PUBLIC_COGNITO_POOL_ID=yyy
```

---

## 🔄 Migration Phases Summary

| Phase       | Objective                    | Duration | Key Output                                |
| ----------- | ---------------------------- | -------- | ----------------------------------------- |
| **Phase 0** | Contract & Rule Freeze       | 2 weeks  | API contracts, Cursor rules, domain types |
| **Phase 1** | Domain Extraction            | 3 weeks  | Pure business logic, no framework deps    |
| **Phase 2** | Temporary Backend (Supabase) | 4 weeks  | Next.js + Supabase KV validation          |
| **Phase 3** | Frontend Migration           | 3 weeks  | 3 functional Next.js apps                 |
| **Phase 4** | AWS Foundation               | 2 weeks  | Infrastructure (no code changes)          |
| **Phase 5** | Backend Swap                 | 2 weeks  | Replace Supabase → AWS Lambda             |
| **Phase 6** | Optimization                 | 2 weeks  | Performance, caching, monitoring          |

---

## ✅ Phase 0 Deliverables

By end of Phase 0, you will have:

- ✅ API contract specifications (OpenAPI + Zod)
- ✅ TypeScript type definitions
- ✅ Domain entity definitions (framework-free)
- ✅ Repository interfaces
- ✅ Error codes & response envelopes
- ✅ Auth flow documentation
- ✅ Cursor agent rules locked
- ✅ Development environment setup guide

---

## 🛡️ Hard Rules (Non-Negotiable)

1. ❌ **NO Supabase imports in frontend components**

   - Only in Next.js API routes during Phase 2
   - Only in repository layer during Phase 5

2. ❌ **NO business logic in Next.js API routes**

   - Routes are thin adapters only
   - Logic lives in service/domain layers

3. ❌ **NO JSX in packages/domain**

   - Domain is pure `.ts`, no `.tsx`
   - Must run without React

4. ❌ **NO changing API contracts to fit implementation**

   - Contracts frozen in Phase 0
   - Implementation must follow contracts

5. ❌ **NO database schema leaking to frontend**

   - API responses are semantic, not table-based
   - Use domain-specific field names

6. ✅ **Frontend must survive complete backend deletion**
   - Can swap Supabase → AWS without frontend changes
   - Can swap HTTP → mock with same contract

---

## 📞 Next Steps

1. **Create `packages/api-contracts`** with Zod schemas for all endpoints
2. **Define domain entities** in `packages/domain`
3. **Document API contracts** in OpenAPI format
4. **Set up Next.js projects** with proper config
5. **Configure authentication** with Cognito
6. **Implement repository interfaces**
7. **Write domain business logic** (pure TS)

---

**END OF ARCHITECTURE DOCUMENT**

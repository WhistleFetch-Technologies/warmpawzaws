# ⚡ Quick Summary - Warmpawz NextJS Architecture

**Status:** PHASE 0 - READY TO START  
**Created:** December 23, 2025

---

## 🎯 One-Minute Summary

You're migrating from **Vite monolith** to **3 separate Next.js apps** backed by **AWS Lambda microservices**.

### The Stack

```
Customer App (Next.js) ─┐
Vendor App (Next.js)   ├─→ API Gateway → Lambda → Aurora + DynamoDB
Admin App (Next.js)    ┘         ↑
                                 │
                            Cognito Auth
                        (3 separate pools)
```

### The Principle

> **Frontend never knows which backend it's talking to.**
>

---

## 📁 Your New Structure

```
warmpawz/
├── apps/customer-web        ← React + Next.js (Port 3001)
├── apps/vendor-web          ← React + Next.js (Port 3002)
├── apps/admin-web           ← React + Next.js (Port 3003)
│
├── packages/api-contracts   ← Zod schemas (FROZEN)
├── packages/domain          ← Pure business logic (no imports)
├── packages/services        ← Orchestration layer
└── packages/shared-libs     ← Utilities
```

---

## 🔐 Your Decisions (Locked In)

| Decision               | You Chose                                              |
| ---------------------- | ------------------------------------------------------ |
| **Multi-App Strategy** | 3 separate Next.js deployments (not 1 app with routes) |
| **Authentication**     | 3 separate Cognito pools (customer, vendor, admin)     |
| **Code Isolation**     | Strict isolation - NO shared code between apps         |
| **API Routes**         | Thin adapters only (no business logic)                 |
| **Phase Focus**        | Phase 0 - Freeze contracts first                       |
| **App Router**         | Next.js App Router (new, better)                       |
| **State Management**   | Context + React Query + Zustand                        |
| **API Contracts**      | Zod-based, TypeScript-first                            |
| **Mobile Support**     | Share `packages/domain` with React Native              |

---

## 📚 Your Documentation (5 Files)

Read in this order:

1. **NEXTJS_ARCHITECTURE_DESIGN.md** (15 min)
   - System design, deployment, API contracts overview
2. **NEXTJS_FOLDER_STRUCTURE.md** (10 min)
   - Complete folder layout with examples
3. **NEXTJS_COMPONENT_ARCHITECTURE.md** (15 min)
   - Component patterns, hooks, state management
4. **NEXTJS_API_CLIENT_ARCHITECTURE.md** (15 min)
   - Zod contracts, API client, React Query integration
5. **NEXTJS_DEVELOPMENT_WORKFLOW.md** (20 min)
   - Setup, commands, testing, deployment

**Total reading time: ~75 minutes**

---

## ⚙️ Quick Setup

```bash
# 1. Clone and install
git clone https://github.com/ketan0103/warmpawzaws.git
cd warmpawzaws
npm install -g pnpm
pnpm install

# 2. Start development
pnpm run dev

# 3. Visit apps
# Customer: http://localhost:3001
# Vendor:   http://localhost:3002
# Admin:    http://localhost:3003
```

---

## 🏛️ Architecture Principles (6 Core Rules)

### 1️⃣ API-Contract-First

```
Define contracts in Phase 0 → Frontend & backend build against contracts
→ Contracts are frozen → No changes during implementation
```

### 2️⃣ Framework-Free Domain

```typescript
// ✅ GOOD: Pure TypeScript in domain/
export function validateBooking(slot, existing) {
  // Only domain imports
}

// ❌ BAD: Has framework deps
import { NextRequest } from 'next/server';
export async function validateBooking(req) { ... }
```

### 3️⃣ Thin Adapter Layer

```typescript
// ✅ API routes: 10 lines max
export async function POST(request) {
	const parsed = schema.safeParse(await request.json());
	if (!parsed.success) return error(400, "INVALID");

	const result = await service.create(parsed.data);
	return result.isErr() ? error(422, result.error) : success(201, result.value);
}

// ❌ API routes: NOT your business logic place
export async function POST(request) {
	const db = new DynamoDBClient();
	// Complex validation logic
	// Business rules
	// Calculations
}
```

### 4️⃣ Frontend Never Knows Backend

```typescript
// Frontend sees:
const response = await fetch('/api/v1/bookings', {...});
// { success: true, data: {...}, error: null }

// Frontend NEVER sees:
// - Table names (bookings, bookings_payments, etc.)
// - Database fields (vendor_id_fk, created_ts, etc.)
// - SQL relationships
```

### 5️⃣ Semantic Errors

```json
// ✅ GOOD: Business meaning
{
  "code": "BOOKING_SLOT_UNAVAILABLE",
  "message": "Selected slot is no longer available"
}

// ❌ BAD: Technical error
{
  "error": "Foreign key constraint violation on table bookings_services"
}
```

### 6️⃣ Opaque IDs

```typescript
// ✅ Format: {type}_{ulid}
"user_01JBXV7F41ANKJSDQQ69G69FP3"
"booking_01JBXV7F41ANKJSDQQ69G69FP3"
"vendor_01JBXV7F41ANKJSDQQ69G69FP3"

// ❌ WRONG
123, "booking_456", sequential IDs
```

---

## 🔄 Component Data Flow

```
┌─────────────────────────────┐
│ User Clicks "Book"          │
└─────────────┬───────────────┘
              │
┌─────────────▼───────────────┐
│ React Component (BookingForm)│
│ - useState for form input    │
│ - useMutation for API call  │
└─────────────┬───────────────┘
              │
┌─────────────▼───────────────────────────────┐
│ API Client (lib/api-resources/booking.ts)   │
│ - bookingApi.create(data)                   │
│ - Validates against Zod schema              │
└─────────────┬───────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│ Next.js API Route (app/api/v1/bookings)    │
│ - Parse & validate request                 │
│ - Extract user ID from middleware          │
│ - Call service layer                       │
│ - Format response envelope                 │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│ Service Layer (BookingService)             │
│ - Orchestrate domain + repository          │
│ - Call domain business logic               │
│ - Persist via repository                   │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│ Domain Layer (domain/booking/rules.ts)     │
│ - Pure business logic                      │
│ - Validate time slot                       │
│ - Check capabilities                       │
│ - Return Result<Booking, Error>            │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼──────────────────────────────┐
│ - Return saved booking with ID             │
└─────────────┬──────────────────────────────┘
              │
┌─────────────▼───────────────────────────────┐
│ Response flows back up through all layers   │
│ React Query cache updated                  │
│ Component re-renders with new booking      │
└───────────────────────────────────────────┘
```

---

## 📊 State Management Layers

```
Layer 4: URL State (Next.js Router)
  → /bookings?status=confirmed&page=2
  → Used for filtering, pagination, deep links
  → Most persistent

Layer 3: Server State (React Query)
  → useQuery(['bookings']) → data from /api/v1/bookings
  → Source of truth for server data
  → Automatic caching & invalidation

Layer 2: Global Client State (Zustand)
  → useFilterStore() → { isDrawerOpen, currentTab }
  → UI state shared across components
  → Not from server

Layer 1: Local Component State (useState)
  → const [searchText, setSearchText] = useState('')
  → Temporary input values
  → Most ephemeral
```

---

## 🚀 Phase Timeline (16 Weeks)

```
Week 1-2:    Phase 0 - Freeze contracts & domain types
Week 3-5:    Phase 1 - Extract business logic
Week 10-12:  Phase 3 - Complete UI, mobile apps
Week 13-14:  Phase 4 - AWS infrastructure
Week 17-18:  Phase 6 - Optimization & monitoring
```

---

## 💡 Key Insights

### Why Separate Next.js Apps?

- ✅ Independent scaling
- ✅ Stricter isolation
- ✅ Separate CI/CD pipelines
- ✅ Different deployment strategies per persona
- ❌ More setup complexity (worth it)

### Why Freeze Contracts in Phase 0?

- ✅ Frontend & backend can work in parallel
- ✅ Contracts become contract test cases
- ✅ Easier to swap backend later
- ✅ Reduces coupling & integration surprises

### Why API Routes = Thin Adapters?

- ✅ Business logic lives in domain (testable without DB)
- ✅ Easy to move to Lambda in Phase 5
- ✅ Clear separation of concerns
- ✅ Frontend never knows backend implementation

### Why Opaque ULIDs?

- ✅ Unguessable (security)
- ✅ Type-prefixed (semantic)
- ✅ Sortable (can order by ID)
- ✅ Globally unique (no collision risk)

---

## 🎓 Learning Order

**Day 1:** Read all 5 documents  
**Day 2:** Setup monorepo with pnpm  
**Day 3:** Create Next.js app templates  
**Day 4:** Define API contracts in Zod  
**Day 5:** Create domain entity types  
**Week 2:** Implement domain business logic  
**Week 3:** Build API routes (thin adapters)  
**Week 4:** Build React components

---

## ⚠️ Hard Rules (Non-Negotiable)

```typescript
// ❌ These are ALWAYS wrong:

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';     // NO AWS SDK in frontend
import React from 'react'; // in packages/domain              // NO React in domain
export async function route(req: NextRequest) { ... logic ... } // NO logic in routes
{ error: 'Foreign key constraint violation' }                  // NO technical errors in API
"booking_123"                                                  // NO sequential IDs

// ✅ These are ALWAYS right:

fetch('/api/v1/bookings')                                      // Frontend uses HTTP
export function validateBooking(slot, existing) { ... }        // Domain is pure TS
const { data } = useQuery({ queryKey: ['bookings'] })         // React Query for server state
return error(422, 'BOOKING_SLOT_UNAVAILABLE')                 // Semantic error codes
"booking_01JBXV7F41ANKJSDQQ69G69FP3"                          // Opaque ULIDs
```

---

## 📝 Your First Tasks

1. **Read** NEXTJS_DOCS_INDEX.md (this summary)
2. **Read** all 5 architecture documents
3. **Answer:** Do you have any architecture questions?
4. **Setup:** Clone repo → `pnpm install` → `pnpm run dev`
5. **Create:** First domain entity (e.g., Booking)
6. **Create:** First Zod contract (e.g., CreateBookingRequest)
7. **Create:** First API route (e.g., POST /api/v1/bookings)

---

## 🆘 Stuck?

| Problem                              | Solution                            |
| ------------------------------------ | ----------------------------------- |
| "Where do I put this code?"          | → NEXTJS_FOLDER_STRUCTURE.md        |
| "How do I structure this component?" | → NEXTJS_COMPONENT_ARCHITECTURE.md  |
| "How do I call the API?"             | → NEXTJS_API_CLIENT_ARCHITECTURE.md |
| "What's the overall design?"         | → NEXTJS_ARCHITECTURE_DESIGN.md     |
| "How do I set this up?"              | → NEXTJS_DEVELOPMENT_WORKFLOW.md    |

---

## 🎉 You're Ready!

All architecture decisions are made.  
All documentation is written.  
Now it's time to **build**.

**Next Step:** Open [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md) → **"Initial Setup"** section and follow the steps.

---

**Happy coding! 🚀**

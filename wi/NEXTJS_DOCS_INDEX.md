# Warmpawz NextJS Migration - Complete Documentation Suite

**Version:** 1.0.0  
**Status:** PHASE 0 - CONTRACT & RULE FREEZE  
**Created:** December 23, 2025

---

## 📚 Documentation Overview

This suite contains **5 comprehensive documents** defining the complete architecture for migrating Warmpawz from Vite monolith to **Next.js microservices with AWS Lambda backend**.

### Documents (Read in This Order)

| #     | Document                                                               | Focus          | Purpose                                                      |
| ----- | ---------------------------------------------------------------------- | -------------- | ------------------------------------------------------------ |
| **1** | [NEXTJS_ARCHITECTURE_DESIGN.md](NEXTJS_ARCHITECTURE_DESIGN.md)         | System Design  | High-level architecture, deployment models, API contracts    |
| **2** | [NEXTJS_FOLDER_STRUCTURE.md](NEXTJS_FOLDER_STRUCTURE.md)               | Project Layout | Detailed folder structure, monorepo setup, file organization |
| **3** | [NEXTJS_COMPONENT_ARCHITECTURE.md](NEXTJS_COMPONENT_ARCHITECTURE.md)   | UI Patterns    | Component classification, hooks, state management patterns   |
| **4** | [NEXTJS_API_CLIENT_ARCHITECTURE.md](NEXTJS_API_CLIENT_ARCHITECTURE.md) | Data Layer     | Zod contracts, API client, request/response patterns         |
| **5** | [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md)       | Operations     | Setup, commands, testing, deployment, troubleshooting        |

---

## 🎯 Quick Navigation

### By Role

**🏗️ Architects & Tech Leads**

- Start with [NEXTJS_ARCHITECTURE_DESIGN.md](NEXTJS_ARCHITECTURE_DESIGN.md)
- Then [NEXTJS_FOLDER_STRUCTURE.md](NEXTJS_FOLDER_STRUCTURE.md)
- Reference: API contracts section in [NEXTJS_API_CLIENT_ARCHITECTURE.md](NEXTJS_API_CLIENT_ARCHITECTURE.md)

**👨‍💻 Frontend Developers**

- Study [NEXTJS_COMPONENT_ARCHITECTURE.md](NEXTJS_COMPONENT_ARCHITECTURE.md)
- Learn [NEXTJS_API_CLIENT_ARCHITECTURE.md](NEXTJS_API_CLIENT_ARCHITECTURE.md)
- Setup [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md)

**⚙️ Backend Developers**

- Review [NEXTJS_ARCHITECTURE_DESIGN.md](NEXTJS_ARCHITECTURE_DESIGN.md) (API routes section)
- Study API contracts in [NEXTJS_API_CLIENT_ARCHITECTURE.md](NEXTJS_API_CLIENT_ARCHITECTURE.md)
- Implement domain layer (see Phase 1 in workflow)

**🧪 QA/Test Engineers**

- [NEXTJS_COMPONENT_ARCHITECTURE.md](NEXTJS_COMPONENT_ARCHITECTURE.md) (component testing)
- [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md) (testing section)

**🚀 DevOps/Infrastructure**

- [NEXTJS_ARCHITECTURE_DESIGN.md](NEXTJS_ARCHITECTURE_DESIGN.md) (deployment section)
- [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md) (deployment & monitoring)

---

## 🏃 Quick Start (5 Minutes)

### 1. Understand the Vision

From [NEXTJS_ARCHITECTURE_DESIGN.md](NEXTJS_ARCHITECTURE_DESIGN.md):

```
┌─────────────────────────────────────────────────────────┐
│                    CDN / CloudFront                      │
└────────┬─────────────┬─────────────┬────────────────────┘
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
    │  └── ... more services              │
    └────────────┬────────────────────────┘
```

### 2. Understand the Structure

From [NEXTJS_FOLDER_STRUCTURE.md](NEXTJS_FOLDER_STRUCTURE.md):

```
warmpawz/
├── apps/
│   ├── customer-web/        ← Next.js App Router
│   ├── vendor-web/          ← Next.js App Router
│   └── admin-web/           ← Next.js App Router
│
├── packages/
│   ├── api-contracts/       ← Zod schemas (FROZEN in Phase 0)
│   ├── domain/              ← Pure business logic (no framework deps)
│   ├── services/            ← Orchestration layer
│   └── shared-libs/         ← Utilities
│
└── infrastructure/
    ├── lambda/              ← Function source (Phase 5)
    └── cdk/                 ← AWS CDK (Phase 5)
```

### 3. Understand Component Pattern

From [NEXTJS_COMPONENT_ARCHITECTURE.md](NEXTJS_COMPONENT_ARCHITECTURE.md):

```typescript
// Presentational (dumb)
<BookingCard booking={booking} onCancel={handleCancel} />

// Container (smart) - fetches data
export function BookingHistory() {
  const { data } = useQuery({...});
  return <BookingCard {...} />;
}

// Page component
export default function BookingsPage() {
  return <BookingHistory />;
}
```

### 4. Understand API Client Pattern

From [NEXTJS_API_CLIENT_ARCHITECTURE.md](NEXTJS_API_CLIENT_ARCHITECTURE.md):

```typescript
// 1. Define contract
export const CreateBookingRequestSchema = z.object({...});

// 2. Create resource class
export const bookingApi = {
  async create(request: CreateBookingRequest) {
    const { data } = await apiClient.post(ENDPOINT, request);
    return data.data;
  }
};

// 3. Use in component
const { mutate } = useMutation({
  mutationFn: (data) => bookingApi.create(data)
});
```

### 5. Get Started

From [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md):

```bash
git clone https://github.com/ketan0103/warmpawzaws.git
cd warmpawzaws
pnpm install
pnpm run dev              # Starts all 3 apps
# Visit http://localhost:3001 (customer), 3002 (vendor), 3003 (admin)
```

---

## 📋 Key Decisions Made

### 1. **Separate Next.js Deployments** (Option A)

- Each persona has its own Next.js app
- Independent scaling and deployment
- Stricter isolation
- Clear separation of concerns

### 2. **Separate Cognito Pools** per Persona

- Customer pool: `customer-auth.warmpawz.com`
- Vendor pool: `vendor-auth.warmpawz.com`
- Admin pool: `admin-auth.warmpawz.com`
- Enables different auth rules per persona

### 3. **Strict Code Isolation** (Option A)

- Zero shared code between apps
- Each app has own components/hooks/stores
- Only shared packages are `domain`, `api-contracts`, `services`
- Prevents coupling

### 4. **Next.js API Routes = Thin BFF Only**

- Routes parse requests and validate
- Call service layer for business logic
- Format responses
- **Do NOT contain business logic**

### 5. **Phase 0 Focus (Contracts First)**

- Freeze all API contract shapes
- Define domain entities
- Document error codes
- **Frontend will be built against frozen contracts**

### 6. **State Management Stack**

- **React Query**: Server state (data from API)
- **Zustand**: Global UI state (drawers, tabs, filters)
- **Context**: Auth state (wrapper around Zustand)
- **useState**: Component local state

### 7. **Zod-Based Contracts**

- All request/response shapes validated with Zod
- TypeScript types auto-generated from Zod
- Single source of truth for contracts
- Used in both frontend validation and API routes

### 8. **Keep Supabase for Now**

- Phase 2: Use Supabase KV for data
- Phase 5: Swap to Aurora + DynamoDB (AWS)
- Changes only in repository layer
- Frontend and API contracts remain unchanged

### 9. **S3 for File Storage**

- Replace Supabase Storage with S3
- Signed URLs for access
- Separate bucket per environment (dev/staging/prod)

### 10. **Shared Domain Layer for Mobile**

- `packages/domain` used by both web apps and React Native
- Pure TypeScript, zero framework dependencies
- Mobile uses same business rules as web

---

## 🔒 Core Architectural Principles

### Principle 1: API-Contract-First

> Contracts are frozen in Phase 0. Frontend & backend both build against frozen contracts.

```typescript
// Define once, use everywhere
export const CreateBookingRequestSchema = z.object({...});
// Used in:
// - components/booking/BookingForm.tsx (form validation)
// - api/bookings/route.ts (request validation)
// - services/booking.service.ts (param validation)
// - tests (mocking)
```

### Principle 2: Framework-Free Domain Logic

> Domain layer has ZERO dependencies on Next.js, React, AWS SDK, or Supabase SDK.

```typescript
// ✅ domain/booking/rules.ts - Pure TypeScript
export function validateBookingTimeSlot(slot, existing, availability) {
  // No imports except domain files
  // No side effects
  // Returns Result<T, E>
}

// ❌ WRONG - Has framework dependency
import { NextRequest } from 'next/server';
export async function validateBooking(req: NextRequest) { ... }
```

### Principle 3: Thin Adapter Layer

> API routes are thin adapters: parse → validate → call service → format response.

```typescript
// app/api/bookings/route.ts - Thin adapter only
export async function POST(request: NextRequest) {
	const body = await request.json();
	const parseResult = CreateBookingRequestSchema.safeParse(body);
	if (!parseResult.success) return error(400, "INVALID_REQUEST");

	const result = await bookingService.createBooking(parseResult.data);
	if (result.isErr()) return error(422, result.error.code);

	return success(201, result.value);
}

// ❌ WRONG - Business logic in route handler
export async function POST(request: NextRequest) {
	const booking = { ...body };
	// Complex validation logic here
	// DB queries here
	// Calculations here
}
```

### Principle 4: Frontend Never Knows the Backend

> Frontend cannot determine if backend is Supabase, AWS, or even a mock.

```typescript
// Frontend only knows:
// - HTTP API contracts
// - Response envelopes
// - Error codes

// Frontend DOES NOT know:
// - Database schema
// - Whether backend is SQL or NoSQL
// - Whether backend is Supabase or AWS
// - Table names or relationships
```

### Principle 5: Semantic Error Responses

> API errors are semantic (business meaning), not technical (DB errors).

```typescript
// ✅ GOOD
{
  code: 'BOOKING_SLOT_UNAVAILABLE',
  message: 'Selected time slot is no longer available',
  details: { availableSlots: [...] }
}

// ❌ BAD
{
  error: 'Foreign key constraint violation on table bookings.vendor_id'
}
```

### Principle 6: Opaque IDs

> All IDs are unguessable ULIDs with type prefixes.

```typescript
// ✅ Format: {prefix}_{ulid}
user_01JBXV7F41ANKJSDQQ69G69FP3
booking_01JBXV7F41ANKJSDQQ69G69FP3
vendor_01JBXV7F41ANKJSDQQ69G69FP3

// ❌ WRONG
123, "booking_456", sequential IDs
```

---

## 🚦 Phase Timeline

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 0: Contract & Rule Freeze         (2 weeks)   [NOW]   │
│ • Define API contracts                                       │
│ • Freeze domain entities                                     │
│ • Document error codes                                       │
│ ✅ OUTPUT: contracts, domain types, Cursor rules             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Domain Extraction               (3 weeks)           │
│ • Extract business logic                                     │
│ • Framework-free domain layer                                │
│ • Repository interfaces                                      │
│ ✅ OUTPUT: Pure business logic, 0 framework deps             │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Frontend + Supabase Validation  (4 weeks)           │
│ • Build Next.js apps                                         │
│ • Supabase as backend                                        │
│ • Validate contracts                                         │
│ ✅ OUTPUT: 3 functional Next.js apps, Supabase integration   │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Frontend Migration              (3 weeks)           │
│ • Complete UI implementation                                 │
│ • Mobile apps (React Native)                                 │
│ • Performance optimization                                   │
│ ✅ OUTPUT: All UIs functional, mobile ready                  │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: AWS Foundation                  (2 weeks)           │
│ • Set up AWS infrastructure                                  │
│ • Configure Cognito pools                                    │
│ • Deploy empty Lambda functions                              │
│ ✅ OUTPUT: AWS infrastructure ready                          │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: Backend Swap                    (2 weeks)           │
│ • Replace Supabase repos → Aurora repos                      │
│ • Deploy Lambda functions                                    │
│ • Point frontend to AWS                                      │
│ ✅ OUTPUT: Full AWS microservices stack                      │
└─────────────────────────────────────────────────────────────┘
         ↓
┌─────────────────────────────────────────────────────────────┐
│ PHASE 6: Optimization                    (2 weeks)           │
│ • Performance tuning                                         │
│ • Caching strategies                                         │
│ • Monitoring & alerts                                        │
│ ✅ OUTPUT: Production-ready system                           │
└─────────────────────────────────────────────────────────────┘

Total Timeline: ~16 weeks (4 months)
```

---

## 🎯 Phase 0 Deliverables (Current)

By end of Phase 0, you will have:

### 1. API Contracts Frozen

```typescript
// packages/api-contracts/src/
├── auth/login.ts              ✅
├── auth/me.ts                 ✅
├── bookings/create.ts         ✅
├── bookings/list.ts           ✅
├── vendors/search.ts          ✅
├── services/search.ts         ✅
└── common/response.ts         ✅
```

### 2. Domain Layer Structure

```typescript
// packages/domain/src/
├── booking/
│   ├── types.ts              ✅
│   ├── rules.ts              ✅
│   ├── repository.ts         ✅
│   └── errors.ts             ✅
├── vendor/
├── customer/
├── payment/
└── shared/
```

### 3. Next.js Project Templates

- Customer Web: `apps/customer-web/`
- Vendor Web: `apps/vendor-web/`
- Admin Web: `apps/admin-web/`

### 4. Documentation (This Suite)

- ✅ Architecture Design
- ✅ Folder Structure
- ✅ Component Architecture
- ✅ API Client Architecture
- ✅ Development Workflow

### 5. Cursor Agent Rules

- ✅ Hard fail conditions
- ✅ Architecture enforcement
- ✅ Code review checklist

---

## 🔗 How Documents Connect

```
NEXTJS_ARCHITECTURE_DESIGN.md
├─ Deployment models
├─ Authentication flow
├─ API contracts (overview)
├─ Request flow (overview)
├─ State management (overview)
└─ Leads to → NEXTJS_FOLDER_STRUCTURE.md
    ├─ Project structure
    ├─ Folder organization
    ├─ Path aliases
    ├─ Package dependencies
    └─ Leads to → NEXTJS_COMPONENT_ARCHITECTURE.md
        ├─ Component patterns
        ├─ Custom hooks
        ├─ Data flow patterns
        └─ Leads to → NEXTJS_API_CLIENT_ARCHITECTURE.md
            ├─ Zod contracts (detailed)
            ├─ API client implementation
            ├─ React Query integration
            ├─ API routes (detailed examples)
            └─ Leads to → NEXTJS_DEVELOPMENT_WORKFLOW.md
                ├─ Setup instructions
                ├─ Development commands
                ├─ Testing strategies
                ├─ Debugging techniques
                ├─ Deployment options
                └─ Troubleshooting
```

---

## 📝 Next Steps

### Immediate (This Week)

1. **Read** all 5 documents in order
2. **Setup** monorepo with pnpm
3. **Create** Next.js apps from templates
4. **Define** all API contracts in Zod
5. **Write** domain layer types

### Short Term (Week 2-3)

1. **Implement** domain business logic
2. **Create** service layer skeleton
3. **Setup** API routes (thin adapters only)
4. **Configure** Cognito auth
5. **Write** API contract tests

### Medium Term (Week 4+)

1. **Build** React components
2. **Implement** React Query hooks
3. **Setup** Zustand stores
4. **Integrate** Supabase backend
5. **Write** E2E tests

---

## 🆘 Getting Help

### For Architecture Questions

→ Reference [NEXTJS_ARCHITECTURE_DESIGN.md](NEXTJS_ARCHITECTURE_DESIGN.md)

### For File Organization Questions

→ Reference [NEXTJS_FOLDER_STRUCTURE.md](NEXTJS_FOLDER_STRUCTURE.md)

### For Component Questions

→ Reference [NEXTJS_COMPONENT_ARCHITECTURE.md](NEXTJS_COMPONENT_ARCHITECTURE.md)

### For API/Contract Questions

→ Reference [NEXTJS_API_CLIENT_ARCHITECTURE.md](NEXTJS_API_CLIENT_ARCHITECTURE.md)

### For Setup/Workflow Questions

→ Reference [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md)

---

## ✅ Final Checklist

Before starting Phase 1:

- [ ] All team members read documentation
- [ ] API contracts defined in Zod
- [ ] Domain entity types created
- [ ] Next.js projects generated
- [ ] Monorepo configured with pnpm
- [ ] TypeScript paths configured
- [ ] Development environment working
- [ ] Git workflow documented
- [ ] CI/CD pipeline configured
- [ ] Code review checklist agreed upon

---

## 📞 Questions?

If you have clarifications needed:

1. **Check the relevant document** first (see Quick Navigation)
2. **Search within document** (Ctrl+F / Cmd+F)
3. **Check code examples** in the document
4. **Ask specific, detailed questions** with context

---

**🎉 Ready to start building!**

Follow [NEXTJS_DEVELOPMENT_WORKFLOW.md](NEXTJS_DEVELOPMENT_WORKFLOW.md) → "Getting Started" section to begin.

---

**END OF DOCUMENTATION SUITE**

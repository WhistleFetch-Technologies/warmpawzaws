# Warmpawz NextJS - Detailed Folder Structure

**Version:** 1.0.0  
**Status:** PHASE 0 Complete

---

## 📁 Complete Directory Tree

```
warmpawz/                                    # Monorepo root
│
├── 📱 apps/
│   │
│   ├── customer-web/                       # Customer app (Next.js App Router)
│   │   ├── src/
│   │   │   ├── app/                        # Next.js App Router
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   │   ├── page.tsx        # Login form
│   │   │   │   │   │   └── layout.tsx
│   │   │   │   │   ├── register/
│   │   │   │   │   │   ├── page.tsx        # Registration form
│   │   │   │   │   │   └── layout.tsx
│   │   │   │   │   └── layout.tsx          # Auth layout (no navbar)
│   │   │   │   │
│   │   │   │   ├── (protected)/
│   │   │   │   │   ├── dashboard/
│   │   │   │   │   │   ├── page.tsx        # Customer dashboard
│   │   │   │   │   │   ├── my-pets/
│   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   ├── [petId]/
│   │   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   │   └── edit/page.tsx
│   │   │   │   │   │   │   └── new/page.tsx
│   │   │   │   │   │   │
│   │   │   │   │   ├── bookings/
│   │   │   │   │   │   ├── page.tsx        # Bookings list
│   │   │   │   │   │   ├── [bookingId]/
│   │   │   │   │   │   │   ├── page.tsx    # Booking details
│   │   │   │   │   │   │   └── confirm/page.tsx
│   │   │   │   │   │   │
│   │   │   │   │   ├── services/
│   │   │   │   │   │   ├── page.tsx        # Service discovery
│   │   │   │   │   │   └── [serviceId]/
│   │   │   │   │   │       ├── page.tsx
│   │   │   │   │   │       └── vendors/[vendorId]/page.tsx
│   │   │   │   │   │
│   │   │   │   │   ├── vendors/
│   │   │   │   │   │   ├── page.tsx        # Vendor search
│   │   │   │   │   │   └── [vendorId]/
│   │   │   │   │   │       ├── page.tsx
│   │   │   │   │   │       ├── services/page.tsx
│   │   │   │   │   │       └── reviews/page.tsx
│   │   │   │   │   │
│   │   │   │   │   ├── profile/
│   │   │   │   │   │   ├── page.tsx        # Customer profile
│   │   │   │   │   │   ├── edit/page.tsx
│   │   │   │   │   │   └── settings/page.tsx
│   │   │   │   │   │
│   │   │   │   │   └── layout.tsx          # Protected layout (with navbar)
│   │   │   │   │
│   │   │   │   ├── api/                    # Next.js API routes
│   │   │   │   │   └── v1/
│   │   │   │   │       ├── auth/
│   │   │   │   │       │   ├── login/route.ts
│   │   │   │   │       │   ├── logout/route.ts
│   │   │   │   │       │   ├── refresh/route.ts
│   │   │   │   │       │   └── me/route.ts
│   │   │   │   │       │
│   │   │   │   │       ├── bookings/
│   │   │   │   │       │   ├── route.ts   # GET: list, POST: create
│   │   │   │   │       │   └── [id]/
│   │   │   │   │       │       ├── route.ts   # GET, PUT
│   │   │   │   │       │       ├── confirm/route.ts
│   │   │   │   │       │       └── cancel/route.ts
│   │   │   │   │       │
│   │   │   │   │       ├── services/
│   │   │   │   │       │   ├── route.ts   # GET: search
│   │   │   │   │       │   └── [id]/route.ts
│   │   │   │   │       │
│   │   │   │   │       ├── vendors/
│   │   │   │   │       │   ├── route.ts   # GET: search
│   │   │   │   │       │   └── [id]/
│   │   │   │   │       │       ├── route.ts
│   │   │   │   │       │       └── availability/route.ts
│   │   │   │   │       │
│   │   │   │   │       ├── pets/
│   │   │   │   │       │   ├── route.ts   # GET: list, POST: create
│   │   │   │   │       │   └── [id]/route.ts  # GET, PUT, DELETE
│   │   │   │   │       │
│   │   │   │   │       └── profile/
│   │   │   │   │           ├── route.ts
│   │   │   │   │           └── avatar/route.ts
│   │   │   │   │
│   │   │   │   ├── error.tsx              # Error boundary
│   │   │   │   ├── loading.tsx            # Global loading UI
│   │   │   │   ├── not-found.tsx          # 404 page
│   │   │   │   ├── layout.tsx             # Root layout
│   │   │   │   └── page.tsx               # Home/landing page
│   │   │   │
│   │   │   ├── components/                 # UI Components
│   │   │   │   ├── booking/
│   │   │   │   │   ├── BookingCard.tsx
│   │   │   │   │   ├── BookingForm.tsx
│   │   │   │   │   ├── BookingHistory.tsx
│   │   │   │   │   ├── BookingStatus.tsx
│   │   │   │   │   ├── BookingTimeline.tsx
│   │   │   │   │   └── index.ts            # Barrel export
│   │   │   │   │
│   │   │   │   ├── vendor/
│   │   │   │   │   ├── VendorCard.tsx
│   │   │   │   │   ├── VendorProfile.tsx
│   │   │   │   │   ├── VendorReviews.tsx
│   │   │   │   │   ├── VendorSearch.tsx
│   │   │   │   │   ├── VendorFilter.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── pet/
│   │   │   │   │   ├── PetCard.tsx
│   │   │   │   │   ├── PetForm.tsx
│   │   │   │   │   ├── PetProfile.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── service/
│   │   │   │   │   ├── ServiceCard.tsx
│   │   │   │   │   ├── ServiceList.tsx
│   │   │   │   │   ├── ServiceFilter.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── payment/
│   │   │   │   │   ├── PaymentForm.tsx
│   │   │   │   │   ├── PaymentStatus.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── auth/
│   │   │   │   │   ├── LoginForm.tsx
│   │   │   │   │   ├── RegisterForm.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   ├── common/
│   │   │   │   │   ├── Navbar.tsx
│   │   │   │   │   ├── Footer.tsx
│   │   │   │   │   ├── LoadingSpinner.tsx
│   │   │   │   │   ├── ErrorBoundary.tsx
│   │   │   │   │   ├── NotFound.tsx
│   │   │   │   │   └── index.ts
│   │   │   │   │
│   │   │   │   └── ui/                    # Radix UI + Tailwind
│   │   │   │       ├── button/
│   │   │   │       │   └── Button.tsx
│   │   │   │       ├── input/
│   │   │   │       │   └── Input.tsx
│   │   │   │       ├── dialog/
│   │   │   │       │   └── Dialog.tsx
│   │   │   │       ├── select/
│   │   │   │       │   └── Select.tsx
│   │   │   │       ├── card/
│   │   │   │       │   └── Card.tsx
│   │   │   │       ├── badge/
│   │   │   │       │   └── Badge.tsx
│   │   │   │       ├── tabs/
│   │   │   │       │   └── Tabs.tsx
│   │   │   │       └── index.ts
│   │   │   │
│   │   │   ├── lib/
│   │   │   │   ├── api-client.ts          # Axios instance + interceptors
│   │   │   │   ├── api-helpers.ts         # Response formatting utilities
│   │   │   │   ├── hooks.ts               # Common hooks (useAuth, etc.)
│   │   │   │   ├── utils.ts               # General utilities
│   │   │   │   ├── cn.ts                  # Tailwind classname utility
│   │   │   │   └── env.ts                 # Environment validation
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── useAuth.ts             # Auth context hook
│   │   │   │   ├── useBooking.ts          # Domain-specific hook
│   │   │   │   ├── useVendorSearch.ts
│   │   │   │   ├── usePetProfile.ts
│   │   │   │   └── usePayment.ts
│   │   │   │
│   │   │   ├── stores/
│   │   │   │   ├── uiStore.ts             # Zustand: UI state
│   │   │   │   ├── filterStore.ts         # Zustand: Search filters
│   │   │   │   └── cartStore.ts           # Zustand: Booking cart
│   │   │   │
│   │   │   ├── context/
│   │   │   │   ├── AuthContext.tsx        # Auth provider
│   │   │   │   └── QueryProvider.tsx      # React Query provider
│   │   │   │
│   │   │   └── middleware.ts              # Next.js middleware (auth)
│   │   │
│   │   ├── public/                        # Static files
│   │   │   ├── logo.svg
│   │   │   ├── favicon.ico
│   │   │   └── images/
│   │   │
│   │   ├── .env.local                    # Local environment variables
│   │   ├── .env.example                  # Environment template
│   │   ├── next.config.js                # Next.js configuration
│   │   ├── tsconfig.json                 # TypeScript config
│   │   ├── tailwind.config.js            # Tailwind CSS config
│   │   ├── postcss.config.js             # PostCSS config
│   │   └── package.json
│   │
│   ├── vendor-web/                        # Vendor app (similar structure)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── (protected)/
│   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   ├── onboarding/page.tsx
│   │   │   │   │   ├── services/page.tsx
│   │   │   │   │   ├── staff/page.tsx
│   │   │   │   │   ├── bookings/page.tsx
│   │   │   │   │   ├── analytics/page.tsx
│   │   │   │   │   ├── payouts/page.tsx
│   │   │   │   │   ├── settings/page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── api/v1/
│   │   │   │   │   ├── auth/...
│   │   │   │   │   ├── vendor/...
│   │   │   │   │   ├── services/...
│   │   │   │   │   ├── staff/...
│   │   │   │   │   ├── bookings/...
│   │   │   │   │   └── analytics/...
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── onboarding/
│   │   │   │   ├── services/
│   │   │   │   ├── staff/
│   │   │   │   ├── analytics/
│   │   │   │   ├── common/
│   │   │   │   └── ui/
│   │   │   ├── lib/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── context/
│   │   │   └── middleware.ts
│   │   └── ... (config files)
│   │
│   ├── admin-web/                         # Admin portal (similar structure)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── (protected)/
│   │   │   │   │   ├── dashboard/page.tsx
│   │   │   │   │   ├── vendors/page.tsx
│   │   │   │   │   ├── customers/page.tsx
│   │   │   │   │   ├── bookings/page.tsx
│   │   │   │   │   ├── payments/page.tsx
│   │   │   │   │   ├── disputes/page.tsx
│   │   │   │   │   ├── configuration/page.tsx
│   │   │   │   │   ├── users/page.tsx
│   │   │   │   │   └── layout.tsx
│   │   │   │   ├── api/v1/
│   │   │   │   │   ├── auth/...
│   │   │   │   │   ├── admin/...
│   │   │   │   │   ├── vendors/...
│   │   │   │   │   ├── users/...
│   │   │   │   │   └── configuration/...
│   │   │   │   └── layout.tsx
│   │   │   ├── components/
│   │   │   │   ├── vendors/
│   │   │   │   ├── users/
│   │   │   │   ├── analytics/
│   │   │   │   ├── moderation/
│   │   │   │   ├── common/
│   │   │   │   └── ui/
│   │   │   ├── lib/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   ├── context/
│   │   │   └── middleware.ts
│   │   └── ... (config files)
│   │
│   └── mobile/                            # React Native/Expo (future)
│       ├── src/
│       ├── app.json
│       └── ... (Expo config)
│
├── 📦 packages/
│   │
│   ├── api-contracts/                     # Zod schemas + TypeScript types
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   │   ├── login.ts              # Request/response types
│   │   │   │   ├── logout.ts
│   │   │   │   ├── refresh.ts
│   │   │   │   ├── me.ts
│   │   │   │   └── index.ts              # Barrel export
│   │   │   │
│   │   │   ├── bookings/
│   │   │   │   ├── create.ts
│   │   │   │   ├── list.ts
│   │   │   │   ├── get.ts
│   │   │   │   ├── update.ts
│   │   │   │   ├── cancel.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── vendors/
│   │   │   │   ├── search.ts
│   │   │   │   ├── get.ts
│   │   │   │   ├── availability.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── services/
│   │   │   │   ├── search.ts
│   │   │   │   ├── get.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── pets/
│   │   │   │   ├── create.ts
│   │   │   │   ├── list.ts
│   │   │   │   ├── update.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── common/
│   │   │   │   ├── response.ts           # Common response types
│   │   │   │   ├── error.ts              # Error types
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts                  # Main barrel export
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── domain/                            # Pure business logic (NO FRAMEWORK DEPS)
│   │   ├── src/
│   │   │   ├── booking/
│   │   │   │   ├── types.ts              # Booking entity
│   │   │   │   ├── repository.ts         # Interface only
│   │   │   │   ├── rules.ts              # Pure business logic
│   │   │   │   ├── state-machine.ts      # Lifecycle management
│   │   │   │   ├── errors.ts             # Domain errors
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── vendor/
│   │   │   │   ├── types.ts
│   │   │   │   ├── repository.ts
│   │   │   │   ├── rules.ts
│   │   │   │   ├── capabilities.ts       # Role-based features
│   │   │   │   ├── errors.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── customer/
│   │   │   │   ├── types.ts
│   │   │   │   ├── repository.ts
│   │   │   │   ├── rules.ts
│   │   │   │   ├── errors.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── payment/
│   │   │   │   ├── types.ts
│   │   │   │   ├── repository.ts
│   │   │   │   ├── rules.ts              # Payment validation
│   │   │   │   ├── errors.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── service/
│   │   │   │   ├── types.ts
│   │   │   │   ├── repository.ts
│   │   │   │   ├── rules.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── shared/
│   │   │   │   ├── result.ts             # Result<T, E> type
│   │   │   │   ├── errors.ts             # Common errors
│   │   │   │   ├── types.ts              # Common entities
│   │   │   │   ├── value-objects.ts      # Money, PhoneNumber, etc.
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── services/                          # Application layer (orchestration)
│   │   ├── src/
│   │   │   ├── booking/
│   │   │   │   ├── booking.service.ts    # Orchestrates domain + repo
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── vendor/
│   │   │   │   ├── vendor.service.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── payment/
│   │   │   │   ├── payment.service.ts
│   │   │   │   ├── razorpay.adapter.ts   # Provider-specific adapter
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── notification/
│   │   │   │   ├── notification.service.ts
│   │   │   │   ├── sms.adapter.ts
│   │   │   │   ├── email.adapter.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── shared-libs/                       # Common utilities & helpers
│   │   ├── src/
│   │   │   ├── utils/
│   │   │   │   ├── date.ts
│   │   │   │   ├── string.ts
│   │   │   │   ├── money.ts
│   │   │   │   ├── phone.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── constants/
│   │   │   │   ├── errors.ts
│   │   │   │   ├── status.ts
│   │   │   │   ├── roles.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   ├── validators/
│   │   │   │   ├── email.ts
│   │   │   │   ├── phone.ts
│   │   │   │   ├── url.ts
│   │   │   │   └── index.ts
│   │   │   │
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── types/                             # Global TypeScript definitions
│   │   ├── src/
│   │   │   ├── global.d.ts
│   │   │   ├── env.d.ts                  # Environment variables
│   │   │   └── index.ts
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── api-client/                        # (Optional) Isomorphic HTTP client
│       ├── src/
│       │   ├── client.ts                  # Axios wrapper
│       │   ├── interceptors.ts
│       │   ├── auth.ts
│       │   └── index.ts
│       │
│       ├── tsconfig.json
│       └── package.json
│
├── 🔧 infrastructure/
│   │
│   ├── lambda/                            # Lambda function source
│   │   ├── functions/
│   │   │   ├── booking/
│   │   │   │   ├── create.ts
│   │   │   │   ├── confirm.ts
│   │   │   │   └── cancel.ts
│   │   │   │
│   │   │   ├── vendor/
│   │   │   │   ├── onboard.ts
│   │   │   │   └── search.ts
│   │   │   │
│   │   │   ├── payment/
│   │   │   │   ├── process.ts
│   │   │   │   └── refund.ts
│   │   │   │
│   │   │   └── ...
│   │   │
│   │   ├── lib/
│   │   │   ├── database.ts               # DB connections
│   │   │   ├── auth.ts
│   │   │   └── ...
│   │   │
│   │   ├── handlers/
│   │   │   ├── http-handler.ts           # HTTP wrapper
│   │   │   ├── error-handler.ts
│   │   │   └── ...
│   │   │
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   ├── cdk/                              # AWS CDK Infrastructure
│   │   ├── lib/
│   │   │   ├── stacks/
│   │   │   │   ├── api-stack.ts
│   │   │   │   ├── database-stack.ts
│   │   │   │   ├── auth-stack.ts
│   │   │   │   └── storage-stack.ts
│   │   │   │
│   │   │   └── constructs/
│   │   │       ├── lambda-function.ts
│   │   │       ├── rds-database.ts
│   │   │       └── ...
│   │   │
│   │   ├── bin/
│   │   │   └── app.ts
│   │   │
│   │   ├── cdk.json
│   │   ├── tsconfig.json
│   │   └── package.json
│   │
│   └── terraform/                        # Alternative: Terraform
│       ├── modules/
│       │   ├── api-gateway/
│       │   ├── lambda/
│       │   ├── rds/
│       │   ├── cognito/
│       │   └── ...
│       │
│       ├── environments/
│       │   ├── dev.tfvars
│       │   ├── staging.tfvars
│       │   └── prod.tfvars
│       │
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       └── ...
│
├── 📚 docs/
│   ├── ARCHITECTURE.md                   # Main architecture doc
│   ├── FOLDER_STRUCTURE.md              # This file
│   ├── COMPONENT_ARCHITECTURE.md        # UI patterns & organization
│   ├── API_CLIENT_ARCHITECTURE.md       # HTTP client design
│   ├── API_CONTRACTS.md                 # OpenAPI specs
│   ├── DEVELOPMENT_WORKFLOW.md          # Commands & workflow
│   ├── DATABASE_SCHEMA.md               # DB design (Phase 5)
│   ├── DEPLOYMENT_GUIDE.md              # Deploy to AWS
│   ├── MIGRATION_CHECKLIST.md           # Phase-by-phase checklist
│   └── TESTING_STRATEGY.md              # Testing approach
│
├── 📋 Root Configuration Files
│   ├── package.json                      # Monorepo dependencies
│   ├── pnpm-workspace.yaml               # pnpm workspaces
│   ├── tsconfig.base.json                # Shared TypeScript config
│   ├── .eslintrc.json                    # Shared ESLint rules
│   ├── .prettierrc.json                  # Shared formatter config
│   ├── turbo.json                        # Turborepo build pipeline
│   ├── .gitignore
│   ├── .env.example                      # Template env vars
│   ├── .github/
│   │   ├── workflows/
│   │   │   ├── test.yml                  # CI: Run tests
│   │   │   ├── lint.yml                  # CI: Lint code
│   │   │   ├── build.yml                 # CI: Build apps
│   │   │   └── deploy.yml                # CI: Deploy to AWS
│   │   └── CONTRIBUTING.md
│   │
│   ├── README.md                         # Project overview
│   ├── CHANGELOG.md
│   └── LICENSE

```

---

## 📁 Path Aliases Configuration

Add these path aliases to `tsconfig.base.json`:

```json
{
	"compilerOptions": {
		"paths": {
			"@/*": ["./apps/*/src/*"],
			"@/components/*": ["./apps/*/src/components/*"],
			"@/lib/*": ["./apps/*/src/lib/*"],
			"@/hooks/*": ["./apps/*/src/hooks/*"],
			"@/stores/*": ["./apps/*/src/stores/*"],
			"@/app/*": ["./apps/*/src/app/*"],

			"@warmpawz/domain": ["./packages/domain/src"],
			"@warmpawz/api-contracts": ["./packages/api-contracts/src"],
			"@warmpawz/services": ["./packages/services/src"],
			"@warmpawz/shared-libs": ["./packages/shared-libs/src"],
			"@warmpawz/types": ["./packages/types/src"]
		}
	}
}
```

---

## 📦 Package Dependencies Structure

```
apps/customer-web/
├── depends on → @warmpawz/api-contracts
├── depends on → @warmpawz/domain
├── depends on → @warmpawz/services
├── depends on → @warmpawz/shared-libs
└── depends on → @warmpawz/types

apps/vendor-web/
├── depends on → @warmpawz/api-contracts
├── depends on → @warmpawz/domain
├── depends on → @warmpawz/services
├── depends on → @warmpawz/shared-libs
└── depends on → @warmpawz/types

apps/admin-web/
├── depends on → @warmpawz/api-contracts
├── depends on → @warmpawz/domain
├── depends on → @warmpawz/services
├── depends on → @warmpawz/shared-libs
└── depends on → @warmpawz/types

apps/mobile/
├── depends on → @warmpawz/api-contracts
├── depends on → @warmpawz/domain
├── depends on → @warmpawz/shared-libs
└── depends on → @warmpawz/types

packages/services/
├── depends on → @warmpawz/domain
├── depends on → @warmpawz/api-contracts
└── depends on → @warmpawz/shared-libs

packages/api-contracts/
├── depends on → @warmpawz/types
└── depends on → @warmpawz/shared-libs

packages/domain/
└── depends on → @warmpawz/shared-libs
```

---

## 🔒 Strict Isolation Rules

### ✅ Allowed Imports

```typescript
// In apps/customer-web/
import { createBooking } from "@warmpawz/domain";
import { BookingService } from "@warmpawz/services";
import { CreateBookingSchema } from "@warmpawz/api-contracts";
```

### ❌ Forbidden Imports

```typescript
// ❌ Frontend importing backend infrastructure
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// ❌ Domain importing framework
import { NextRequest } from "next/server";
import { useQuery } from "@tanstack/react-query";

// ❌ Cross-app imports
import { LoginForm } from "@/../vendor-web/src/components";
```

---

## 📂 Key File Categories

### Domain Files (packages/domain/)

- **Never have framework imports**
- **Pure TypeScript only**
- **No side effects**
- **Must be testable without mocks**

### Service Files (packages/services/)

- **Orchestrate domain + repositories**
- **Can use async/await**
- **Can depend on domain & contracts**
- **Cannot import React**

### API Route Files (apps/\*/src/app/api/)

- **Thin adapters only**
- **Parse requests + validate**
- **Call services**
- **Format responses**
- **Cannot contain business logic**

### Component Files (apps/\*/src/components/)

- **React/JSX only**
- **Call API routes**
- **No database imports**
- **Consume API responses only**

### Hook Files (apps/\*/src/hooks/)

- **React hooks only**
- **Can use React Query**
- **Can use Zustand**
- **Can call API routes**
- **No business logic**

---

## 🚀 File Naming Conventions

### Components

```typescript
// React components: PascalCase.tsx
BookingCard.tsx;
VendorProfile.tsx;
LoginForm.tsx;

// Exports in index.ts
export { BookingCard } from "./BookingCard";
export { VendorProfile } from "./VendorProfile";
```

### Services & Domain

```typescript
// Service files: camelCase.service.ts
booking.service.ts;
vendor.service.ts;
payment.service.ts;

// Domain files: camelCase.ts
rules.ts;
repository.ts;
types.ts;
errors.ts;
```

### API Routes

```typescript
// Next.js routes: route.ts (lowercase)
app / api / v1 / bookings / route.ts;
app / api / v1 / vendors / [id] / route.ts;
```

### Hooks

```typescript
// Custom hooks: useXxx.ts
useAuth.ts;
useBooking.ts;
useVendorSearch.ts;
```

### Stores (Zustand)

```typescript
// Store files: xxxStore.ts
uiStore.ts;
filterStore.ts;
cartStore.ts;
```

---

## 📊 Dependency Graph (High Level)

```
┌─────────────────────────────────────────┐
│   Frontend Apps (Next.js)               │
│   ├── customer-web                      │
│   ├── vendor-web                        │
│   ├── admin-web                         │
│   └── mobile (React Native)             │
└────────┬────────────────────────────────┘
         │
         │ depends on
         │
┌────────▼────────────────────────────────┐
│   Shared Packages                       │
│   ├── @warmpawz/api-contracts (Zod)    │
│   ├── @warmpawz/domain (Pure TS)       │
│   ├── @warmpawz/services (Layer)       │
│   ├── @warmpawz/shared-libs (Utils)    │
│   └── @warmpawz/types (TypeScript)     │
└────────┬────────────────────────────────┘
         │
         │ calls via HTTP
         │
┌────────▼────────────────────────────────┐
│   AWS Infrastructure (Phase 5)          │
│   ├── API Gateway                       │
│   ├── Lambda Functions                  │
│   ├── Aurora (RDS)                      │
│   └── DynamoDB                          │
└─────────────────────────────────────────┘
```

---

**END OF FOLDER STRUCTURE DOCUMENT**

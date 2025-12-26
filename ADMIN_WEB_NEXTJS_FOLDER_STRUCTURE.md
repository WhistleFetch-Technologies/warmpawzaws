# Warmpawz Admin Web (Next.js) Folder Structure

This file presents the recommended folder structure for the new modular Next.js admin web application, mapped from the current application. It is designed for a pnpm monorepo, using Next.js 14+ (App Router), TypeScript, Zod, Radix UI, Tailwind, TanStack Query, Zustand, ESLint, Prettier, and Husky.

```plaintext
apps/
  admin-web/                # Next.js admin app root
    app/                    # Next.js app directory (App Router)
      (admin routes)
        dashboard/
        analytics/
        users/
        vendors/
        staff/
        catalog/
        finance/
        settings/
        integrations/
        notifications/
        reports/
        support/
        ...
      layout.tsx
      page.tsx
      globals.css
    components/             # Shared React components
      admin/
      analytics/
      catalog/
      common/
      content/
      ecommerce/
      finance/
      integrations/
      layout/
      marketing/
      notifications/
      pets/
      pricing/
      rbac/
      reports/
      settings/
      staff/
      support/
      transactions/
      vendor/
      ...
    hooks/                  # React hooks
    lib/                    # Utilities, API clients, Zod schemas, helpers
    store/                  # Zustand stores (state management)
    styles/                 # Tailwind and custom CSS
    public/                 # Static assets
    tests/                  # Unit and integration tests
    types/                  # TypeScript types and interfaces
    .env.local              # Environment variables
    next.config.js          # Next.js config
    tsconfig.json           # TypeScript config
    package.json            # App-specific dependencies

packages/                   # Shared packages (UI, utils, API, etc.)
  ui/
  api/
  zod-contracts/
  utils/
  ...

node_modules/

pnpm-workspace.yaml
package.json
README.md
```

- All business logic, API clients, and Zod contracts should be placed in `lib/` or shared packages.
- Each route in `app/` should map to a major admin feature (dashboard, analytics, users, etc.).
- Shared UI and logic should be extracted to `packages/` for monorepo reuse.
- Use `components/` for feature- and domain-specific React components.
- State management (Zustand) goes in `store/`.
- All styling is handled in `styles/` (Tailwind, custom CSS).
- Tests are colocated in `tests/`.
- Types and interfaces are in `types/`.

This structure is designed for scalability, modularity, and clean separation of concerns, following modern Next.js and monorepo best practices.

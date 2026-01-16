# Deployment Lessons Learned

This document captures all the issues encountered during CI/CD pipeline deployment and build processes. Understanding these patterns will help prevent similar issues in future development.

---

## Table of Contents

1. [CI/CD Workflow Configuration](#1-cicd-workflow-configuration)
2. [Package Management & Lock Files](#2-package-management--lock-files)
3. [TypeScript Type Safety](#3-typescript-type-safety)
4. [Next.js Static Export Requirements](#4-nextjs-static-export-requirements)
5. [React Native Syntax Patterns](#5-react-native-syntax-patterns)
6. [Third-Party SDK Usage](#6-third-party-sdk-usage)
7. [Monorepo Package Exports](#7-monorepo-package-exports)

---

## 1. CI/CD Workflow Configuration

### Issue: Workflow Not Triggering on Push

**What Happened:**  
The GitHub Actions workflow was configured only for `workflow_dispatch` (manual trigger), not for automatic triggers on push to the develop branch.

**Root Cause:**  
Missing `push` trigger in the workflow YAML file.

**Prevention:**  
- Always verify workflow triggers when setting up CI/CD
- Include both `push` and `workflow_dispatch` triggers for flexibility
- Test workflow triggers immediately after configuration

### Issue: Builds Canceled Mid-Execution

**What Happened:**  
Successful builds were being canceled with "The operation was canceled" error.

**Root Cause:**  
The workflow had `concurrency: cancel-in-progress: true`, which cancels running jobs when a new commit is pushed.

**Prevention:**  
- Be cautious with `cancel-in-progress` in long-running build jobs
- Consider removing it for deployment workflows where partial builds are expensive
- Use it only for fast jobs like linting where restarting is cheap

---

## 2. Package Management & Lock Files

### Issue: npm ci Fails with "package.json and package-lock.json out of sync"

**What Happened:**  
`npm ci` failed repeatedly with errors about missing @radix-ui/* packages from the lock file.

**Root Cause:**  
The `package.json` file had non-standard 6-space indentation instead of standard 2-space. This caused npm to generate a malformed `package-lock.json` that didn't properly record all dependencies.

**Prevention:**  
- Always use standard 2-space indentation in JSON files
- Configure EditorConfig or Prettier to enforce consistent formatting
- Add a pre-commit hook to validate JSON formatting
- Run `npm ci --dry-run` locally before pushing to verify lock file integrity

### Issue: Multiple package-lock.json Files in Monorepo

**What Happened:**  
Stale or conflicting `package-lock.json` files existed in subdirectories (apps/admin-web, apps/customer-web, etc.), causing inconsistent dependency resolution.

**Root Cause:**  
Developers ran `npm install` in subdirectories instead of at the monorepo root.

**Prevention:**  
- Establish clear documentation that `npm install` should only run at root
- Consider using npm workspaces or a monorepo tool (Turborepo, Nx)
- Add `.npmrc` with consistent settings across all packages
- Add a guardrail job in CI to validate lock file sync

---

## 3. TypeScript Type Safety

### Issue: Unexported Interface Definitions

**What Happened:**  
TypeScript build failed with "Module declares 'InterfaceName' locally, but it is not exported."

**Root Cause:**  
Interfaces were defined in hook files but not exported. When the index.ts tried to re-export them, TypeScript couldn't find the exports.

**Prevention:**  
- Always export interfaces that are part of the public API
- Use explicit `export interface` instead of just `interface`
- Enable TypeScript strict mode to catch these issues earlier
- Review barrel file (index.ts) exports match actual exports

### Issue: Implicit `any` Types on API Responses

**What Happened:**  
TypeScript build failed with "Variable 'response' implicitly has type 'any'" or "Argument of type 'unknown' is not assignable to..."

**Root Cause:**  
API client methods returned `unknown` or untyped responses, and the code didn't handle the type narrowing.

**Prevention:**  
- Define explicit response types for all API endpoints
- Type API client methods with proper return types
- Use `as Type` assertions only when necessary, with explicit `any` annotation if the type is truly dynamic
- Consider using a typed API client generator (OpenAPI, tRPC)

### Issue: Missing Null/Undefined Checks

**What Happened:**  
TypeScript build failed with "'property' is possibly 'undefined'."

**Root Cause:**  
Optional properties were used in comparisons without null checks.

**Prevention:**  
- Always check for null/undefined before accessing optional properties
- Use optional chaining (`?.`) and nullish coalescing (`??`)
- Enable `strictNullChecks` in tsconfig.json

---

## 4. Next.js Static Export Requirements

### Issue: Missing `generateStaticParams()` for Dynamic Routes

**What Happened:**  
Build failed with "Page is missing 'generateStaticParams()' so it cannot be used with 'output: export' config."

**Root Cause:**  
Dynamic routes (e.g., `/orders/[id]/tracking`) require `generateStaticParams()` when using static export to know which paths to pre-render.

**Prevention:**  
- When using `output: 'export'`, all dynamic routes must have `generateStaticParams()`
- For client-side-only routes, return a placeholder array and enable `dynamicParams = true`
- Document this requirement in project README

### Issue: useSearchParams() Without Suspense Boundary

**What Happened:**  
Build failed with "useSearchParams() should be wrapped in a suspense boundary."

**Root Cause:**  
Next.js 14 requires hooks like `useSearchParams()` to be wrapped in Suspense during static generation.

**Prevention:**  
- Always wrap components using `useSearchParams()` in `<Suspense>`
- Create a client component for the interactive parts
- Keep the page.tsx as a server component with Suspense boundary

### Issue: Mixing 'use client' with generateStaticParams()

**What Happened:**  
Build failed with "Page cannot use both 'use client' and export function 'generateStaticParams()'."

**Root Cause:**  
A page component tried to be both a client component (for interactivity) and export a server-only function.

**Prevention:**  
- Split the page into two files:
  - `page.tsx` (server component) - contains `generateStaticParams()` and Suspense
  - `PageContent.tsx` (client component) - contains the interactive logic with 'use client'

---

## 5. React Native Syntax Patterns

### Issue: Dot Notation for Numeric Object Keys

**What Happened:**  
Metro bundler failed with "Unexpected token" when parsing style definitions.

**Root Cause:**  
JavaScript doesn't allow dot notation for numeric keys. `colors.gray.200` is invalid syntax.

**Prevention:**  
- Use bracket notation for numeric keys: `colors.gray['200']`
- Consider restructuring color objects to use string keys: `gray200` instead of `200`
- Add ESLint rules to catch this pattern
- Establish coding standards for color access patterns

### Issue: Extra Curly Braces in Return Statements

**What Happened:**  
Metro bundler failed with "Unexpected token" on return statements.

**Root Cause:**  
Code like `return {colors.success};` was written instead of `return colors.success;`. The extra braces create an incomplete object literal.

**Prevention:**  
- Understand the difference between returning a value vs. returning an object
- Use ESLint/TypeScript to catch syntax errors before commit
- Code review for JSX and JavaScript expression patterns
- Run Metro bundler locally before pushing React Native changes

### Issue: Extra Curly Braces in JSX Expressions

**What Happened:**  
Metro bundler failed on JSX like `color={{colors.white}}`.

**Root Cause:**  
Double braces `{{}}` create an object literal inside JSX expression. The correct syntax is single braces with the value: `color={colors.white}`.

**Prevention:**  
- Remember: `{}` in JSX is for JavaScript expressions, not for "emphasis"
- `{{}}` is only valid when passing an inline object: `style={{ color: 'red' }}`
- Review JSX prop syntax during code reviews

### Issue: Missing Closing Braces in Control Flow

**What Happened:**  
Build failed with "Unexpected token" at a `catch` statement.

**Root Cause:**  
An `if` block inside a `try` block was missing its closing brace, causing the catch to appear at the wrong nesting level.

**Prevention:**  
- Use consistent code formatting (Prettier)
- Enable ESLint rules for brace style
- Review indentation carefully during code reviews
- Use an IDE with bracket matching highlighting

---

## 6. Third-Party SDK Usage

### Issue: Incorrect AWS Chime SDK Method Signatures

**What Happened:**  
TypeScript build failed with "Expected 0 arguments, but got 1" for audio mute methods.

**Root Cause:**  
`realtimeMuteLocalAudio()` and `realtimeUnmuteLocalAudio()` take no arguments. Code was incorrectly passing a boolean.

**Prevention:**  
- Always consult SDK documentation for method signatures
- Use TypeScript to catch argument count mismatches
- Don't assume method behavior based on naming alone
- Write wrapper functions that encapsulate SDK interactions

### Issue: Non-Existent SDK Methods

**What Happened:**  
TypeScript build failed with "Property 'observeVideoTiles' does not exist on type 'AudioVideoFacade'."

**Root Cause:**  
Code was using a method name that doesn't exist in the Chime SDK. The correct pattern is `addObserver()` with a callback object.

**Prevention:**  
- Verify API methods exist before using them
- Use TypeScript's autocomplete to discover available methods
- Keep SDK dependencies up to date
- Read migration guides when updating SDK versions

---

## 7. Monorepo Package Exports

### Issue: Module Not Found for Subpath Imports

**What Happened:**  
Build failed with "Can't resolve '@warmpawz/ui/button'" and similar errors.

**Root Cause:**  
The UI package's `package.json` was missing explicit subpath exports. Modern Node.js and bundlers require exports to be declared for subpath imports to work.

**Prevention:**  
- Define explicit `exports` field in package.json for all public entry points
- Test imports from consuming packages before merging
- Document which imports are supported
- Example:
  ```json
  "exports": {
    ".": { "types": "./src/index.ts", "default": "./src/index.ts" },
    "./button": { "types": "./src/button.tsx", "default": "./src/button.tsx" }
  }
  ```

---

## General Prevention Strategies

1. **Run builds locally before pushing** - Always run `npm run build` for all apps locally
2. **Enable strict TypeScript** - Use `strict: true` in tsconfig.json
3. **Use pre-commit hooks** - Husky + lint-staged to catch issues early
4. **Implement CI guardrails** - Add validation jobs for lock files, formatting, types
5. **Code review checklist** - Include checks for common patterns above
6. **Document project standards** - Maintain a CONTRIBUTING.md with coding standards
7. **Test on CI early** - Push to a feature branch first to validate CI passes

---

## Quick Reference: Common Error Patterns

| Error Message | Likely Cause | Quick Fix |
|--------------|--------------|-----------|
| `npm ci` out of sync | Malformed package-lock.json | Delete lock file, run `npm install` |
| `Module not found` | Missing exports in package.json | Add subpath exports |
| `'X' is possibly undefined` | Missing null check | Add `!= null` check |
| `Unexpected token` (RN) | Dot notation for numbers or extra braces | Use bracket notation, remove braces |
| `useSearchParams` suspense | Missing Suspense boundary | Wrap in `<Suspense>` |
| `generateStaticParams` missing | Dynamic route without static params | Add the function with placeholder |
| `Expected 0 arguments` | Wrong SDK method usage | Check SDK documentation |

---

*Last Updated: January 2026*

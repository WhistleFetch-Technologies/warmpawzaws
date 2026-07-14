# Image Pipeline & Performance Optimization — Agent Handoff

**Last updated:** 2026-07-14  
**Prod state:** Phase 3.1 merged (PR #457), Lambda deployed, WebP backfill pilot complete (`image_migration_log` ≈ 292 rows).  
**Region:** `ap-south-1`  
**Uploads bucket:** `warmpawz-prod-user-uploads-057442119249`

---

## 1. Executive answer: do ALL uploads use the pipeline?

**No — not yet.** All **primary customer/vendor photo flows** that were smoke-tested in prod use `uploadDisplayImage` (Lean Asset Pipeline). Several **secondary / legacy paths** still bypass WebP conversion.

| Category | Uses ImageService? | Notes |
|----------|-------------------|--------|
| Customer profile / pet photo | ✅ | `POST /storage/upload-media` |
| Vendor product image (multipart) | ✅ | `POST /vendor/:vendorId/products/images` |
| Vendor profile photo + logo | ✅ | `vendorProfile.vendor.ts` |
| Staff profile photo | ✅ | `POST /staff/:id/profile/photo` |
| Vendor facility gallery (main path) | ✅ | `POST /vendor/facility/:vendorId/photos` (multipart/JSON) |
| Admin banner image | ✅ | `admin-governance-enhanced` multipart |
| Presigned `image/*` PUT | ❌ blocked | Returns 400 — by design |
| Bulk XLSX product images | ⏭️ passthrough | `skipImageIngest: true` — URLs stored as-is |
| External URL product ingest | ✅ optional | `product-image-ingest.ts` when `skipImageIngest` false |
| KYC / onboarding docs | ⏭️ intentional | Raw `PutObject` on `/storage/upload`, `/storage/upload-multiple` |
| Resort dashboard photos | ❌ broken | Client still calls presigned — **will 400** |
| Customer staff photo helper | ❌ broken | `uploadStaffPhotoWithProgress` uses presigned |
| Dead code: `vendor-products.ts` (root) | ❌ | Raw `PutObject` — **not registered** in handler |
| `uploadFacilityCenterPhotoWithProgress` | ❌ dead path | Presigned helper — **not imported** anywhere; gallery uses multipart |

**Storage rule (target):** RDS stores **display keys only** (bare S3 paths, never presigned URLs). Thumbs are **derived** (`*.thumb.webp`), not stored in RDS.

---

## 2. Architecture reference

### 2.1 Unified media policy (three layers)

```
UPLOAD  → uploadDisplayImage() → Sharp WebP + byte budgets → versioned S3 keys
STORAGE → RDS: display key only; dedup via image_content_index (product/facility/banner)
RENDER  → list: thumbUrl; detail: full url; presign today, CDN when MEDIA_CDN_DOMAIN set
```

### 2.2 Core modules (`backend/lambda/src/services/image/`)

| File | Role |
|------|------|
| `image-service.ts` | `uploadDisplayImage`, `toUploadJsonResponse` |
| `image-processor.ts` | Sharp WebP encode, quality 85→35 step 8 |
| `image-key-builder.ts` | Versioned keys: `media/customer/{id}/profile_{suffix}.webp`, `products/{vendorId}/{suffix}.webp` |
| `image-types.ts` | `BYTE_BUDGETS`, `assetTypeNeedsThumb`, `DEDUP_ASSET_TYPES` |
| `image-content-index.ts` | SHA256 dedup (`image_content_index` table) |
| `image-migrator.ts` | `ensureWebpFromLegacy`, `extractRawImageKey` |
| `image-migrator-persist.ts` | DB persist on lazy migrate |
| `image-resolve.ts` | `resolveImageForContext`, `enrichProductImageForContext` |
| `image-url-builder.ts` | `urlForImageKey` — presign or `https://{MEDIA_CDN_DOMAIN}/{key}` |
| `image-repository.ts` | S3 put with `Cache-Control: public, max-age=31536000, immutable` |

### 2.3 Schema (migration `1067_image_content_index.sql`)

- `image_content_index` — `content_sha256` PK → `webp_key`, `thumb_key`
- `image_migration_log` — `legacy_key` PK → `webp_key`

**No image URL columns added** to entity tables — reuses `profile_photo_url`, `products.images`, `vendors.metadata.facility_photos`, etc.

### 2.4 S3 key conventions

- **Suffix:** `Date.now().toString(36) + sha256[0:8]` (not random UUID filenames)
- **Thumb:** sibling `display.thumb.webp` via `buildThumbWebpKey()`
- **Cleanup:** replaced keys moved under `cleanup/` prefix
- **Lifecycle (Terraform, not yet applied on prod):** `infra/modules/s3/main.tf` — expire `cleanup/`, `legacy/`

---

## 3. Upload path inventory (for migration work)

### 3.1 ✅ ImageService paths (prod-verified)

| Endpoint | File | assetType |
|----------|------|-----------|
| `POST /storage/upload-media` | `storage.ts` | `profile` / `pet` |
| `POST /vendor/:id/products/images` | `vendor/endpoints/vendor-products.ts` | `product` |
| `POST /vendor/:id/profile/photo` | `vendorProfile.vendor.ts` | `profile` (+ vendorId) |
| `POST /vendor/:id/logo` | `vendorProfile.vendor.ts` | `profile` |
| `POST /staff/:id/profile/photo` | `staff.ts` | `staff` |
| `POST /vendor/facility/:vendorId/photos` | `service-discovery.customer.ts` | `facility` |
| Admin banner upload | `admin-governance-enhanced.ts` | `banner` |

**Client entry points:**

- Customer: `apps/customer-web/lib/photo-upload-enhanced.ts` → `/storage/upload-media` + `normalizeProfilePhotoFile`
- Vendor product: `apps/vendor-web/lib/product-image-upload.ts` → multipart products/images
- Vendor staff: `apps/vendor-web/lib/photo-upload-enhanced.ts` → `uploadStaffPhotoWithProgress` (multipart)
- Vendor gallery: `uploadFacilityCenterPhotosWithProgress` → multipart/JSON to facility endpoint (NOT presigned helper)
- Meal products: `MealProductFormModal.tsx` → `uploadProductImage`

### 3.2 ❌ Legacy / bypass paths (remaining work)

| Path | File(s) | Fix |
|------|---------|-----|
| Resort photos | `apps/vendor-web/.../ResortManagementDashboard.tsx` L837 | Route to ImageService multipart (new endpoint or reuse facility/product) |
| Customer staff photo | `apps/customer-web/lib/photo-upload-enhanced.ts` `uploadStaffPhotoWithProgress` | Use multipart `/staff/:id/profile/photo` like vendor-web |
| Vendor `uploadImageWithProgress` | `apps/vendor-web/lib/photo-upload-enhanced.ts` | Deprecate or redirect to ImageService; only used by unused `uploadFacilityCenterPhotoWithProgress` |
| `/storage/upload` + `/storage/upload-multiple` | `storage.ts` | If `file.type.startsWith('image/')`, reject or proxy to `uploadDisplayImage` |
| Bulk XLSX | `bulk-product-upload.ts` `skipImageIngest: true` | Optional PR: run `product-image-ingest` post-upload or separate backfill |
| External hotlinks | `products.images` Glen & Co URLs | `scripts/backfill-product-images-to-s3.js` (Jimp JPEG, not WebP) |

### 3.3 Presigned policy

- `backend/lambda/src/utils/reject-presigned-image-upload.ts`
- Enforced on: `file-upload.ts`, `storage.ts` (`/upload/presigned-url`, `/storage/presigned-upload-url`)
- **Documents/PDF/invoices:** presigned still valid

---

## 4. Read / render layer (Phase 3.1 — done)

| Surface | Helper | Context |
|---------|--------|---------|
| Shop product list | `prepareStorefrontProductRows` → `enrichProductImageForContext` | `list` → thumb URL in `images[]` |
| Product PDP | `prepareStorefrontProductRow(..., 'detail')` | full display URL |
| Customer profile + pets | `resolveImageForContext` + DB persist | lazy WebP migrate |
| Facility gallery (customer view) | `presignCustomerFacilityGalleryUrls` | `resolveImageForContext` list |
| Banners | `presignBannerImageForDisplay(id)` | thumb + lazy migrate |

### 4.1 Not yet on resolve layer

- `vendor-listing-photo.ts` — search/discovery listing thumbnails
- Staff photo in staff list APIs
- All admin vendor grids
- SKU images in some vendor catalog responses (partially via `presignProductSkusForDisplay`)
- `facility_photos` JSONB backfill (script only touched `vendors.profile_photo_url` scalar)

---

## 5. Backfill status (prod, 2026-07-10)

| Metric | Value |
|--------|-------|
| `image_migration_log` rows | ~292 |
| Customer/pet/vendor scalar `profile_photo_url` legacy `media/*` | **0** remaining |
| HEIC failures | ~4 pets (Sharp no HEIC plugin) — originals kept |
| External product URLs | Unchanged (by design) |
| Script | `scripts/backfill-image-webp.js` — use `--use-rds-data-api` from Windows |

**Run pattern:**

```bash
ENVIRONMENT=prod node scripts/backfill-image-webp.js --use-rds-data-api --limit=50        # dry-run
ENVIRONMENT=prod node scripts/backfill-image-webp.js --use-rds-data-api --apply --limit=50
```

**Gap:** extend script for `vendors.metadata.facility_photos` JSONB array and `product_skus.images`.

---

## 6. Phase 2 — Performance (NOT started)

### 6.1 Infrastructure

- [ ] Media CloudFront distribution + OAC on uploads bucket
- [ ] `MEDIA_CDN_DOMAIN` env on `warmpawz-prod-api-handler` (Terraform `infra/modules/lambda`)
- [ ] Apply S3 lifecycle rules (`infra/modules/s3/main.tf`) on prod Terraform
- [ ] CloudWatch `Warmpawz/ImageProcessing` metrics IAM (optional, in `infra/modules/lambda/main.tf`)

`urlForImageKey` already emits CDN URLs when `MEDIA_CDN_DOMAIN` is set.

### 6.2 Client caching

- [ ] `apps/customer-web/lib/image-asset-cache.ts` (IndexedDB/LRU by `imageKey`)
- [ ] Mirror in `apps/vendor-web`
- [ ] Upgrade `apps/customer-web/components/shared/PresignableImage.tsx` v2:
  - Accept `thumbUrl`, `width`, `height` (CLS)
  - Blob cache before network; presign refresh fallback
- [ ] Wire shop grids: `ShopProductsSection`, `ShopProductCard`, `RecommendationProductTile` to prefer `thumbUrl`
- [ ] Vendor product grid equivalent (no `PresignableImage` today)

### 6.3 API enrichments (optional before CDN)

- Return structured image objects on product rows: `{ key, url, thumbUrl, width, height }` in addition to string `images[]` for backward compat

---

## 7. Phase 3.2 — Remaining pipeline gaps

### 7.1 Upload unification (PR-sized tasks)

1. **ResortManagementDashboard** — replace presigned with ImageService multipart
2. **Customer `uploadStaffPhotoWithProgress`** — align with vendor staff path
3. **`/storage/upload` + `/storage/upload-multiple`** — reject or route `image/*` to ImageService
4. **Delete dead code:** `backend/lambda/src/endpoints/vendor-products.ts` (unregistered raw PutObject handler)
5. **Remove or rewrite** `uploadImageWithProgress` / `uploadFacilityCenterPhotoWithProgress` presigned helpers

### 7.2 Read layer

1. Wire `resolveImageForContext` into `vendor-listing-photo.ts`
2. Staff list GETs → thumb URLs
3. `presignProductSkusForDisplay` — pass `list` vs `detail` context consistently

### 7.3 Backfill & ingest

1. Extend `backfill-image-webp.js` for `facility_photos` JSONB + `product_skus.images`
2. Optional: upgrade `backfill-product-images-to-s3.js` to WebP via Sharp (or call same key builder)
3. HEIC: add `@img/sharp-libvips` HEIF support OR document re-upload policy

### 7.4 Tests

- `image-resolve.test.ts`, `image-concurrency.test.ts` exist
- Add: migrator persist integration test, `prepareStorefrontProductRow` list vs detail thumb behavior

---

## 8. Prod deploy & smoke checklist

### Deploy order (safe, zero-downtime)

1. Merge PR → `develop` (CI deploys dev)
2. Prod Lambda only: `LAMBDA_FUNCTION_NAME=warmpawz-prod-api-handler ./scripts/deploy-lambda-direct.sh`
3. Frontends only when Phase 2 client cache ships
4. Terraform before CDN cutover
5. Backfill after Lambda with read-layer is live

### Smoke tests (manual + API)

| # | Test | Pass |
|---|------|------|
| 1 | Customer profile upload | 200, `imageKey` ends `.webp` |
| 2 | Vendor product image | 200 + `.thumb.webp` in S3 |
| 3 | Vendor gallery | 200, `facility_photos` keys `.webp` |
| 4 | Vendor profile | 200, `media/vendor/.../profile_*.webp` |
| 5 | `GET /ecommerce/products?limit=10` | 200, images presigned |
| 6 | `GET /ecommerce/products/{id}` | 200, PDP images |
| 7 | `GET /customer/vendors/search` | 200 |
| 8 | `POST /upload/presigned-url` + `image/jpeg` | 400 |
| 9 | `POST /upload/presigned-url` + `application/pdf` | 200 |
| 10 | CloudWatch `image.upload.success` | present after upload |

---

## 9. Git / branch context

| PR | Content |
|----|---------|
| #451 | Phase 1 Lean Asset Pipeline |
| #454 | Hotfix: Sharp gate, client normalize, vendor profile |
| #455 | Phase 3.0 upload unification |
| #457 | Phase 3.1 read layer + backfill script |
| `cfa486e5b` | Backfill script RDS Data API support (direct on `develop`) |

**Feature branch pattern:** `feature/<name>-image-phase<N>-<short-desc>` → PR to `develop`

---

## 10. Known prod issues & edge cases

1. **Sharp linux-x64** — must be in Lambda zip (`scripts/package-lambda.js` cross-install); verify before every prod deploy
2. **Quality scale** — Sharp expects integer 1–100 (`QUALITY_START=85`), not 0.85
3. **HEIC** — fails on server; client `normalizeProfilePhotoFile` re-encodes to JPEG where used
4. **External product URLs** — shop shows Glen & Co hotlinks; not broken, not on our S3
5. **Vendor `profile_photo_url` backfill** — some rows had `vendors/.../facility/...` paths stored in profile column; migrated to `media/vendor/.../profile_*.webp` (display key only)
6. **Customer web not redeployed** for Phase 3.1 — API backward compatible (string URLs in responses)

---

## 11. Recommended work order for next agent

```
Phase 3.2-upload (PR A)  → close remaining bypass paths (§7.1)
Phase 3.2-read   (PR B)  → vendor listing + staff thumbs (§7.2)
Phase 3.2-backfill (ops) → facility_photos JSONB + product_skus (§7.3)
Phase 2-infra    (PR C)  → CloudFront + MEDIA_CDN_DOMAIN (§6.1)
Phase 2-client   (PR D)  → image-asset-cache + PresignableImage v2 (§6.2)
Phase 2-cutover  (ops)   → Terraform → Lambda env → deploy customer + vendor web
```

**Do not run bulk backfill before upload gaps are closed** if those paths still write raw JPG keys.

---

## 12. Key file index (quick navigation)

```
backend/lambda/src/services/image/          # Pipeline core
backend/lambda/src/utils/s3-media-presign.ts
backend/lambda/src/utils/reject-presigned-image-upload.ts
backend/lambda/src/utils/product-image-ingest.ts
backend/lambda/src/endpoints/storage.ts
backend/lambda/src/endpoints/vendor/endpoints/vendor-products.ts
backend/lambda/src/endpoints/vendor/endpoints/vendorProfile.vendor.ts
backend/lambda/src/endpoints/customer/customerEndpoint/service-discovery.customer.ts
apps/customer-web/lib/photo-upload-enhanced.ts
apps/customer-web/lib/normalize-profile-photo.ts
apps/vendor-web/lib/photo-upload-enhanced.ts
apps/vendor-web/lib/product-image-upload.ts
scripts/backfill-image-webp.js
scripts/backfill-product-images-to-s3.js
db/migrations/1067_image_content_index.sql
infra/modules/s3/main.tf
```

---

## 13. Agent instructions

1. Read this file and `team-development-bible.mdc` before prod changes.
2. Default env: **dev**. Prod deploy/migration/backfill only when user explicitly requests.
3. Never use CDK — deploy via `scripts/deploy-*.sh`.
4. Windows: use `--use-rds-data-api` for backfill/migrations when port 5432 times out.
5. After read-layer or DTO changes, run: `cd backend/lambda && npm test -- --testPathPattern="image-"`.
6. Commit only when user asks; PR target is always `develop`.

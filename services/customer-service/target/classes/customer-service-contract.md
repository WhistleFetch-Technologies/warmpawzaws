# Customer Service Contract Notes

## Address Update

`PUT /customer/{customerId}/addresses/{addressId}` and `PATCH /customer/{customerId}/addresses/{addressId}` are partial updates for frontend compatibility. Create remains strictly validated and requires name, phone, addressLine1, city, state, and pincode.

The alias routes without a customer id (`/customer/addresses/{addressId}` and `/customers/addresses/{addressId}`) derive the effective customer from the address row before changing default-address state.

Phone alias routes (`/customer/{phone}/addresses/{addressId}` and `/customers/{phone}/addresses/{addressId}`) resolve the owner customer by phone first and then enforce ownership checks, so phone aliases cannot update or delete another customer's address.

`POST /customer/addresses` now requires explicit owner context through `customerPhone` query param or `X-Customer-Phone` header. `request.phone` remains the address contact phone field and is no longer used for owner resolution.

## Deactivate Reason

`DELETE /customer/{id}` performs a soft deactivate by setting `is_active=false`, status to `inactive`, and `deactivated_at=now()`. The optional `reason` is accepted from query param or request body and persisted to `customers.deactivation_reason` when non-blank. Clients may still omit `reason`.

DDL is manual and Flyway-free: apply `docs/sql/customer-deactivation-reason.sql` against Aurora before relying on the new columns. The service keeps `spring.jpa.hibernate.ddl-auto=none`.

## Phone Validation and Security Defaults

Profile and customer lookup routes now normalize phone values to digits and reject invalid values with a standard bad-request envelope (`success=false`, `message`, `data` object). This prevents malformed phone values from drifting into repository queries during cutover.

Security is default-on for live usage through `APP_SECURITY_ENABLED` (`true` default). Local/test can still disable explicitly with `app.security.enabled=false`.

When `APP_SECURITY_UAT_JWT_ENABLED=true`, customer-service also accepts Lambda-compatible UAT JWTs with `iss=warmpawz-uat`, `aud=warmpawz-api`, and HS256 signing via `UAT_JWT_SECRET`. Keep `UAT_JWT_SECRET` identical to the Lambda issuer environment; if the flag is enabled and the secret is empty, the service fails startup rather than trusting a default secret.

## Redis Cache Configuration

Cache defaults remain local-safe: `APP_CACHE_REDIS_ENABLED=false` uses Caffeine only. If Redis cache is enabled, customer-service pings Redis before selecting the Redis-backed `CacheManager`; when `APP_CACHE_REDIS_FALLBACK_TO_CAFFEINE_ON_ERROR=true` (default), startup falls back to Caffeine if Redis is unreachable and runtime cache operations also fall back to Caffeine.

Dev ECS Redis env vars, when Redis is intentionally enabled:

- `APP_CACHE_REDIS_ENABLED=true`
- `APP_CACHE_REDIS_FALLBACK_TO_CAFFEINE_ON_ERROR=true`
- `SPRING_DATA_REDIS_HOST`
- `SPRING_DATA_REDIS_PORT`
- `SPRING_DATA_REDIS_USERNAME` (only if required)
- `SPRING_DATA_REDIS_PASSWORD` (secret, do not commit)
- `SPRING_DATA_REDIS_SSL_ENABLED`
- `SPRING_DATA_REDIS_TIMEOUT`

`management.health.redis.enabled=false` stays the default so health checks do not fail in environments without Redis. Enable it only when Redis is always configured and should be a hard health dependency.

## Idempotency and Duplicate-Submit Guard

Create endpoints accept optional `Idempotency-Key` header:

- `POST /customer`
- `POST /customer/{customerId}/addresses`
- `POST /customer/addresses`
- `POST /customer/{customerId}/pets`
- `POST /pets`

`Idempotency-Key` is processed as a shared key per endpoint scope:

- scope key: method + normalized route alias + owner context (customer id/phone when relevant)
- payload key component: SHA-256 hash of request payload
- full composite key: scope + idempotency key + payload hash

Rules:

- same key + same payload: replay the stored `CommonResponse` envelope
- same key + different payload: reject with `409 Conflict`
- same key while first request is in-flight: short wait/poll; if not completed in time, return conflict and client retries

### Idempotency Provider Matrix

| Provider | Property | Cross-instance | Typical use |
| --- | --- | --- | --- |
| Redis | `APP_IDEMPOTENCY_PROVIDER=redis` | Yes (SET NX + TTL) | Multi-instance canary/prod |
| DB | `APP_IDEMPOTENCY_PROVIDER=db` | Yes (unique `(scope_key,idempotency_key)`) | Default shared fallback |
| Memory | `APP_IDEMPOTENCY_PROVIDER=memory` | No | Local dev only |

TTL is controlled by `APP_IDEMPOTENCY_TTL_SECONDS`.

## Hard Duplicate Constraints

Address duplicate business key (normalized):

- `customer_id`
- `address_line1`
- `address_line2`
- `city`
- `state`
- `pincode`
- `label/address_type`

Pet duplicate business key (normalized):

- `customer_id`
- `name`
- `species`
- `breed`

Normalization trims and lowercases text fields before checks. Duplicate creates return `409 Conflict` with standard error envelope.

DB-level unique indexes are provided under `docs/sql/canary-hardening.sql` and are applied manually during migration windows (no auto DDL/deploy execution), for example:

```bash
psql "$DATABASE_URL" -f services/customer-service/docs/sql/canary-hardening.sql
```

If pre-existing duplicates exist, clean them before applying the indexes.

## Bookings Scope

Option A is in force: bookings stay outside customer-service until a BFF or booking-service integration is explicitly built. `GET /customer/{phone}/pets/{petId}/bookings` verifies pet ownership, then returns `501 Not Implemented` with an empty bookings payload and `ownerService=booking-service`. Unified profile placeholders are empty and must not be interpreted as migrated booking data.

## Pagination and Cache Keys

Pets and addresses list APIs accept `page`, `size`, and `sort` with default `page=0`, `size=10`, `sort=createdAt,desc`. Services clamp size to 1-50 and include page, size, and sort in cache keys. Pet/address writes clear the full related paginated cache families because targeted page-key eviction is not available.

## SQL Query Telemetry

Per-request SQL query count is captured with Hibernate `StatementInspector` and logged at request end:

- structured log: `event=sql_request_summary endpoint method status requestId queryCount`
- threshold warning: `APP_SQL_WARN_THRESHOLD` (default 20)
- feature toggle: `APP_SQL_METRICS_ENABLED`

Micrometer metrics:

- `sql_queries_per_request{endpoint,method,status}` (distribution summary)
- `sql_queries_per_request_requests_total{endpoint,method,status}` (request counter)

## Route Ownership During Strangler Cutover

When gateway routes `/customer/**`, `/customers/**`, and `/pets/**` to Java service, Java is the single write owner for those routes. Do not enable TS write fallback for the same traffic slice.

Frontend traffic must continue to use the shared API Gateway base URL `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`. The gateway split keeps narrow Java-owned routes on the Java integration and leaves discovery/password/auth and other unmigrated routes on Lambda.

## Dev Deploy Ergonomics

Use `scripts/deploy-customer-service-dev.sh` for customer-service dev ECS deploys. The script logs in to ECR, packages with Maven, pushes a Jib image tag, registers a new revision from the current ECS task definition, and forces a service deployment. Override account/region/cluster/service/family/container/repository with env vars as needed; do not use CDK for this deploy.

## Manual Smoke Checklist

- `GET /customer/profile?phone=<phone>` through API Gateway returns the expected profile envelope.
- `GET /customer/{customerId}/addresses?page=0&size=10` returns `pagination` when addresses are touched.
- `GET /customer/pets/{phone}?page=0&size=10` returns `pagination` when pets are touched.
- `GET /customer/{phone}/pets/{petId}/bookings` returns `501` with `ownerService=booking-service`.
- With `APP_SECURITY_ENABLED=true` and `APP_SECURITY_UAT_JWT_ENABLED=true`, a valid UAT bearer token succeeds; do not paste bearer tokens in logs or PR output.

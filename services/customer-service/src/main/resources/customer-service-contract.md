# Customer Service Contract Notes

## Address Update

`PUT /customer/{customerId}/addresses/{addressId}` and `PATCH /customer/{customerId}/addresses/{addressId}` are partial updates for frontend compatibility. Create remains strictly validated and requires name, phone, addressLine1, city, state, and pincode.

The alias routes without a customer id (`/customer/addresses/{addressId}` and `/customers/addresses/{addressId}`) derive the effective customer from the address row before changing default-address state.

Phone alias routes (`/customer/{phone}/addresses/{addressId}` and `/customers/{phone}/addresses/{addressId}`) resolve the owner customer by phone first and then enforce ownership checks, so phone aliases cannot update or delete another customer's address.

`POST /customer/addresses` now requires explicit owner context through `customerPhone` query param or `X-Customer-Phone` header. `request.phone` remains the address contact phone field and is no longer used for owner resolution.

## Deactivate Reason

`DELETE /customer/{id}` performs a soft deactivate by setting `is_active=false` and status to `inactive`. The optional `reason` is accepted for API compatibility but is not persisted because the current schema has no audit reason column or table and `spring.jpa.hibernate.ddl-auto=none` is preserved.

## Phone Validation and Security Defaults

Profile and customer lookup routes now normalize phone values to digits and reject invalid values with a standard bad-request envelope (`success=false`, `message`, `data` object). This prevents malformed phone values from drifting into repository queries during cutover.

Security is default-on for live usage through `APP_SECURITY_ENABLED` (`true` default). Local/test can still disable explicitly with `app.security.enabled=false`.

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

DB-level unique indexes are provided under `docs/sql/canary-hardening.sql` and are applied manually during migration windows (no auto DDL/deploy execution).

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

# Booking Create Flow – Parameter-by-Parameter Trace

**Purpose:** Map the full path of a `POST /bookings/create` request and response to find where `bookingId` is lost. No code changes until the exact failure point is identified.

**API (dev):** `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com`  
**Observed:** Client receives HTTP 200 with `{ success, data: { message, isNew, paymentRequired, remainingDue }, meta }` — **no `bookingId`**, no `status`.

---

## 1. Frontend → API (request)

**File:** `apps/customer-web/components/customer/payment/UniversalPaymentPage.tsx`

| Step | What | Where |
|------|------|--------|
| 1.1 | User clicks "Pay" | Button triggers handler that builds payload and calls booking create |
| 1.2 | Payload built | `bookingPayload` includes: `customerId`, `vendorId`, `serviceId`, `serviceName`, `bookingDate`, `bookingTime`, `serviceType`, `amount`, `petId`, `customerName`, `customerPhone`, `petName`, `address`, etc. (see console log "Creating booking with validated payload") |
| 1.3 | Endpoints tried in order | `['/bookings/create', '/booking/create', '/customer/booking/create', '/customer/bookings/create']` |
| 1.4 | First success wins | `bookingRes = await apiClient.post<any>(endpoint, bookingPayload)` |
| 1.5 | API client | `apps/customer-web/lib/api-client.ts`: `post()` → `request()` → `fetch(getApiBaseUrl() + endpoint, { method: 'POST', body: JSON.stringify(data) })` |
| 1.6 | Base URL (dev) | `getApiGatewayUrl()` → `https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com` (when not production) |
| 1.7 | Full URL | `POST https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com/bookings/create` with JSON body |
| 1.8 | Response handling | On 2xx: `return response.json()` → caller gets **parsed body only** (no response headers in return value) |

**Conclusion:** Frontend sends a valid JSON payload and receives whatever the HTTP response body is. It does not add or remove fields.

---

## 2. API Gateway → Lambda (inbound)

**Assumption:** API Gateway HTTP API (v2) invokes one Lambda with the request.

| Step | What | Notes |
|------|------|--------|
| 2.1 | Route | Path `/bookings/create` matches catch-all `/{proxy+}` (if CDK-deployed) or equivalent. |
| 2.2 | Event to Lambda | APIGatewayProxyEventV2: `rawPath`, `requestContext.http.method`, `body` (string), `headers`, etc. |
| 2.3 | Lambda handler | `backend/lambda/src/handler/index.ts` → `export const handler` |

**Conclusion:** Request reaches the Lambda as a normal HTTP API v2 event. No transformation of the request body is assumed here.

---

## 3. Lambda handler → Hono (request conversion)

**File:** `backend/lambda/src/handler/index.ts` (lines ~946–1061)

| Step | What | Code / value |
|------|------|----------------|
| 3.1 | URL | `rawPath = event.rawPath \|\| event.requestContext?.http?.path` → e.g. `/bookings/create` |
| 3.2 | URL with domain | `url = 'https://' + domainName + rawPath + queryString` (domainName from apiId or requestContext) |
| 3.3 | Body | If JSON: parsed into `parsedBody`; also `requestBody = event.body` (string). |
| 3.4 | Request | `new Request(url, { method, headers, body: requestBody })` |
| 3.5 | Hono fetch | `response = await app.fetch(request, { event, parsedBody })` |

**Conclusion:** Hono receives a Request whose body is the same as the API Gateway body. No body stripping at this stage.

---

## 4. Hono → POST /bookings/create route

**File:** `backend/lambda/src/endpoints/bookings-enhanced.ts` (lines 2496–2562)

| Step | What | Code / value |
|------|------|----------------|
| 4.1 | Route match | `app.post('/bookings/create', async (c) => { ... })` |
| 4.2 | Body | `body = (c.env.parsedBody) \|\| await c.req.json()` — same payload as sent by frontend. |
| 4.3 | Synthetic event | Built from `c.req`: `path: c.req.path`, `body: JSON.stringify(body)`, etc. |
| 4.4 | Handler call | `result = await createHandler.execute(event, context)` |
| 4.5 | Result | `result = { statusCode: 200, body: string, headers }` (see §5). |

**Conclusion:** The route passes the correct body into the create handler and gets back a string `result.body`.

---

## 5. CreateBookingHandlerEnhanced (business logic and response shape)

**File:** `backend/lambda/src/endpoints/bookings-enhanced.ts` (CreateBookingHandlerEnhanced)

| Step | What | Code / value |
|------|------|----------------|
| 5.1 | Idempotency | If `idempotencyKey` and replay: returns `{ statusCode: 200, body: existing.response }` where `existing.response` is stored string of `{ bookingId, status, message, isNew, paymentRequired, remainingDue }` (no `success`/`data`/`meta`). |
| 5.2 | Normal create | Inserts booking, then: `response = { bookingId: booking.id, status: booking.status, message: 'Booking created successfully', isNew: true, paymentRequired: remainingDueForResponse > 0, remainingDue: remainingDueForResponse }` |
| 5.3 | Return | `return this.success(response, requestId)` |
| 5.4 | BaseHandlerEnhanced.success() | **File:** `backend/lambda/src/handler/base-handler-enhanced.ts`: `createSuccessResponse(data, requestId)` → `{ success: true, data, meta: { timestamp, requestId, version } }`; then `return { statusCode: 200, body: JSON.stringify(response) }`. |
| 5.5 | So `result.body` (string) | For normal create: `'{"success":true,"data":{"bookingId":"<uuid>","status":"pending","message":"Booking created successfully",...},"meta":{...}}'` — **includes `data.bookingId` and `data.status`**. |

**Conclusion:** The handler **always** returns a body string that contains `bookingId` (and `status`) in `data`. Idempotency path has top-level `bookingId`.

---

## 6. Hono route: parse → normalize → return

**File:** `backend/lambda/src/endpoints/bookings-enhanced.ts` (same route, after execute)

| Step | What | Code / value |
|------|------|----------------|
| 6.1 | Parse | `responseBody = JSON.parse(result.body)` → object with `success`, `data` (with `bookingId`, `status`, `message`, …), `meta`. |
| 6.2 | Normalize | `normalizeBookingCreateResponse(responseBody)`: sets `responseBody.bookingId` and `responseBody.data.bookingId` from any of the known shapes; **also** appends ` \| bookingId:<uuid>` to `responseBody.data.message` when present. |
| 6.3 | Return | `return c.json(responseBody, result.statusCode)` → Hono Response with body = `JSON.stringify(responseBody)`. |

**Conclusion:** The object sent to `c.json()` has both `bookingId` and `data.bookingId`, and `data.message` includes the embedded `bookingId` suffix. The Lambda does not strip these before returning.

---

## 7. Lambda handler → API Gateway (outbound)

**File:** `backend/lambda/src/handler/index.ts` (lines 1063–1099)

| Step | What | Code / value |
|------|------|----------------|
| 7.1 | Hono response | `response = await app.fetch(request, ...)` — standard `Response` from Hono. |
| 7.2 | Body string | `responseBody = await response.text()` — **full JSON string** from `c.json(responseBody)` (includes `bookingId`, `data.bookingId`, and message suffix). |
| 7.3 | Return to API Gateway | `return { statusCode: response.status, body: responseBody, headers: finalHeaders }`. |

**Conclusion:** The Lambda returns to API Gateway a single `body` string that is the full JSON. **No code in the Lambda or Hono app removes `bookingId` or the message suffix.**

---

## 8. API Gateway → Client (response)

| Step | What | Notes |
|------|------|--------|
| 8.1 | Lambda return | `{ statusCode: 200, body: "<full JSON>", headers }`. |
| 8.2 | API Gateway behavior | **Expected (HTTP API v2, default Lambda integration):** response body is the Lambda `body` as-is. **If** the API was created with a custom integration or response mapping, the gateway could overwrite or reshape the body. |
| 8.3 | Observed at client | Body is `{ success, data: { message, isNew, paymentRequired, remainingDue }, meta }` — **no `bookingId`**, no `status`, and `message` is only `"Booking created successfully"` (no ` \| bookingId:...`). |

**Conclusion (updated after direct Lambda invoke):**  
When the Lambda was invoked **directly** (AWS CLI `aws lambda invoke` with a test event), the returned `body` was **also** the reduced shape: `{ success, data: { message, isNew, paymentRequired, remainingDue }, meta }` with **no `bookingId`** and **no ` \| bookingId:...` in message**. So the loss is **inside the Lambda**, not in API Gateway. The handler’s `result.body` (or the Hono response body) is already reduced before it is returned to the caller. The trace in §1–7 still applies; the failure point is somewhere in the Lambda code path (e.g. handler return value, normalizer, or Hono response) before the Lambda return value is built.

---

## 9. Summary: Where is `bookingId` lost?

| Segment | Responsible | Passes bookingId? |
|---------|-------------|-------------------|
| Frontend request | customer-web | N/A (request) |
| API Gateway → Lambda | AWS | N/A (request) |
| Lambda handler → Hono | index.ts | N/A (request) |
| Hono route → CreateBookingHandler | bookings-enhanced.ts | N/A (request) |
| CreateBookingHandler success response | bookings-enhanced.ts | **Yes** — `data.bookingId`, `data.status` in stringified body |
| Hono parse + normalize + c.json | bookings-enhanced.ts | **Yes** — adds top-level and message suffix |
| Lambda return (response.text) | index.ts | **Yes** — returns same string |
| **Lambda → API Gateway → Client** | **API Gateway or wrong Lambda** | **No** — client sees reduced body |

**Root cause (by elimination):** The loss happens **after** the Lambda returns and **before** the client receives the body. So it is either:

1. **API Gateway** (z0b3obweb6) applying a **response mapping** or non-passthrough integration that restricts the body to a fixed shape (e.g. only `success`, `data.message`, `data.isNew`, `data.paymentRequired`, `data.remainingDue`, `meta`), or  
2. The API is invoking a **different Lambda** (or version) that does not include the current booking-create response shape.

---

## 10. Recommended checks (no code changes)

1. **AWS Console – API Gateway (z0b3obweb6)**  
   - Confirm the route for `POST /bookings/create` (or `/{proxy+}`) uses **Lambda proxy integration** (passthrough).  
   - If there is an integration response or response mapping template, remove or change it so the Lambda response body is returned unchanged.

2. **AWS Console – API Gateway integration**  
   - Open the integration for the route that handles `POST /bookings/create`.  
   - Ensure **payload format version 2.0** and that no response transformation is applied (no mapping that rewrites the body).

3. **AWS Console – Lambda**  
   - Confirm that the API Gateway integration targets the **same** Lambda (e.g. `warmpawz-api-dev-api`) and alias/version that you deploy with `./scripts/deploy-lambda-direct.sh`.

4. **CloudWatch**  
   - For a failing request, find the log line: `[BOOKING-CREATE] Response keys: ..., bookingId: <value>`.  
   - If `bookingId` is present there, the Lambda is sending it and the issue is definitely API Gateway or routing.  
   - If that log line is missing, the request may be hitting a different code path or Lambda.

---

## 11. Optional: Verify Lambda response without API Gateway

Invoke the **Lambda directly** (e.g. AWS CLI or Console “Test”) with an API Gateway HTTP API v2-style event for `POST /bookings/create` and inspect the returned `body`. If that body contains `bookingId` (and the message suffix), then the only remaining explanation is API Gateway or which Lambda the API is actually calling.

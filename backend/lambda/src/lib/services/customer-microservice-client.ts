/**
 * Optional delegation to the Java customer-service (`services/customer-service`).
 *
 * Local: set in `.env` or shell before `serverless-offline` / local handler:
 *   CUSTOMER_SERVICE_URL=http://127.0.0.1:8080
 *   CUSTOMER_SERVICE_ENABLED=true
 *
 * AWS: set the same on the API Lambda; use private ALB/NLB URL + security group.
 * Optional: CUSTOMER_SERVICE_API_KEY (sent as X-Api-Key) when the Java app secures internal routes.
 */

function customerServiceBaseUrl(): string {
  return (process.env.CUSTOMER_SERVICE_URL || '').trim().replace(/\/$/, '');
}

export function isCustomerMicroserviceEnabled(): boolean {
  return process.env.CUSTOMER_SERVICE_ENABLED === 'true' && customerServiceBaseUrl().length > 0;
}

export type CustomerByPhoneMsResult =
  | { kind: 'hit'; body: { success: true; customer: Record<string, unknown> } }
  | { kind: 'miss' };

/**
 * GET {base}/customer/by-phone?phone= — try Java; on non-2xx or error, return miss (caller uses RDS).
 */
export async function getCustomerByPhoneFromMicroservice(phone: string): Promise<CustomerByPhoneMsResult> {
  if (!isCustomerMicroserviceEnabled()) {
    return { kind: 'miss' };
  }
  const base = customerServiceBaseUrl();
  const url = `${base}/customer/by-phone?phone=${encodeURIComponent(phone)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const apiKey = (process.env.CUSTOMER_SERVICE_API_KEY || '').trim();
  if (apiKey) {
    headers['X-Api-Key'] = apiKey;
  }

  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 12_000);
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: ac.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(
        '[customer-microservice] non-OK:',
        res.status,
        text ? text.slice(0, 200) : ''
      );
      return { kind: 'miss' };
    }

    const json = (await res.json()) as {
      success?: boolean;
      data?: { customer?: Record<string, unknown> };
    };
    const raw = json?.data?.customer;
    if (!raw || json.success === false) {
      return { kind: 'miss' };
    }
    const id = raw.id != null ? String(raw.id) : '';
    if (!id) {
      return { kind: 'miss' };
    }

    const body = {
      success: true as const,
      customer: {
        id,
        phone: raw.phone != null ? String(raw.phone) : phone,
        name: raw.name != null ? String(raw.name) : null,
        email: raw.email != null ? String(raw.email) : null,
        status: raw.status != null ? String(raw.status) : null,
        onboarding_status:
          raw.onboardingStatus != null
            ? String(raw.onboardingStatus)
            : raw.onboarding_status != null
              ? String(raw.onboarding_status)
              : null,
        profile_completed:
          raw.profileCompleted != null
            ? Boolean(raw.profileCompleted)
            : raw.profile_completed != null
              ? Boolean(raw.profile_completed)
              : null,
        createdAt:
          raw.createdAt != null
            ? String(raw.createdAt)
            : raw.created_at != null
              ? String(raw.created_at)
              : null,
      },
    };

    console.info('[customer-microservice] delegated GET /customer/by-phone');
    return { kind: 'hit', body };
  } catch (e: unknown) {
    const msg =
      e && typeof e === 'object' && 'name' in e && (e as { name?: string }).name === 'AbortError'
        ? 'timeout'
        : e instanceof Error
          ? e.message
          : String(e);
    console.warn('[customer-microservice] request failed:', msg);
    return { kind: 'miss' };
  } finally {
    clearTimeout(t);
  }
}

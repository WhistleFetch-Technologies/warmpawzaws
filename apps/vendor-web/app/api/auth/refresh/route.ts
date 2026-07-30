import { NextRequest, NextResponse } from 'next/server';


function gatewayBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  return raw.replace(/\/+$/, '');
}

/**
 * Proxies POST /api/auth/refresh → Lambda POST /auth/refresh (local Next dev only).
 * Production static export calls `${getApiBaseUrl()}/auth/refresh` directly — see cognito-auth.ts.
 */
export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    // Malformed request payload — return 400 (NOT 401) so the client does not
    // mistake this for "refresh token rejected" and wipe the vendor session.
    return NextResponse.json({ error: 'Malformed refresh request body' }, { status: 400 });
  }

  const upstream = `${gatewayBase()}/auth/refresh`;

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } catch {
    // Upstream Lambda is unreachable (network blip, deploy, cold start). Return
    // 502 — the client refresh helper treats non-auth statuses as transient and
    // keeps the existing session intact (90-day refresh window stays open).
    return NextResponse.json(
      { error: 'Upstream auth service unreachable', refreshFailureCode: 'upstream_unreachable' },
      { status: 502 },
    );
  }

  const responseBody = await res.text();
  return new NextResponse(responseBody, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  });
}

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function gatewayBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  return raw.replace(/\/+$/, '');
}

/**
 * Proxies POST /api/auth/refresh → Lambda POST /auth/refresh.
 * Keeps the refresh token opaque to the browser — the raw token is forwarded to
 * the backend for cryptographic verification; only new access/id tokens are returned.
 */
export async function POST(request: NextRequest) {
  let body: string;
  try {
    body = await request.text();
  } catch {
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
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
    return NextResponse.json({ error: 'Invalid or expired refresh token' }, { status: 401 });
  }

  const responseBody = await res.text();
  return new NextResponse(responseBody, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  });
}

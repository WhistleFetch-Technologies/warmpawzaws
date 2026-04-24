import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for /chat/* in local dev so the browser does not call /chat/... on the
 * Next app (which would 404: no page at /chat/conversations). Forwards to API Gateway.
 * Production static export: customer app still uses full API base URL in the client.
 */
export const dynamic = 'force-dynamic';

function gatewayBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  return raw.replace(/\/+$/, '');
}

function forwardHeaders(request: NextRequest): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) headers['Authorization'] = auth;
  const xu = request.headers.get('x-uat-mode');
  if (xu) headers['X-UAT-Mode'] = xu;
  const xt = request.headers.get('x-uat-token');
  if (xt) headers['X-UAT-Token'] = xt;
  const xcp = request.headers.get('x-customer-phone');
  if (xcp) headers['X-Customer-Phone'] = xcp;
  return headers;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathSegs } = await context.params;
  const sub = pathSegs?.length ? pathSegs.map((p) => encodeURIComponent(p)).join('/') : '';
  const sp = request.nextUrl.search;
  const upstream = `${gatewayBase()}/chat/${sub}${sp}`;

  let res: Response;
  try {
    res = await fetch(upstream, { headers: forwardHeaders(request), cache: 'no-store' });
  } catch (e) {
    console.error('[bff/chat] GET upstream error', e);
    return NextResponse.json({ success: true, conversations: [] }, { status: 200 });
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathSegs } = await context.params;
  const sub = pathSegs?.length ? pathSegs.map((p) => encodeURIComponent(p)).join('/') : '';
  const sp = request.nextUrl.search;
  const upstream = `${gatewayBase()}/chat/${sub}${sp}`;
  const text = await request.text();

  let res: Response;
  try {
    res = await fetch(upstream, {
      method: 'POST',
      headers: forwardHeaders(request),
      body: text,
      cache: 'no-store',
    });
  } catch (e) {
    console.error('[bff/chat] POST upstream error', e);
    return NextResponse.json({ success: false, error: 'proxy_failed' }, { status: 502 });
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  });
}

async function proxyWithBody(
  request: NextRequest,
  method: 'PUT' | 'PATCH' | 'DELETE',
  pathSegs: string[] | undefined
) {
  const sub = pathSegs?.length ? pathSegs.map((p) => encodeURIComponent(p)).join('/') : '';
  const sp = request.nextUrl.search;
  const upstream = `${gatewayBase()}/chat/${sub}${sp}`;
  const text = method === 'DELETE' ? undefined : await request.text();

  let res: Response;
  try {
    res = await fetch(upstream, {
      method,
      headers: forwardHeaders(request),
      body: text,
      cache: 'no-store',
    });
  } catch (e) {
    console.error(`[bff/chat] ${method} upstream error`, e);
    return NextResponse.json({ success: false, error: 'proxy_failed' }, { status: 502 });
  }

  const out = await res.text();
  return new NextResponse(out, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('content-type') || 'application/json' },
  });
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathSegs } = await context.params;
  return proxyWithBody(request, 'PUT', pathSegs);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathSegs } = await context.params;
  return proxyWithBody(request, 'PATCH', pathSegs);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  const { path: pathSegs } = await context.params;
  return proxyWithBody(request, 'DELETE', pathSegs);
}

import { NextRequest, NextResponse } from 'next/server';

/**
 * Localhost BFF: proxies `/api/bff/chat/*` → API Gateway `/chat/*`.
 * Client rewrites `/chat/...` here so Next does not treat `/chat/conversations` as a missing page route.
 */
export const dynamic = 'force-dynamic';

function gatewayBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  return raw.replace(/\/+$/, '');
}

const PASSTHROUGH_HEADERS = [
  'authorization',
  'content-type',
  'x-uat-mode',
  'x-uat-token',
  'x-customer-phone',
] as const;

async function proxy(request: NextRequest, context: { params: { path?: string[] } }) {
  const segments = context.params?.path ?? [];
  const subPath = segments.join('/');
  const search = request.nextUrl.search;
  const upstreamUrl = `${gatewayBase()}/chat/${subPath}${search}`;

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }

  const method = request.method.toUpperCase();
  const init: RequestInit = {
    method,
    headers,
    cache: 'no-store',
  };

  if (!['GET', 'HEAD'].includes(method)) {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(upstreamUrl, init);
  } catch (e) {
    console.error('[bff/chat] upstream fetch failed', upstreamUrl, e);
    return NextResponse.json(
      { success: false, error: 'Chat service unreachable', _proxyFallback: 'upstream_unreachable' },
      { status: 503 }
    );
  }

  const body = await upstream.arrayBuffer();
  const contentType = upstream.headers.get('content-type') || 'application/json';
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      'Content-Type': contentType,
    },
  });
}

export async function GET(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: { path?: string[] } }) {
  return proxy(request, context);
}

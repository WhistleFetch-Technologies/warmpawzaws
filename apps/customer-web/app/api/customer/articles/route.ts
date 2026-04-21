import { NextRequest, NextResponse } from 'next/server';

/** Static export: avoid `nextUrl.searchParams` (breaks prerender). */
export const dynamic = 'force-static';

function gatewayBase(): string {
  const raw =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.API_GATEWAY_URL ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';
  return raw.replace(/\/+$/, '');
}

function queryFromRequestUrl(request: NextRequest): string {
  try {
    const raw = request.url;
    const i = raw.indexOf('?');
    return i >= 0 ? raw.slice(i + 1) : '';
  } catch {
    return '';
  }
}

/**
 * Proxies GET /customer/articles to API Gateway (localhost dev). Static export tolerates this route.
 */
export async function GET(request: NextRequest) {
  const query = queryFromRequestUrl(request);
  const upstream = `${gatewayBase()}/customer/articles${query ? `?${query}` : ''}`;

  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  const auth = request.headers.get('authorization');
  if (auth) (headers as Record<string, string>)['Authorization'] = auth;
  const xu = request.headers.get('x-uat-mode');
  if (xu) (headers as Record<string, string>)['X-UAT-Mode'] = xu;
  const xt = request.headers.get('x-uat-token');
  if (xt) (headers as Record<string, string>)['X-UAT-Token'] = xt;

  let res: Response;
  try {
    res = await fetch(upstream, { headers, cache: 'no-store' });
  } catch {
    return NextResponse.json({
      success: true,
      articles: [],
      total: 0,
      _proxyFallback: 'upstream_unreachable',
    });
  }

  if (res.status === 503 || res.status === 502) {
    return NextResponse.json({
      success: true,
      articles: [],
      total: 0,
      _proxyFallback: 'upstream_service_unavailable',
    });
  }

  const body = await res.text();
  return new NextResponse(body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('content-type') || 'application/json',
    },
  });
}

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { 
  getRouteForStatus, 
  getRedirectRoute, 
  type OnboardingStatus 
} from './app/onboarding/route-map';

// ============================================================================
// NEXT.JS MIDDLEWARE FOR VENDOR ONBOARDING ROUTE GUARDS
// ============================================================================
// This middleware runs on the server before page loads
// It checks onboarding status and redirects users to appropriate routes
// Compatible with AWS Serverless architecture (Lambda + CloudFront)
// ============================================================================

/**
 * Get onboarding status from API
 * Falls back to localStorage if API call fails (for client-side compatibility)
 */
async function getOnboardingStatus(
  phone: string | null,
  apiBaseUrl: string
): Promise<OnboardingStatus | null> {
  if (!phone) return null;

  try {
    const response = await fetch(
      `${apiBaseUrl}/vendor/onboarding/status?phone=${encodeURIComponent(phone)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        // Add timeout for serverless environments
        signal: AbortSignal.timeout(5000),
      }
    );

    if (!response.ok) {
      console.warn('Failed to fetch onboarding status:', response.status);
      return null;
    }

    const data = await response.json();
    return data.identity?.onboarding_status as OnboardingStatus || null;
  } catch (error) {
    // Graceful degradation - allow request to proceed
    // Component-level checks will handle the validation
    console.warn('Error fetching onboarding status:', error);
    return null;
  }
}

/**
 * Check if route requires authentication
 */
function requiresAuth(pathname: string): boolean {
  // Public routes that don't require auth
  const publicRoutes = [
    '/auth',
    '/_next',
    '/api',
    '/static',
    '/favicon.ico',
  ];

  return !publicRoutes.some(route => pathname.startsWith(route));
}

/**
 * Get phone number from request
 * For static exports, we can't access cookies/headers on server
 * This middleware will allow the request to proceed and let client-side handle auth
 */
function getPhoneFromRequest(request: NextRequest): string | null {
  // Check cookie (set after OTP verification) - may not work in static export
  const phoneCookie = request.cookies.get('vendor_phone')?.value;
  if (phoneCookie) return phoneCookie;

  // Check Authorization header (if using token-based auth)
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    // Token might contain phone info - extract if needed
    // This would depend on your token structure
  }

  // For static exports, we can't read localStorage on server
  // Return null and let the client-side component handle the redirect
  // This allows the page to load first, then client checks localStorage
  return null;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.match(/\.(ico|png|jpg|jpeg|svg|gif|webp|css|js|woff|woff2|ttf|eot)$/)
  ) {
    return NextResponse.next();
  }

  // Get API base URL from environment or config
  const apiBaseUrl =
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    (request.headers.get('x-api-base-url') as string) ||
    'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com';

  // Get phone from request
  const phone = getPhoneFromRequest(request);

  // Public routes (auth pages) - allow access
  if (pathname.startsWith('/auth')) {
    return NextResponse.next();
  }

  // Protected routes - check authentication
  if (requiresAuth(pathname)) {
    // For static exports, middleware can't access localStorage
    // Allow request to proceed - client-side components will handle auth checks
    // If phone is available (from cookie/header), validate onboarding status
    if (phone) {
      // Get onboarding status
      const status = await getOnboardingStatus(phone, apiBaseUrl);

      // If status check failed, allow request to proceed
      // Component-level checks will handle validation
      if (!status) {
        console.warn('Could not determine onboarding status, allowing request');
        return NextResponse.next();
      }

      // Check if current route is allowed for this status
      const redirectRoute = getRedirectRoute(pathname, status);

      // If route needs to be changed, redirect
      if (redirectRoute !== pathname) {
        const redirectUrl = new URL(redirectRoute, request.url);
        // Preserve query parameters if needed
        request.nextUrl.searchParams.forEach((value, key) => {
          redirectUrl.searchParams.set(key, value);
        });
        return NextResponse.redirect(redirectUrl);
      }
    }
    
    // If no phone found, allow request to proceed anyway
    // Client-side component will check localStorage and redirect if needed
    // This works for static exports where server can't access localStorage
    return NextResponse.next();
  }

  // Allow request to proceed
  return NextResponse.next();
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)).*)',
  ],
};


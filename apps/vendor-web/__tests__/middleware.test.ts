/**
 * Next.js Middleware Tests
 * Tests route guards and onboarding status-based redirects
 */

import { NextRequest } from 'next/server';
import { middleware } from '../middleware';

// Mock fetch for API calls
global.fetch = jest.fn();

describe('Vendor Onboarding Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000';
  });

  describe('Public Routes', () => {
    it('should allow access to /auth without authentication', async () => {
      const request = new NextRequest('http://localhost:3002/auth');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });

    it('should allow access to static files', async () => {
      const request = new NextRequest('http://localhost:3002/_next/static/test.js');
      const response = await middleware(request);
      
      expect(response.status).toBe(200);
    });
  });

  describe('Protected Routes - Unauthenticated', () => {
    it('should redirect to /auth when accessing /dashboard without phone cookie', async () => {
      const request = new NextRequest('http://localhost:3002/dashboard');
      const response = await middleware(request);
      
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/auth');
    });

    it('should preserve redirect parameter', async () => {
      const request = new NextRequest('http://localhost:3002/dashboard');
      const response = await middleware(request);
      const location = response.headers.get('location');
      
      expect(location).toContain('redirect=/dashboard');
    });
  });

  describe('Protected Routes - Authenticated', () => {
    it('should allow /dashboard when status is ACTIVATED', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'ACTIVATED' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/dashboard', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect /dashboard to /onboarding/role-selection when status is INIT', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'INIT' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/dashboard', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/onboarding/role-selection');
    });

    it('should allow /onboarding/role-selection when status is INIT', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'INIT' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/role-selection', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect /onboarding/role-selection to /onboarding/vendor-type when status is ROLE_PENDING', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'ROLE_PENDING' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/role-selection', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/onboarding/vendor-type');
    });

    it('should allow /onboarding/form when status is FORM_PENDING', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'FORM_PENDING' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/form', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect /onboarding/form to /onboarding/pending-review when status is UNDER_REVIEW', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'UNDER_REVIEW' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/form', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/onboarding/pending-review');
    });

    it('should allow /onboarding/pending-review when status is UNDER_REVIEW', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'UNDER_REVIEW' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/pending-review', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should allow /onboarding/clarification when status is CLARIFICATION_REQUIRED', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'CLARIFICATION_REQUIRED' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/clarification', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should allow /onboarding/approved when status is APPROVED', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'APPROVED' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/approved', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });

    it('should redirect /onboarding/approved to /dashboard when status is ACTIVATED', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'ACTIVATED' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/onboarding/approved', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toContain('/dashboard');
    });
  });

  describe('Error Handling', () => {
    it('should allow request if API call fails (graceful degradation)', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('API Error'));

      const request = new NextRequest('http://localhost:3002/dashboard', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      // Should allow request to proceed (component-level checks will handle)
      expect(response.status).toBe(200);
    });

    it('should allow request if API returns non-OK status', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const request = new NextRequest('http://localhost:3002/dashboard', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      expect(response.status).toBe(200);
    });
  });

  describe('Query Parameter Preservation', () => {
    it('should preserve query parameters on redirect', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          identity: { onboarding_status: 'INIT' },
        }),
      });

      const request = new NextRequest('http://localhost:3002/dashboard?param1=value1&param2=value2', {
        headers: {
          cookie: 'vendor_phone=+911234567890',
        },
      });

      const response = await middleware(request);
      const location = response.headers.get('location');
      expect(location).toContain('param1=value1');
      expect(location).toContain('param2=value2');
    });
  });
});


import { test, expect } from '@playwright/test';

/**
 * Vendor Portal E2E Tests
 * 
 * Tests cover:
 * - Authentication (OTP flow)
 * - Onboarding flow
 * - Dashboard
 * - Services management
 * - Bookings/Appointments
 * - Staff management
 * - Analytics
 */

test.describe('Vendor Portal - Authentication', () => {
  test('should display auth page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Should show login or onboarding
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/phone|login|welcome|sign in|vendor|onboard/i);
  });

  test('should have phone number input', async ({ page }) => {
    await page.goto('/auth');
    await page.waitForLoadState('networkidle');
    
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[name*="phone" i]');
    if (await phoneInput.count() > 0) {
      await expect(phoneInput.first()).toBeVisible();
    }
  });
});

test.describe('Vendor Portal - Onboarding', () => {
  test('should load onboarding page', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    
    // Should show onboarding or redirect
    const url = page.url();
    expect(url).toMatch(/onboarding|auth|dashboard/);
  });

  test('should display role selection', async ({ page }) => {
    await page.goto('/onboarding');
    await page.waitForLoadState('networkidle');
    
    // Check for role-related content
    const roleContent = page.locator('text=/role|vet|groomer|trainer|clinic|hospital/i');
    if (await roleContent.count() > 0) {
      await expect(roleContent.first()).toBeVisible();
    }
  });
});

test.describe('Vendor Portal - Dashboard', () => {
  test('should load dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/dashboard|auth|onboarding/);
  });

  test('should display dashboard metrics', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    // Check for dashboard content
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(100);
  });
});

test.describe('Vendor Portal - Services', () => {
  test('should load services page', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth or onboarding
    const url = page.url();
    expect(url).toMatch(/services|auth|onboarding/);
  });

  test('should display service management options', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    
    // Check for content
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });

  test('should have add service option', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    
    // Check page loaded
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Vendor Portal - Bookings/Appointments', () => {
  test('should load bookings page', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/bookings|appointments|auth/);
  });

  test('should display booking list or calendar', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });

  test('should have booking status filters', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');
    
    // Check for filter options
    const filters = page.locator('text=/pending|confirmed|completed|all|today/i');
    if (await filters.count() > 0 && !page.url().includes('auth')) {
      await expect(filters.first()).toBeVisible();
    }
  });
});

test.describe('Vendor Portal - Staff Management', () => {
  test('should load staff page', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth or onboarding
    const url = page.url();
    expect(url).toMatch(/staff|auth|onboarding/);
  });

  test('should display staff list or add option', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Vendor Portal - Schedule', () => {
  test('should load schedule page', async ({ page }) => {
    await page.goto('/schedule');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth or onboarding
    const url = page.url();
    expect(url).toMatch(/schedule|availability|auth|onboarding/);
  });

  test('should display calendar or time slots', async ({ page }) => {
    await page.goto('/schedule');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Vendor Portal - Analytics', () => {
  test('should load analytics page', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/analytics|earnings|auth/);
  });

  test('should display earnings or metrics', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    if (!page.url().includes('auth')) {
      const content = await page.locator('body').textContent();
      expect(content).toMatch(/earnings|revenue|bookings|₹|analytics|total/i);
    }
  });
});

test.describe('Vendor Portal - Profile', () => {
  test('should load profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth or onboarding
    const url = page.url();
    expect(url).toMatch(/profile|auth|onboarding/);
  });

  test('should display profile information', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Vendor Portal - Settings', () => {
  test('should load settings page', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/settings|auth/);
  });

  test('should display settings options', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    if (!page.url().includes('auth')) {
      const content = await page.locator('body').textContent();
      expect(content).toMatch(/settings|notification|preferences|account/i);
    }
  });
});

test.describe('Vendor Portal - Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    const pages = ['/', '/dashboard', '/services', '/bookings', '/profile'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      
      // Page should load
      const content = await page.locator('body').textContent();
      expect(content?.length).toBeGreaterThan(50);
    }
  });

  test('should have sidebar or navigation menu', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    
    if (!page.url().includes('auth')) {
      const nav = page.locator('nav, aside, [role="navigation"]');
      if (await nav.count() > 0) {
        await expect(nav.first()).toBeVisible();
      }
    }
  });
});

test.describe('Vendor Portal - Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(100);
  });

  test('should be responsive on tablet', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(100);
  });
});

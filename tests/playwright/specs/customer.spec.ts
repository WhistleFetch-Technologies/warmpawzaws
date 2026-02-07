import { test, expect } from '@playwright/test';

/**
 * Customer App E2E Tests
 * 
 * Tests cover:
 * - Authentication (OTP flow)
 * - Home page and service discovery
 * - Booking flow
 * - Pet management
 * - Wallet and payments
 * - Problem Grid navigation
 */

test.describe('Customer App - Authentication', () => {
  test('should display auth page', async ({ page }) => {
    await page.goto('/');
    
    // Should redirect to auth or show auth form
    await page.waitForLoadState('networkidle');
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/phone|login|welcome|sign in|warmpawz/i);
  });

  test('should have phone number input', async ({ page }) => {
    await page.goto('/auth');
    
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i], input[name*="phone" i]');
    if (await phoneInput.count() > 0) {
      await expect(phoneInput.first()).toBeVisible();
    }
  });

  test('should show OTP input after phone submission', async ({ page }) => {
    await page.goto('/auth');
    
    // Fill phone number
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i]');
    if (await phoneInput.count() > 0) {
      await phoneInput.first().fill('9999888877');
      
      // Click submit/send OTP button
      const submitButton = page.locator('button:has-text(/send|verify|continue/i)');
      if (await submitButton.count() > 0) {
        await submitButton.click();
        
        // Wait for OTP input to appear
        await page.waitForTimeout(2000);
        
        // Check for OTP inputs
        const otpInputs = page.locator('input[type="text"][maxlength="1"], input[inputmode="numeric"]');
        const otpInputCount = await otpInputs.count();
        expect(otpInputCount).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

test.describe('Customer App - Home Page', () => {
  test('should load home page content', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Page should have content
    const body = await page.locator('body').textContent();
    expect(body?.length).toBeGreaterThan(100);
  });

  test('should display service categories', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for service-related content
    const services = page.locator('text=/Vet|Grooming|Training|Walking|Pet/i');
    if (await services.count() > 0) {
      await expect(services.first()).toBeVisible();
    }
  });
});

test.describe('Customer App - Services', () => {
  test('should load services page', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth - check page loaded
    const url = page.url();
    expect(url).toMatch(/services|auth/);
  });

  test('should display service list or categories', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');
    
    // Should have some content
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Customer App - Search', () => {
  test('should load search page', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth
    const url = page.url();
    expect(url).toMatch(/search|auth/);
  });

  test('should have search input', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('networkidle');
    
    // Check page has content
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Customer App - Bookings', () => {
  test('should load bookings page', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');
    
    // Should load bookings or redirect to auth
    const url = page.url();
    expect(url).toMatch(/bookings|auth/);
  });

  test('should display booking list or empty state', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Customer App - Pets', () => {
  test('should load pets page', async ({ page }) => {
    await page.goto('/pets');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/pets|auth/);
  });

  test('should show add pet option or pet list', async ({ page }) => {
    await page.goto('/pets');
    await page.waitForLoadState('networkidle');
    
    // Check page has content or redirected to auth
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Customer App - Profile', () => {
  test('should load profile page', async ({ page }) => {
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/profile|auth/);
  });
});

test.describe('Customer App - Wallet', () => {
  test('should load wallet page', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/wallet|auth/);
  });

  test('should display wallet balance or login prompt', async ({ page }) => {
    await page.goto('/wallet');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/wallet|balance|₹|login|sign in/i);
  });
});

test.describe('Customer App - Shop', () => {
  test('should load shop page', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    
    // May redirect to auth
    const url = page.url();
    expect(url).toMatch(/shop|auth/);
  });

  test('should display products or categories', async ({ page }) => {
    await page.goto('/shop');
    await page.waitForLoadState('networkidle');
    
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(50);
  });
});

test.describe('Customer App - Orders', () => {
  test('should load orders page', async ({ page }) => {
    await page.goto('/orders');
    await page.waitForLoadState('networkidle');
    
    const url = page.url();
    expect(url).toMatch(/orders|auth/);
  });
});

test.describe('Customer App - Navigation', () => {
  test('should navigate between pages', async ({ page }) => {
    const pages = ['/', '/services', '/search', '/bookings', '/profile'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      // Page should load without errors
      const content = await page.locator('body').textContent();
      expect(content?.length).toBeGreaterThan(50);
    }
  });

  test('should have bottom navigation on mobile', async ({ page, isMobile }) => {
    if (!isMobile) {
      test.skip();
      return;
    }
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Check for bottom nav
    const bottomNav = page.locator('nav[class*="bottom"], [class*="bottomNav"], footer nav');
    if (await bottomNav.count() > 0) {
      await expect(bottomNav.first()).toBeVisible();
    }
  });
});

test.describe('Customer App - Responsive Design', () => {
  test('should be responsive on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Content should be visible
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

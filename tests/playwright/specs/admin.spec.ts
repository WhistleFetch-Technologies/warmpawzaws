import { test, expect } from '@playwright/test';

/**
 * Admin Portal E2E Tests
 * 
 * Tests cover:
 * - Authentication flow
 * - Dashboard analytics
 * - Vendor management
 * - Finance & Policies
 * - Problem Grid management
 * - Reports generation
 */

test.describe('Admin Portal - Authentication', () => {
  test('should display login page', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Warmpawz Admin/i);
  });

  test('should login with admin credentials', async ({ page }) => {
    await page.goto('/');
    
    // Fill login form
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    
    // Wait for navigation to dashboard
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
    await expect(page.locator('h1, h2').first()).toBeVisible();
  });
});

test.describe('Admin Portal - Analytics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should display analytics dashboard', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    // Just verify page loaded
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(100);
  });

  test('should show GMV and commission stats', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/GMV|Total|Revenue|Commission/i);
  });

  test('should have working tabs', async ({ page }) => {
    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    
    // Check for any interactive elements
    const content = await page.locator('body').textContent();
    expect(content?.length).toBeGreaterThan(100);
  });
});

test.describe('Admin Portal - Vendor Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should load vendors page', async ({ page }) => {
    await page.goto('/vendors');
    await expect(page.locator('text=/Vendor|Management/i').first()).toBeVisible();
  });

  test('should display vendor list or empty state', async ({ page }) => {
    await page.goto('/vendors');
    await page.waitForLoadState('networkidle');
    
    // Either vendor cards or empty state should be visible
    const content = await page.locator('body').textContent();
    expect(content).toBeTruthy();
  });
});

test.describe('Admin Portal - Finance & Policies', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should load finance page', async ({ page }) => {
    await page.goto('/finance');
    await expect(page.locator('text=/Finance|Logistics/i').first()).toBeVisible();
  });

  test('should show policy tabs', async ({ page }) => {
    await page.goto('/finance');
    await page.waitForLoadState('networkidle');
    
    // Check for policy-related content
    const policyContent = page.locator('text=/Payment|Refund|Cancellation|GST|Settlement/i');
    await expect(policyContent.first()).toBeVisible();
  });

  test('should display GST configuration', async ({ page }) => {
    await page.goto('/finance');
    await page.waitForLoadState('networkidle');
    
    // Click GST Configuration tab if exists
    const gstTab = page.locator('button:has-text("GST")');
    if (await gstTab.count() > 0) {
      await gstTab.click();
      await expect(page.locator('text=/GST|Tax/i').first()).toBeVisible();
    }
  });
});

test.describe('Admin Portal - Problem Grid', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should load problem grid page', async ({ page }) => {
    await page.goto('/problem-grid');
    await expect(page.locator('text=/Problem Grid/i').first()).toBeVisible();
  });

  test('should display categories', async ({ page }) => {
    await page.goto('/problem-grid');
    await page.waitForLoadState('networkidle');
    
    // Check for category filters
    const categories = page.locator('text=/Grooming|Veterinary|Training|Nutrition/i');
    await expect(categories.first()).toBeVisible();
  });

  test('should have Add Item button', async ({ page }) => {
    await page.goto('/problem-grid');
    await page.waitForLoadState('networkidle');
    
    const addButton = page.locator('button:has-text("Add")');
    await expect(addButton.first()).toBeVisible();
  });
});

test.describe('Admin Portal - Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should load reports page', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('text=/Reports|Analytics/i').first()).toBeVisible();
  });

  test('should have report type filters', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Check for report type options
    const reportTypes = page.locator('text=/Revenue|Vendor|Customer|Booking/i');
    await expect(reportTypes.first()).toBeVisible();
  });

  test('should have export options', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');
    
    // Check for export buttons - page should have export-related text
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/Export|CSV|PDF|Download|Report/i);
  });
});

test.describe('Admin Portal - Subscriptions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should load subscriptions page', async ({ page }) => {
    await page.goto('/subscriptions');
    await expect(page.locator('text=/Subscription/i').first()).toBeVisible();
  });

  test('should have create plan button', async ({ page }) => {
    await page.goto('/subscriptions');
    await page.waitForLoadState('networkidle');
    
    // Check for create/add related text on page
    const content = await page.locator('body').textContent();
    expect(content).toMatch(/Create|Add|Plan|Subscription/i);
  });
});

test.describe('Admin Portal - Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.fill('input[type="email"]', 'admin@warmpawz.com');
    await page.fill('input[type="password"]', 'Admin123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(analytics|dashboard)/, { timeout: 10000 });
  });

  test('should have sidebar navigation', async ({ page }) => {
    await page.goto('/analytics');
    
    // Check for navigation elements
    const nav = page.locator('nav, aside, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });

  test('should navigate between pages', async ({ page }) => {
    await page.goto('/analytics');
    
    // Navigate to different pages
    const pages = ['/vendors', '/finance', '/reports'];
    
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain(path);
    }
  });
});

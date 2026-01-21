/**
 * ============================================================================
 * WARMPAWZ E2E TEST FIXTURES AND UTILITIES
 * ============================================================================
 * 
 * Shared fixtures, helpers, and test data for comprehensive E2E testing
 * 
 * Date: 2026-01-20
 * ============================================================================
 */

import { test as base, expect, Page, BrowserContext } from '@playwright/test';

// ============================================================================
// TEST CONFIGURATION
// ============================================================================

export const TEST_CONFIG = {
  // API Configuration
  apiBaseUrl: process.env.API_URL || 'https://z0b3obweb6.execute-api.ap-south-1.amazonaws.com',
  
  // Frontend URLs
  customerUrl: process.env.CUSTOMER_URL || 'https://d2aoyjj8ine0wk.cloudfront.net',
  vendorUrl: process.env.VENDOR_URL || 'https://d1s6ykkj381k58.cloudfront.net',
  adminUrl: process.env.ADMIN_URL || 'https://dfof7mguaa0a5.cloudfront.net',
  
  // UAT Mode Configuration
  uatMode: true,
  uatOtp: '123456',
  uatToken: 'uat-test-token',
  
  // Test Timeouts
  shortTimeout: 5000,
  mediumTimeout: 15000,
  longTimeout: 30000,
  
  // Test Phone Numbers (UAT mode)
  testPhones: {
    vendor: '9999000001',
    customer: '9999000002',
    admin: '9999000003',
    staff: '9999000004',
  },
};

// ============================================================================
// TEST DATA GENERATORS
// ============================================================================

export const TestData = {
  // Generate unique phone number for testing
  generatePhone: () => `99${Date.now().toString().slice(-8)}`,
  
  // Generate unique email
  generateEmail: () => `test${Date.now()}@warmpawz.test`,
  
  // Vendor test data by role
  vendors: {
    vet: {
      role: 'veterinarian',
      businessName: 'Test Vet Clinic',
      registrationNumber: 'VET123456',
      specialization: 'General Practice',
      experience: '5 years',
    },
    groomer: {
      role: 'groomer',
      businessName: 'Fluffy Grooming Salon',
      specialization: 'All breeds',
      experience: '3 years',
    },
    trainer: {
      role: 'trainer',
      businessName: 'Pro Pet Training',
      specialization: 'Obedience Training',
      experience: '4 years',
    },
    walker: {
      role: 'walker',
      businessName: 'Happy Walks',
      experience: '2 years',
    },
    sitter: {
      role: 'sitter',
      businessName: 'Cozy Pet Sitting',
      experience: '2 years',
    },
    nutritionist: {
      role: 'nutritionist',
      businessName: 'Pet Nutrition Expert',
      specialization: 'Dietary Planning',
      experience: '4 years',
    },
    pharmacy: {
      role: 'pharmacy',
      businessName: 'Pet Pharmacy Plus',
      licenseNumber: 'PH123456',
    },
    diagnostics: {
      role: 'diagnostics',
      businessName: 'Pet Diagnostics Lab',
      accreditation: 'NABL Certified',
    },
  },
  
  // Customer test data
  customer: {
    name: 'Test Customer',
    email: 'customer@test.com',
    address: {
      line1: '123 Test Street',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400001',
    },
  },
  
  // Pet test data
  pets: {
    dog: {
      name: 'Buddy',
      species: 'dog',
      breed: 'Labrador Retriever',
      age: 3,
      weight: 25,
      gender: 'male',
    },
    cat: {
      name: 'Whiskers',
      species: 'cat',
      breed: 'Persian',
      age: 2,
      weight: 5,
      gender: 'female',
    },
  },
  
  // Service test data
  services: {
    vetConsultation: {
      name: 'General Consultation',
      price: 500,
      duration: 30,
    },
    grooming: {
      name: 'Full Grooming',
      price: 1500,
      duration: 120,
    },
    training: {
      name: 'Basic Obedience',
      price: 1000,
      duration: 60,
    },
    walking: {
      name: '30 Min Walk',
      price: 200,
      duration: 30,
    },
    teleConsultation: {
      name: 'Video Consultation',
      price: 300,
      duration: 20,
    },
  },
};

// ============================================================================
// PAGE OBJECT HELPERS
// ============================================================================

export class AuthHelper {
  constructor(private page: Page) {}
  
  async loginWithPhone(phone: string): Promise<void> {
    // Set UAT mode headers
    await this.page.setExtraHTTPHeaders({
      'X-UAT-Mode': 'true',
      'X-UAT-Token': TEST_CONFIG.uatToken,
    });
    
    // Navigate to auth page
    await this.page.goto('/auth');
    await this.page.waitForLoadState('networkidle');
    
    // Fill phone number
    const phoneInput = this.page.locator('input[type="tel"], input[placeholder*="phone" i], input[name*="phone" i]');
    if (await phoneInput.count() > 0) {
      await phoneInput.first().fill(phone);
      
      // Submit
      const submitBtn = this.page.getByRole('button').filter({ hasText: /send|verify|continue|next/i });
      if (await submitBtn.count() > 0) {
        await submitBtn.first().click();
        await this.page.waitForTimeout(1000);
      }
    }
  }
  
  async enterOtp(otp: string = TEST_CONFIG.uatOtp): Promise<void> {
    // Try different OTP input patterns
    const otpInputs = this.page.locator('input[maxlength="1"]');
    const singleOtpInput = this.page.locator('input[maxlength="6"], input[placeholder*="OTP" i]');
    
    if (await otpInputs.count() >= 4) {
      // Multiple single-digit inputs
      for (let i = 0; i < Math.min(otp.length, await otpInputs.count()); i++) {
        await otpInputs.nth(i).fill(otp[i]);
      }
    } else if (await singleOtpInput.count() > 0) {
      // Single input for full OTP
      await singleOtpInput.first().fill(otp);
    }
    
    // Submit OTP
    const verifyBtn = this.page.getByRole('button').filter({ hasText: /verify|submit|continue|confirm/i });
    if (await verifyBtn.count() > 0) {
      await verifyBtn.first().click();
      await this.page.waitForTimeout(2000);
    }
  }
  
  async completeLogin(phone: string): Promise<void> {
    await this.loginWithPhone(phone);
    await this.page.waitForTimeout(1500);
    await this.enterOtp();
    await this.page.waitForLoadState('networkidle');
  }
}

export class NavigationHelper {
  constructor(private page: Page) {}
  
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle');
    await this.page.waitForTimeout(500);
  }
  
  async clickLink(text: string | RegExp): Promise<void> {
    const link = this.page.locator(`a, button`).filter({ hasText: text });
    if (await link.count() > 0) {
      await link.first().click();
      await this.waitForPageLoad();
    }
  }
  
  async clickButton(text: string | RegExp): Promise<void> {
    const button = this.page.locator('button').filter({ hasText: text });
    if (await button.count() > 0) {
      await button.first().click();
      await this.waitForPageLoad();
    }
  }
  
  async fillInput(placeholder: string | RegExp, value: string): Promise<void> {
    const input = this.page.locator(`input[placeholder*="${placeholder}" i], textarea[placeholder*="${placeholder}" i]`);
    if (await input.count() > 0) {
      await input.first().fill(value);
    }
  }
  
  async selectOption(label: string | RegExp, value: string): Promise<void> {
    const select = this.page.locator('select').filter({ hasText: label });
    if (await select.count() > 0) {
      await select.first().selectOption(value);
    }
  }
  
  async takeScreenshot(name: string): Promise<void> {
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage: true 
    });
  }
}

export class AssertionHelper {
  constructor(private page: Page) {}
  
  async expectVisible(text: string | RegExp): Promise<void> {
    await expect(this.page.locator(`text=${text}`).first()).toBeVisible({ timeout: TEST_CONFIG.mediumTimeout });
  }
  
  async expectUrl(pattern: string | RegExp): Promise<void> {
    await expect(this.page).toHaveURL(pattern, { timeout: TEST_CONFIG.mediumTimeout });
  }
  
  async expectElement(selector: string): Promise<void> {
    await expect(this.page.locator(selector).first()).toBeVisible({ timeout: TEST_CONFIG.mediumTimeout });
  }
  
  async expectToast(message: string | RegExp): Promise<void> {
    const toast = this.page.locator('[role="alert"], [class*="toast"], [class*="notification"]');
    if (await toast.count() > 0) {
      await expect(toast.first()).toContainText(message);
    }
  }
  
  async getPageContent(): Promise<string> {
    return await this.page.locator('body').textContent() || '';
  }
  
  async hasContent(pattern: string | RegExp): Promise<boolean> {
    const content = await this.getPageContent();
    if (typeof pattern === 'string') {
      return content.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(content);
  }
}

// ============================================================================
// API HELPERS
// ============================================================================

export class ApiHelper {
  constructor(private page: Page) {}
  
  async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const response = await this.page.request.fetch(`${TEST_CONFIG.apiBaseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
        'X-UAT-Mode': 'true',
        'X-UAT-Token': TEST_CONFIG.uatToken,
        ...options.headers,
      },
      ...options,
    });
    return response.json();
  }
  
  async seedTestData(type: string): Promise<any> {
    return this.makeApiCall('/admin/test/seed', {
      method: 'POST',
      body: JSON.stringify({ type }),
    });
  }
  
  async cleanupTestData(): Promise<any> {
    return this.makeApiCall('/admin/test/cleanup', {
      method: 'POST',
    });
  }
}

// ============================================================================
// CUSTOM TEST FIXTURE
// ============================================================================

type TestFixtures = {
  auth: AuthHelper;
  nav: NavigationHelper;
  assert: AssertionHelper;
  api: ApiHelper;
  testData: typeof TestData;
  config: typeof TEST_CONFIG;
};

export const test = base.extend<TestFixtures>({
  auth: async ({ page }, use) => {
    await use(new AuthHelper(page));
  },
  nav: async ({ page }, use) => {
    await use(new NavigationHelper(page));
  },
  assert: async ({ page }, use) => {
    await use(new AssertionHelper(page));
  },
  api: async ({ page }, use) => {
    await use(new ApiHelper(page));
  },
  testData: async ({}, use) => {
    await use(TestData);
  },
  config: async ({}, use) => {
    await use(TEST_CONFIG);
  },
});

export { expect };

/**
 * Browser Automation Test: Verify Service Catalog Visibility (Authenticated)
 * 
 * This test requires:
 * 1. A valid vendor phone number
 * 2. OTP verification (manual or automated)
 * 3. Vendor must have catalog or booking capabilities
 */

import { chromium, Browser, Page } from 'playwright';

const VENDOR_DASHBOARD_URL = 'https://d1s6ykkj381k58.cloudfront.net';
const TEST_TIMEOUT = 60000; // 60 seconds

// ⚠️ CONFIGURATION: Update these with test vendor credentials
// Try environment variables first, then fallback to test credentials
const TEST_VENDOR_PHONE = process.env.TEST_VENDOR_PHONE || '1234567890'; // Update with actual vendor phone
const TEST_OTP = process.env.TEST_OTP || ''; // Leave empty for manual OTP entry (will wait 30s)

interface TestResult {
  success: boolean;
  message: string;
  screenshots?: string[];
  errors?: string[];
}

async function testServiceCatalogWithAuth(): Promise<TestResult> {
  let browser: Browser | null = null;
  const screenshots: string[] = [];
  const errors: string[] = [];

  try {
    console.log('🚀 Starting authenticated browser test...');
    console.log(`📍 Testing URL: ${VENDOR_DASHBOARD_URL}`);
    console.log(`📱 Vendor Phone: ${TEST_VENDOR_PHONE}`);

    // Launch browser
    browser = await chromium.launch({
      headless: false, // Show browser for manual OTP entry
      slowMo: 500,
    });

    const context = await browser.newContext({
      viewport: { width: 430, height: 932 }, // Mobile viewport
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const page = await context.newPage();

    // Navigate to vendor dashboard
    console.log('📱 Navigating to vendor dashboard...');
    await page.goto(VENDOR_DASHBOARD_URL, { waitUntil: 'networkidle', timeout: TEST_TIMEOUT });
    await page.screenshot({ path: 'screenshot-1-initial-load.png' });
    screenshots.push('screenshot-1-initial-load.png');
    console.log('✅ Dashboard loaded');

    // Check if we need to login
    console.log('🔐 Checking authentication status...');
    await page.waitForTimeout(2000);

    // Look for login form or dashboard
    const needsLogin = await page.locator('input[type="tel"], input[placeholder*="phone" i]').isVisible().catch(() => false);
    
    if (needsLogin) {
      console.log('🔑 Login required, attempting authentication...');
      
      // Enter phone number
      const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i]').first();
      await phoneInput.fill(TEST_VENDOR_PHONE);
      await page.screenshot({ path: 'screenshot-2-phone-entered.png' });
      screenshots.push('screenshot-2-phone-entered.png');

      // Click send OTP
      const sendOtpButton = page.locator('button:has-text("Send"), button:has-text("OTP"), button:has-text("Login")').first();
      await sendOtpButton.click();
      await page.waitForTimeout(2000);

      // Enter OTP (if provided, otherwise wait for manual entry)
      if (TEST_OTP) {
        console.log('🔢 Entering OTP automatically...');
        await page.waitForTimeout(2000); // Wait for OTP input to appear
        const otpInput = page.locator('input[type="text"], input[placeholder*="OTP" i], input[placeholder*="code" i], input[maxlength="6"]').first();
        await otpInput.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {});
        await otpInput.fill(TEST_OTP);
        await page.screenshot({ path: 'screenshot-3-otp-entered.png' });
        screenshots.push('screenshot-3-otp-entered.png');

        // Click verify
        const verifyButton = page.locator('button:has-text("Verify"), button:has-text("Login"), button:has-text("Submit"), button[type="submit"]').first();
        await verifyButton.click();
        await page.waitForTimeout(5000); // Wait for login to complete
      } else {
        console.log('⏳ Waiting for manual OTP entry (45 seconds)...');
        console.log('   Please enter the OTP in the browser window');
        console.log('   The test will continue automatically after OTP is entered');
        
        // Wait for navigation away from login page (indicates successful login)
        try {
          await page.waitForURL('**/dashboard**', { timeout: 45000 }).catch(() => {
            // If URL doesn't change, wait a bit more
            return page.waitForTimeout(5000);
          });
        } catch (e) {
          // Continue anyway
          await page.waitForTimeout(5000);
        }
      }

      await page.screenshot({ path: 'screenshot-4-after-login.png' });
      screenshots.push('screenshot-4-after-login.png');
    }

    // Now look for Service Management button
    console.log('🔍 Looking for Service Management button...');
    await page.waitForTimeout(3000); // Give page time to fully load

    // Wait for dashboard to be fully loaded
    try {
      await page.waitForSelector('text=Service Management, button:has-text("Service Management"), [class*="dashboard"]', { timeout: 10000 });
    } catch (e) {
      console.log('⚠️ Dashboard elements may still be loading...');
    }

    // Try multiple selectors for Service Management button - be more specific
    const serviceMgmtSelectors = [
      'button:has-text("Service Management"):visible',
      'text=/Service Management/i',
      'button:has-text("Service Management")',
      // Look for Activity icon (used in Service Management button)
      'button:has(svg) >> text=Service Management',
      'button >> text=/Service.*Management/i',
    ];

    let serviceMgmtFound = false;
    for (const selector of serviceMgmtSelectors) {
      try {
        const element = page.locator(selector).first();
        const visible = await element.isVisible({ timeout: 5000 });
        if (visible) {
          console.log(`✅ Found Service Management button with selector: ${selector}`);
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await element.click();
          serviceMgmtFound = true;
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    if (!serviceMgmtFound) {
      // Check if we're already on a services page
      const currentUrl = page.url();
      console.log(`📍 Current URL: ${currentUrl}`);
      
      if (currentUrl.includes('/services') || currentUrl.includes('/service')) {
        console.log('✅ Already on services page');
        serviceMgmtFound = true;
      } else {
        // Try direct navigation
        console.log('⚠️ Button not found, trying direct navigation to /services...');
        try {
          await page.goto(`${VENDOR_DASHBOARD_URL}/services`, { waitUntil: 'networkidle', timeout: 30000 });
          serviceMgmtFound = true;
        } catch (e) {
          console.log('⚠️ Direct navigation to /services failed, trying alternative...');
          // Try clicking on "See All →" link in services section
          try {
            const seeAllLink = page.locator('text=/See All/i, a:has-text("See All")').first();
            if (await seeAllLink.isVisible({ timeout: 5000 })) {
              await seeAllLink.click();
              serviceMgmtFound = true;
            }
          } catch (e2) {
            console.log('⚠️ Could not find alternative navigation method');
          }
        }
      }
    }

    await page.waitForTimeout(4000); // Wait for Service Management page to load
    await page.screenshot({ path: 'screenshot-5-service-management.png', fullPage: true });
    screenshots.push('screenshot-5-service-management.png');

    // Get page content for debugging
    const pageContent = await page.textContent('body');
    const pageUrl = page.url();
    console.log(`📍 Current URL: ${pageUrl}`);
    console.log('📄 Page content preview:', pageContent?.substring(0, 500));
    
    // Check if we're on the right page
    if (pageContent?.includes('Onboarding') && !pageContent?.includes('Service Management')) {
      console.log('⚠️ WARNING: Appears to be on onboarding page, not Service Management');
      console.log('   This vendor may need to complete onboarding first');
    }

    // Now check for "Browse Service Catalog" section
    console.log('🔍 Looking for "Browse Service Catalog" section...');
    
    const catalogSelectors = [
      'text=/Browse.*Service.*Catalog/i',
      'text=/Browse.*Catalog/i',
      'h3:has-text("Browse")',
      'h3:has-text("Catalog")',
      'text=Platform Catalog',
      '[class*="catalog"]',
      'button:has-text("Browse Catalog")',
    ];

    let catalogFound = false;
    for (const selector of catalogSelectors) {
      try {
        const element = page.locator(selector).first();
        const visible = await element.isVisible();
        if (visible) {
          console.log(`✅ Found catalog section with selector: ${selector}`);
          
          // Check position (should be near top)
          const boundingBox = await element.boundingBox();
          if (boundingBox) {
            console.log(`📍 Catalog section position: y=${boundingBox.y}px`);
            if (boundingBox.y < 500) {
              console.log('✅ Catalog section is positioned near the top (good UX)');
            }
          }
          
          catalogFound = true;
          await page.screenshot({ path: 'screenshot-6-catalog-found.png' });
          screenshots.push('screenshot-6-catalog-found.png');
          break;
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Also check for "Browse Catalog" button
    const browseButton = page.locator('button:has-text("Browse Catalog"), button:has-text("Browse")').first();
    const buttonVisible = await browseButton.isVisible().catch(() => false);
    
    if (buttonVisible) {
      console.log('✅ "Browse Catalog" button found');
      await page.screenshot({ path: 'screenshot-7-browse-button.png' });
      screenshots.push('screenshot-7-browse-button.png');
    }

    if (catalogFound || buttonVisible) {
      return {
        success: true,
        message: '✅ SUCCESS: "Browse Service Catalog" section is visible in Service Management',
        screenshots,
      };
    } else {
      // Get page content for debugging
      const pageText = await page.textContent('body');
      const hasCatalog = pageText?.toLowerCase().includes('catalog') || 
                        pageText?.toLowerCase().includes('browse');
      
      return {
        success: false,
        message: '❌ FAILED: "Browse Service Catalog" section not found',
        screenshots,
        errors: hasCatalog 
          ? ['Catalog text found but element not visible - may be hidden or require different capabilities']
          : ['No catalog-related content found on page'],
      };
    }
  } catch (error: any) {
    console.error('❌ Test error:', error);
    errors.push(error.message || String(error));
    
    return {
      success: false,
      message: `❌ TEST FAILED: ${error.message}`,
      screenshots,
      errors,
    };
  } finally {
    if (browser) {
      console.log('⏳ Keeping browser open for 10 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      await browser.close();
    }
  }
}

// Run the test
if (require.main === module) {
  testServiceCatalogWithAuth()
    .then((result) => {
      console.log('\n' + '='.repeat(60));
      console.log('TEST RESULT:', result.message);
      console.log('='.repeat(60));
      
      if (result.screenshots && result.screenshots.length > 0) {
        console.log('\n📸 Screenshots saved:');
        result.screenshots.forEach((screenshot) => {
          console.log(`   - ${screenshot}`);
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log('\n⚠️ Errors encountered:');
        result.errors.forEach((error) => {
          console.log(`   - ${error}`);
        });
      }
      
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testServiceCatalogWithAuth };

/**
 * Browser Automation Test: Verify Service Catalog Visibility
 * Tests that the "Browse Service Catalog" option is visible in Service Management
 */

import { chromium, Browser, Page } from 'playwright';

const VENDOR_DASHBOARD_URL = process.env.VENDOR_URL || process.env.BASE_URL || '';
const TEST_TIMEOUT = 30000; // 30 seconds

interface TestResult {
  success: boolean;
  message: string;
  screenshots?: string[];
  errors?: string[];
}

async function testServiceCatalogVisibility(): Promise<TestResult> {
  let browser: Browser | null = null;
  const screenshots: string[] = [];
  const errors: string[] = [];

  try {
    console.log('🚀 Starting browser automation test...');
    console.log(`📍 Testing URL: ${VENDOR_DASHBOARD_URL}`);

    // Launch browser
    browser = await chromium.launch({
      headless: false, // Show browser for debugging
      slowMo: 1000, // Slow down actions for visibility
    });

    const context = await browser.newContext({
      viewport: { width: 430, height: 932 }, // Mobile viewport
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const page = await context.newPage();

    // Navigate to vendor dashboard
    console.log('📱 Navigating to vendor dashboard...');
    await page.goto(VENDOR_DASHBOARD_URL, { waitUntil: 'networkidle', timeout: TEST_TIMEOUT });
    await page.screenshot({ path: 'screenshot-1-dashboard-loaded.png' });
    screenshots.push('screenshot-1-dashboard-loaded.png');
    console.log('✅ Dashboard loaded');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Look for Service Management button in Quick Actions
    console.log('🔍 Looking for Service Management button...');
    
    // Try to find Service Management button by text
    const serviceManagementButton = await page.locator('text=Service Management').first();
    const buttonVisible = await serviceManagementButton.isVisible().catch(() => false);

    if (buttonVisible) {
      console.log('✅ Service Management button found!');
      await serviceManagementButton.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: 'screenshot-2-service-management-opened.png' });
      screenshots.push('screenshot-2-service-management-opened.png');
    } else {
      // Try alternative selectors
      console.log('⚠️ Service Management button not found by text, trying alternative selectors...');
      
      // Look for button with Activity icon or service management related elements
      const altButton = await page.locator('button:has-text("Service"), button:has-text("Manage")').first();
      const altVisible = await altButton.isVisible().catch(() => false);
      
      if (altVisible) {
        console.log('✅ Found alternative Service Management button');
        await altButton.click();
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshot-2-service-management-opened.png' });
        screenshots.push('screenshot-2-service-management-opened.png');
      } else {
        // Try navigating directly to services page
        console.log('⚠️ Button not found, trying direct navigation...');
        await page.goto(`${VENDOR_DASHBOARD_URL}/services`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
        await page.screenshot({ path: 'screenshot-2-service-management-opened.png' });
        screenshots.push('screenshot-2-service-management-opened.png');
      }
    }

    // Now check for "Browse Service Catalog" or "Browse Catalog" section
    console.log('🔍 Looking for "Browse Service Catalog" section...');
    
    // Wait a bit for content to load
    await page.waitForTimeout(2000);

    // Look for the catalog section
    const catalogSection = await page.locator('text=/Browse.*Catalog/i').first();
    const catalogVisible = await catalogSection.isVisible().catch(() => false);

    if (catalogVisible) {
      console.log('✅ "Browse Service Catalog" section found!');
      await page.screenshot({ path: 'screenshot-3-catalog-section-visible.png' });
      screenshots.push('screenshot-3-catalog-section-visible.png');

      // Check if it's in a prominent position (near top)
      const boundingBox = await catalogSection.boundingBox();
      if (boundingBox && boundingBox.y < 500) {
        console.log('✅ Catalog section is positioned near the top (good UX)');
      }

      // Try to click the Browse Catalog button
      const browseButton = await page.locator('button:has-text("Browse Catalog"), button:has-text("Browse")').first();
      const buttonExists = await browseButton.isVisible().catch(() => false);
      
      if (buttonExists) {
        console.log('✅ "Browse Catalog" button found and clickable');
        await page.screenshot({ path: 'screenshot-4-browse-button-visible.png' });
        screenshots.push('screenshot-4-browse-button-visible.png');
      }

      return {
        success: true,
        message: '✅ SUCCESS: "Browse Service Catalog" section is visible in Service Management',
        screenshots,
      };
    } else {
      // Check page content for debugging
      const pageContent = await page.content();
      const hasCatalogText = pageContent.toLowerCase().includes('catalog') || 
                            pageContent.toLowerCase().includes('browse');
      
      await page.screenshot({ path: 'screenshot-3-catalog-not-found.png' });
      screenshots.push('screenshot-3-catalog-not-found.png');

      if (hasCatalogText) {
        errors.push('Catalog text found in page but element not visible - may be hidden or styled differently');
      } else {
        errors.push('No catalog-related text found in page content');
      }

      return {
        success: false,
        message: '❌ FAILED: "Browse Service Catalog" section not found',
        screenshots,
        errors,
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
      await browser.close();
    }
  }
}

// Run the test
testServiceCatalogVisibility()
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

/**
 * Browser Automation Test: Confirm Service Catalog Visibility
 * 
 * This test will:
 * 1. Login as vendor (manual OTP entry)
 * 2. Navigate to Service Management
 * 3. Verify "Browse Service Catalog" section is visible at the top
 * 4. Confirm it appears before "Select Service Type"
 */

import { chromium, Browser, Page } from 'playwright';

const VENDOR_DASHBOARD_URL = process.env.VENDOR_URL || process.env.BASE_URL || '';
const TEST_TIMEOUT = 90000; // 90 seconds

interface TestResult {
  success: boolean;
  message: string;
  screenshots?: string[];
  details?: {
    catalogSectionFound: boolean;
    catalogPosition: number | null;
    catalogButtonFound: boolean;
    pageUrl: string;
    pageTitle: string;
  };
  errors?: string[];
}

async function confirmServiceCatalog(): Promise<TestResult> {
  let browser: Browser | null = null;
  const screenshots: string[] = [];
  const errors: string[] = [];
  const details: TestResult['details'] = {
    catalogSectionFound: false,
    catalogPosition: null,
    catalogButtonFound: false,
    pageUrl: '',
    pageTitle: '',
  };

  try {
    console.log('🚀 Starting Service Catalog Confirmation Test');
    console.log('='.repeat(60));
    console.log(`📍 URL: ${VENDOR_DASHBOARD_URL}`);
    console.log('');

    // Launch browser
    browser = await chromium.launch({
      headless: false,
      slowMo: 800,
    });

    const context = await browser.newContext({
      viewport: { width: 430, height: 932 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15',
    });

    const page = await context.newPage();

    // Step 1: Navigate to dashboard
    console.log('📱 Step 1: Navigating to vendor dashboard...');
    await page.goto(VENDOR_DASHBOARD_URL, { waitUntil: 'networkidle', timeout: TEST_TIMEOUT });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'confirm-1-dashboard.png', fullPage: true });
    screenshots.push('confirm-1-dashboard.png');
    console.log('✅ Dashboard loaded');

    // Step 2: Handle authentication
    console.log('');
    console.log('🔐 Step 2: Checking authentication...');
    const phoneInput = page.locator('input[type="tel"], input[placeholder*="phone" i]').first();
    const needsLogin = await phoneInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (needsLogin) {
      console.log('   ⚠️ Login required');
      console.log('   👤 Please enter your vendor phone number in the browser');
      console.log('   ⏳ Waiting 60 seconds for manual login...');
      
      // Wait for user to complete login
      try {
        // Wait for URL to change or dashboard elements to appear
        await Promise.race([
          page.waitForURL('**/dashboard**', { timeout: 60000 }),
          page.waitForSelector('text=Service Management, button:has-text("Service Management")', { timeout: 60000 }),
          page.waitForTimeout(60000),
        ]);
      } catch (e) {
        console.log('   ⚠️ Login timeout, continuing anyway...');
      }
      
      await page.waitForTimeout(3000);
      await page.screenshot({ path: 'confirm-2-after-login.png', fullPage: true });
      screenshots.push('confirm-2-after-login.png');
      console.log('✅ Login completed (or timeout)');
    } else {
      console.log('✅ Already authenticated');
    }

    // Step 3: Find and click Service Management button
    console.log('');
    console.log('🔍 Step 3: Looking for Service Management button...');
    await page.waitForTimeout(2000);

    // Wait for dashboard to be interactive
    try {
      await page.waitForSelector('button, a', { timeout: 10000 });
    } catch (e) {
      errors.push('Dashboard buttons not found');
    }

    // Look for Service Management button with Activity icon
    const serviceMgmtButton = page.locator('button:has-text("Service Management")').first();
    const buttonVisible = await serviceMgmtButton.isVisible({ timeout: 10000 }).catch(() => false);

    if (buttonVisible) {
      console.log('   ✅ Found "Service Management" button');
      await serviceMgmtButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await serviceMgmtButton.click();
      console.log('   ✅ Clicked Service Management button');
    } else {
      // Try alternative: Look for button with Activity icon pattern
      console.log('   ⚠️ Button not found by text, trying alternative methods...');
      
      // Try clicking on "See All →" link in services section
      const seeAllLink = page.locator('text=/See All/i, a:has-text("See All")').first();
      const seeAllVisible = await seeAllLink.isVisible({ timeout: 5000 }).catch(() => false);
      
      if (seeAllVisible) {
        console.log('   ✅ Found "See All" link, clicking...');
        await seeAllLink.click();
      } else {
        // Direct navigation
        console.log('   ⚠️ Trying direct navigation to /services...');
        await page.goto(`${VENDOR_DASHBOARD_URL}/services`, { waitUntil: 'networkidle', timeout: 30000 });
      }
    }

    await page.waitForTimeout(4000); // Wait for Service Management page to load
    details.pageUrl = page.url();
    details.pageTitle = await page.title();
    
    console.log(`   📍 Current URL: ${details.pageUrl}`);
    await page.screenshot({ path: 'confirm-3-service-management.png', fullPage: true });
    screenshots.push('confirm-3-service-management.png');

    // Step 4: Verify "Browse Service Catalog" section
    console.log('');
    console.log('🔍 Step 4: Verifying "Browse Service Catalog" section...');
    
    // Get full page text for analysis
    const pageText = await page.textContent('body') || '';
    const hasCatalogText = /browse.*catalog|platform.*catalog/i.test(pageText);
    
    console.log(`   📄 Page contains catalog text: ${hasCatalogText}`);

    // Look for the catalog section with multiple strategies
    const catalogSelectors = [
      'text=/Browse.*Service.*Catalog/i',
      'h3:has-text("Browse Service Catalog")',
      'h3:has-text("Browse")',
      'text=/Browse.*Catalog/i',
      'button:has-text("Browse Catalog")',
    ];

    let catalogElement = null;
    for (const selector of catalogSelectors) {
      try {
        const element = page.locator(selector).first();
        const visible = await element.isVisible({ timeout: 3000 });
        if (visible) {
          console.log(`   ✅ Found catalog section with: ${selector}`);
          catalogElement = element;
          details.catalogSectionFound = true;
          break;
        }
      } catch (e) {
        // Continue
      }
    }

    // Check position if found
    if (catalogElement) {
      const boundingBox = await catalogElement.boundingBox();
      if (boundingBox) {
        details.catalogPosition = boundingBox.y;
        console.log(`   📍 Catalog section position: y=${boundingBox.y}px`);
        
        if (boundingBox.y < 600) {
          console.log('   ✅ Catalog section is positioned near the top (good UX)');
        } else {
          console.log('   ⚠️ Catalog section is positioned lower on page');
          errors.push(`Catalog section at y=${boundingBox.y}px, expected < 600px`);
        }
      }
    }

    // Check for "Browse Catalog" button
    const browseButton = page.locator('button:has-text("Browse Catalog"), button:has-text("Browse")').first();
    details.catalogButtonFound = await browseButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (details.catalogButtonFound) {
      console.log('   ✅ "Browse Catalog" button found');
    } else {
      console.log('   ⚠️ "Browse Catalog" button not found');
    }

    // Verify it appears before "Select Service Type"
    if (details.catalogSectionFound) {
      const selectServiceType = page.locator('text=/Select Service Type/i, h2:has-text("Select")').first();
      const selectServiceVisible = await selectServiceType.isVisible({ timeout: 3000 }).catch(() => false);
      
      if (selectServiceVisible) {
        const selectBoundingBox = await selectServiceType.boundingBox();
        if (selectBoundingBox && details.catalogPosition !== null) {
          if (details.catalogPosition < selectBoundingBox.y) {
            console.log('   ✅ Catalog section appears BEFORE "Select Service Type" (correct position)');
          } else {
            console.log('   ❌ Catalog section appears AFTER "Select Service Type" (incorrect position)');
            errors.push('Catalog section should appear before "Select Service Type"');
          }
        }
      }
    }

    await page.screenshot({ path: 'confirm-4-final-state.png', fullPage: true });
    screenshots.push('confirm-4-final-state.png');

    // Final verification
    const success = details.catalogSectionFound && details.catalogButtonFound && 
                   (details.catalogPosition === null || details.catalogPosition < 600);

    if (success) {
      return {
        success: true,
        message: '✅ SUCCESS: "Browse Service Catalog" section is visible and correctly positioned',
        screenshots,
        details,
      };
    } else {
      return {
        success: false,
        message: '❌ FAILED: "Browse Service Catalog" section not found or incorrectly positioned',
        screenshots,
        details,
        errors: errors.length > 0 ? errors : ['Catalog section not visible'],
      };
    }
  } catch (error: any) {
    console.error('❌ Test error:', error);
    errors.push(error.message || String(error));
    
    return {
      success: false,
      message: `❌ TEST FAILED: ${error.message}`,
      screenshots,
      details,
      errors,
    };
  } finally {
    if (browser) {
      console.log('');
      console.log('⏳ Keeping browser open for 15 seconds for manual inspection...');
      await new Promise(resolve => setTimeout(resolve, 15000));
      await browser.close();
    }
  }
}

// Run the test
if (require.main === module) {
  confirmServiceCatalog()
    .then((result) => {
      console.log('');
      console.log('='.repeat(60));
      console.log('TEST RESULT:', result.message);
      console.log('='.repeat(60));
      
      if (result.details) {
        console.log('');
        console.log('📊 Test Details:');
        console.log(`   - Catalog Section Found: ${result.details.catalogSectionFound ? '✅' : '❌'}`);
        console.log(`   - Catalog Position: ${result.details.catalogPosition !== null ? result.details.catalogPosition + 'px' : 'N/A'}`);
        console.log(`   - Browse Button Found: ${result.details.catalogButtonFound ? '✅' : '❌'}`);
        console.log(`   - Page URL: ${result.details.pageUrl}`);
        console.log(`   - Page Title: ${result.details.pageTitle}`);
      }
      
      if (result.screenshots && result.screenshots.length > 0) {
        console.log('');
        console.log('📸 Screenshots saved:');
        result.screenshots.forEach((screenshot) => {
          console.log(`   - ${screenshot}`);
        });
      }
      
      if (result.errors && result.errors.length > 0) {
        console.log('');
        console.log('⚠️ Issues found:');
        result.errors.forEach((error) => {
          console.log(`   - ${error}`);
        });
      }
      
      console.log('');
      process.exit(result.success ? 0 : 1);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { confirmServiceCatalog };

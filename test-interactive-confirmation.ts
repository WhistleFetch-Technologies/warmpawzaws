/**
 * Interactive Browser Test: Confirm Service Catalog
 * 
 * This test will:
 * 1. Open browser
 * 2. Wait for you to manually login and navigate to Service Management
 * 3. Then automatically verify the "Browse Service Catalog" section
 */

import { chromium } from 'playwright';

const VENDOR_DASHBOARD_URL = 'https://d1s6ykkj381k58.cloudfront.net';

async function interactiveConfirmation() {
  console.log('🚀 Interactive Service Catalog Confirmation Test');
  console.log('='.repeat(60));
  console.log('');
  console.log('📋 Instructions:');
  console.log('1. Browser will open');
  console.log('2. Please login with your approved vendor account');
  console.log('3. Navigate to Service Management (click "Service Management" button)');
  console.log('4. Once on Service Management page, the test will automatically verify');
  console.log('');
  console.log('⏳ Opening browser in 3 seconds...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext({
    viewport: { width: 430, height: 932 },
  });

  const page = await context.newPage();
  await page.goto(VENDOR_DASHBOARD_URL);

  console.log('');
  console.log('✅ Browser opened. Please:');
  console.log('   1. Login with your vendor account');
  console.log('   2. Click "Service Management" button');
  console.log('   3. Wait for Service Management page to load');
  console.log('');
  console.log('⏳ Waiting for you to navigate to Service Management...');
  console.log('   (Monitoring for Service Management page...)');
  console.log('');

  // Wait for Service Management page indicators
  let serviceMgmtDetected = false;
  let attempts = 0;
  const maxAttempts = 120; // 2 minutes

  while (!serviceMgmtDetected && attempts < maxAttempts) {
    await page.waitForTimeout(1000);
    attempts++;

    const currentUrl = page.url();
    const pageText = await page.textContent('body').catch(() => '');
    
    // Check if we're on Service Management page
    const isServiceMgmt = 
      currentUrl.includes('/services') ||
      pageText.includes('Service Management') ||
      pageText.includes('Select Service Type') ||
      pageText.includes('Browse Service Catalog');

    if (isServiceMgmt && !pageText.includes('Onboarding')) {
      serviceMgmtDetected = true;
      console.log('✅ Service Management page detected!');
      break;
    }

    if (attempts % 10 === 0) {
      console.log(`   ⏳ Still waiting... (${attempts}s)`);
    }
  }

  if (!serviceMgmtDetected) {
    console.log('⚠️ Service Management page not detected automatically');
    console.log('   Proceeding with verification anyway...');
  }

  // Now verify the catalog section
  console.log('');
  console.log('🔍 Verifying "Browse Service Catalog" section...');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'final-verification.png', fullPage: true });

  const pageText = await page.textContent('body') || '';
  const pageUrl = page.url();

  console.log(`📍 Current URL: ${pageUrl}`);
  console.log('');

  // Check for catalog section
  const hasBrowseCatalog = /Browse.*Service.*Catalog|Browse.*Catalog/i.test(pageText);
  const hasBrowseButton = /Browse Catalog|Browse.*button/i.test(pageText);
  const hasSelectServiceType = /Select Service Type/i.test(pageText);

  console.log('📊 Verification Results:');
  console.log(`   - "Browse Service Catalog" text: ${hasBrowseCatalog ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`   - "Browse Catalog" button: ${hasBrowseButton ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log(`   - "Select Service Type" text: ${hasSelectServiceType ? '✅ FOUND' : '❌ NOT FOUND'}`);
  console.log('');

  // Try to find elements
  try {
    const catalogSection = page.locator('text=/Browse.*Service.*Catalog/i, h3:has-text("Browse")').first();
    const catalogVisible = await catalogSection.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (catalogVisible) {
      const boundingBox = await catalogSection.boundingBox();
      console.log(`   📍 Catalog section position: y=${boundingBox?.y || 'N/A'}px`);
      
      if (boundingBox && boundingBox.y < 600) {
        console.log('   ✅ Catalog section is near the top (good!)');
      }
    }

    const browseButton = page.locator('button:has-text("Browse Catalog")').first();
    const buttonVisible = await browseButton.isVisible({ timeout: 3000 }).catch(() => false);
    
    if (buttonVisible) {
      console.log('   ✅ "Browse Catalog" button is visible and clickable');
    }
  } catch (e) {
    console.log('   ⚠️ Could not verify element positions');
  }

  // Final result
  const success = hasBrowseCatalog && hasBrowseButton;
  
  console.log('');
  console.log('='.repeat(60));
  if (success) {
    console.log('✅ CONFIRMATION: "Browse Service Catalog" section is VISIBLE');
    console.log('✅ The feature is working correctly!');
  } else {
    console.log('❌ CONFIRMATION: "Browse Service Catalog" section NOT FOUND');
    console.log('⚠️  Please check:');
    console.log('   1. Are you logged in as an approved vendor?');
    console.log('   2. Does your vendor have catalog or booking capabilities?');
    console.log('   3. Are you on the Service Management page?');
    console.log('   4. Try hard refresh (Cmd+Shift+R) - CloudFront cache may need time');
  }
  console.log('='.repeat(60));
  console.log('');
  console.log('📸 Screenshot saved: final-verification.png');
  console.log('');
  console.log('⏳ Browser will stay open for 30 seconds for manual inspection...');
  await new Promise(resolve => setTimeout(resolve, 30000));
  
  await browser.close();
  process.exit(success ? 0 : 1);
}

interactiveConfirmation().catch(console.error);

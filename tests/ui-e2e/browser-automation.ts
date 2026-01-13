/**
 * BROWSER AUTOMATION MODULE
 * 
 * Real browser automation using Playwright
 * Provides actual UI interactions for E2E testing
 */

import { Browser, BrowserContext, Page, chromium } from 'playwright';

// ============================================================================
// CONFIGURATION
// ============================================================================

const config = {
  headless: process.env.HEADLESS !== 'false',
  baseUrl: process.env.UI_BASE_URL || 'http://localhost:3000',
  timeout: 30000,
  screenshotPath: './test-results/screenshots',
  videoPath: './test-results/videos',
};

// ============================================================================
// BROWSER AUTOMATION MANAGER
// ============================================================================

export class BrowserAutomation {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pages: Map<string, Page> = new Map();

  /**
   * Initialize browser
   */
  async initialize(): Promise<void> {
    if (this.browser) return;

    console.log('🌐 Initializing browser automation...');
    this.browser = await chromium.launch({
      headless: config.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      recordVideo: {
        dir: config.videoPath,
        size: { width: 1920, height: 1080 },
      },
    });

    console.log('✅ Browser initialized');
  }

  /**
   * Get or create page for role
   */
  async getPage(role: 'admin' | 'customer' | 'vendor'): Promise<Page> {
    if (!this.context) {
      await this.initialize();
    }

    if (!this.pages.has(role)) {
      const page = await this.context!.newPage();
      this.pages.set(role, page);
    }

    return this.pages.get(role)!;
  }

  /**
   * Navigate to URL
   */
  async navigate(route: string, role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    const url = route.startsWith('http') ? route : `${config.baseUrl}${route}`;
    
    console.log(`     [BROWSER] Navigating to ${url}`);
    await page.goto(url, { waitUntil: 'networkidle', timeout: config.timeout });
  }

  /**
   * Click element
   */
  async click(selector: string, role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    
    console.log(`     [BROWSER] Clicking ${selector}`);
    await page.click(selector, { timeout: config.timeout });
    
    // Wait for any navigation or state changes
    await page.waitForTimeout(500);
  }

  /**
   * Type into element
   */
  async type(selector: string, value: string, role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    
    console.log(`     [BROWSER] Typing "${value}" into ${selector}`);
    await page.fill(selector, value);
    await page.waitForTimeout(200);
  }

  /**
   * Select option
   */
  async select(selector: string, value: string | string[], role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    
    console.log(`     [BROWSER] Selecting "${value}" from ${selector}`);
    
    if (Array.isArray(value)) {
      // Multi-select
      for (const v of value) {
        await page.selectOption(selector, v);
      }
    } else {
      await page.selectOption(selector, value);
    }
    
    await page.waitForTimeout(200);
  }

  /**
   * Scroll to element
   */
  async scroll(selector: string, role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    
    console.log(`     [BROWSER] Scrolling to ${selector}`);
    await page.locator(selector).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
  }

  /**
   * Verify element exists and is visible
   */
  async verify(selector: string, role: 'admin' | 'customer' | 'vendor'): Promise<boolean> {
    const page = await this.getPage(role);
    
    try {
      const element = page.locator(selector);
      await element.waitFor({ state: 'visible', timeout: 5000 });
      console.log(`     [BROWSER] ✓ Element ${selector} is visible`);
      return true;
    } catch (error) {
      console.log(`     [BROWSER] ✗ Element ${selector} not found or not visible`);
      return false;
    }
  }

  /**
   * Wait for element
   */
  async waitFor(selector: string, timeout: number, role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    await page.waitForSelector(selector, { timeout });
  }

  /**
   * Capture screenshot
   */
  async screenshot(path: string, role: 'admin' | 'customer' | 'vendor'): Promise<void> {
    const page = await this.getPage(role);
    await page.screenshot({ path, fullPage: true });
  }

  /**
   * Get element text
   */
  async getText(selector: string, role: 'admin' | 'customer' | 'vendor'): Promise<string> {
    const page = await this.getPage(role);
    return await page.locator(selector).textContent() || '';
  }

  /**
   * Check if element exists
   */
  async exists(selector: string, role: 'admin' | 'customer' | 'vendor'): Promise<boolean> {
    const page = await this.getPage(role);
    const count = await page.locator(selector).count();
    return count > 0;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
    
    this.pages.clear();
    console.log('🔒 Browser closed');
  }
}

// Singleton instance
export const browserAutomation = new BrowserAutomation();

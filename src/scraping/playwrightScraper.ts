import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { logger } from '../utils/logger';

/**
 * Configuration for professional scraping with retry logic and error handling
 * Following Single Responsibility Principle (SRP)
 */
export interface ScraperConfig {
  headless: boolean;
  maxConcurrency: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

/**
 * PlaywrightScraper - Manages browser lifecycle and page interactions
 * Implements dependency injection and separation of concerns
 * 
 * Design Patterns:
 * - Singleton pattern for browser instance management
 * - Strategy pattern for retry logic
 * - Template method pattern for scraping flow
 */
export class PlaywrightScraper {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private config: ScraperConfig;

  constructor(config?: Partial<ScraperConfig>) {
    this.config = {
      headless: process.env.PLAYWRIGHT_HEADLESS === '1',
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '2', 10),
      timeout: 30000,
      retryAttempts: 3,
      retryDelay: 2000,
      ...config,
    };
  }

  /**
   * Initialize browser and context with optimal settings
   * Following Open/Closed Principle - extensible configuration
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing Playwright browser...');
      
      this.browser = await chromium.launch({
        headless: this.config.headless,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--disable-dev-shm-usage',
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ],
      });

      this.context = await this.browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
        locale: 'es-PE',
        timezoneId: 'America/Lima',
        permissions: [],
        extraHTTPHeaders: {
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        },
      });

      logger.info('Browser initialized successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      logger.error({ error: { message: errorMessage, stack: errorStack } }, 'Failed to initialize browser');
      throw new Error(`Browser initialization failed: ${errorMessage}`);
    }
  }

  /**
   * Create a new page with retry logic
   * Implements resilience pattern
   */
  async createPage(): Promise<Page> {
    if (!this.context) {
      throw new Error('Browser context not initialized. Call initialize() first.');
    }

    const page = await this.context.newPage();
    page.setDefaultTimeout(this.config.timeout);
    
    // Add request interception to block unnecessary resources
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  /**
   * Navigate to URL with retry logic and error handling
   * Template method pattern for navigation flow
   */
  async navigateWithRetry(page: Page, url: string): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        logger.debug({ url, attempt }, 'Navigating to URL');
        
        await page.goto(url, {
          waitUntil: 'networkidle',
          timeout: this.config.timeout,
        });

        // Wait for page to be stable
        await page.waitForLoadState('domcontentloaded');
        
        logger.debug({ url }, 'Navigation successful');
        return;
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { url, attempt, error: lastError.message },
          `Navigation attempt ${attempt} failed`
        );

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw new Error(
      `Failed to navigate to ${url} after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Execute a function with retry logic
   * Higher-order function for resilient operations
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        logger.debug({ operationName, attempt }, 'Executing operation');
        const result = await operation();
        logger.debug({ operationName }, 'Operation successful');
        return result;
      } catch (error) {
        lastError = error as Error;
        logger.warn(
          { operationName, attempt, error: lastError.message },
          `Operation attempt ${attempt} failed`
        );

        if (attempt < this.config.retryAttempts) {
          await this.delay(this.config.retryDelay * attempt);
        }
      }
    }

    throw new Error(
      `Operation ${operationName} failed after ${this.config.retryAttempts} attempts: ${lastError?.message}`
    );
  }

  /**
   * Wait for selector with enhanced error handling
   */
  async waitForSelector(
    page: Page,
    selector: string,
    options?: { timeout?: number; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  ): Promise<void> {
    try {
      await page.waitForSelector(selector, {
        timeout: options?.timeout || this.config.timeout,
        state: options?.state || 'visible',
      });
    } catch (error) {
      logger.error({ selector, error }, 'Failed to find selector');
      throw new Error(`Selector not found: ${selector}`);
    }
  }

  /**
   * Safe text extraction with fallback
   */
  async extractText(page: Page, selector: string, defaultValue = ''): Promise<string> {
    try {
      const element = await page.$(selector);
      if (!element) return defaultValue;
      
      const text = await element.textContent();
      return text?.trim() || defaultValue;
    } catch (error) {
      logger.debug({ selector, error }, 'Failed to extract text');
      return defaultValue;
    }
  }

  /**
   * Safe attribute extraction
   */
  async extractAttribute(
    page: Page,
    selector: string,
    attribute: string,
    defaultValue = ''
  ): Promise<string> {
    try {
      const element = await page.$(selector);
      if (!element) return defaultValue;
      
      const value = await element.getAttribute(attribute);
      return value || defaultValue;
    } catch (error) {
      logger.debug({ selector, attribute, error }, 'Failed to extract attribute');
      return defaultValue;
    }
  }

  /**
   * Scroll page to load lazy content
   */
  async scrollToBottom(page: Page): Promise<void> {
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        const timer = setInterval(() => {
          // @ts-ignore - Running in browser context
          const scrollHeight = document.body.scrollHeight;
          // @ts-ignore - Running in browser context
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });
  }

  /**
   * Delay utility for rate limiting
   */
  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Clean shutdown of browser resources
   * Ensures proper resource cleanup
   */
  async close(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      logger.info('Browser closed successfully');
    } catch (error) {
      logger.error({ error }, 'Error closing browser');
      throw error;
    }
  }

  /**
   * Check if scraper is initialized
   */
  isInitialized(): boolean {
    return this.browser !== null && this.context !== null;
  }
}
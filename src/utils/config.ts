/**
 * Configuration service - Centralized configuration management
 * Implements Singleton pattern for global config access
 */

export interface AppConfig {
  // Database
  databaseUrl: string;
  
  // Scraping
  scrapeCities: string[];
  scrapeSpecialties: string[];
  doctorsPerSearch: number;
  
  // Data Generation
  patientsCount: number;
  appointmentFillRate: number;
  
  // Playwright
  playwrightHeadless: boolean;
  maxConcurrency: number;
  proxyUrl?: string;
  
  // Pipeline
  clearDatabase: boolean;
  logLevel: string;
  nodeEnv: string;
}

class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  private loadConfig(): AppConfig {
    return {
      databaseUrl: process.env.DATABASE_URL || '',
      scrapeCities: (process.env.SCRAPE_CITIES || 'Lima,Arequipa')
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
      scrapeSpecialties: (process.env.SCRAPE_SPECIALTIES || 'Medicina general,Pediatría')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      doctorsPerSearch: parseInt(process.env.DOCTORS_PER_SEARCH || '5', 10),
      patientsCount: parseInt(process.env.PATIENTS_COUNT || '100', 10),
      appointmentFillRate: parseFloat(process.env.APPOINTMENT_FILL_RATE || '0.7'),
      playwrightHeadless: process.env.PLAYWRIGHT_HEADLESS === '1',
      maxConcurrency: parseInt(process.env.MAX_CONCURRENCY || '2', 10),
      proxyUrl: process.env.PROXY_URL,
      clearDatabase: process.env.CLEAR_DATABASE === 'true',
      logLevel: process.env.LOG_LEVEL || 'info',
      nodeEnv: process.env.NODE_ENV || 'development',
    };
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  public isDevelopment(): boolean {
    return this.config.nodeEnv === 'development';
  }

  public isProduction(): boolean {
    return this.config.nodeEnv === 'production';
  }

  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.databaseUrl) {
      errors.push('DATABASE_URL is required');
    }

    if (this.config.scrapeCities.length === 0) {
      errors.push('SCRAPE_CITIES must have at least one city');
    }

    if (this.config.scrapeSpecialties.length === 0) {
      errors.push('SCRAPE_SPECIALTIES must have at least one specialty');
    }

    if (this.config.doctorsPerSearch < 1) {
      errors.push('DOCTORS_PER_SEARCH must be at least 1');
    }

    if (this.config.patientsCount < 1) {
      errors.push('PATIENTS_COUNT must be at least 1');
    }

    if (this.config.appointmentFillRate < 0 || this.config.appointmentFillRate > 1) {
      errors.push('APPOINTMENT_FILL_RATE must be between 0 and 1');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Export singleton instance
export const config = ConfigService.getInstance();

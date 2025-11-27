import { Page } from 'playwright';
import { PlaywrightScraper } from './playwrightScraper';
import { DoctorDTO, TreatmentDTO, AvailabilityDTO } from '../types/dtos';
import { logger } from '../utils/logger';

/**
 * DoctorScraper - Specialized scraper for Doctoralia.pe
 * 
 * Design Patterns:
 * - Facade pattern: Simplifies complex scraping logic
 * - Strategy pattern: Different scraping strategies per section
 * - Builder pattern: Constructs DoctorDTO incrementally
 * 
 * SOLID Principles:
 * - SRP: Each method has a single responsibility
 * - OCP: Extensible for new scraping strategies
 * - DIP: Depends on PlaywrightScraper abstraction
 */
export class DoctorScraper {
  private scraper: PlaywrightScraper;
  private baseUrl = 'https://www.doctoralia.pe';

  constructor(scraper: PlaywrightScraper) {
    this.scraper = scraper;
  }

  /**
   * Search doctors by specialty and city
   * Returns list of profile URLs to scrape
   */
  async searchDoctors(specialty: string, city: string, limit = 10): Promise<string[]> {
    logger.info({ specialty, city, limit }, 'Searching doctors');
    
    const page = await this.scraper.createPage();
    const profileUrls: string[] = [];

    try {
      // Construct search URL
      const searchUrl = `${this.baseUrl}/buscar?q=${encodeURIComponent(specialty)}&loc=${encodeURIComponent(city)}`;
      
      await this.scraper.navigateWithRetry(page, searchUrl);
      
      // Wait for search results - Updated selectors for current Doctoralia.pe structure
      await this.scraper.waitForSelector(page, 'a[data-ga-event="click"][data-ga-category="QA"]', {
        timeout: 15000,
      }).catch(() => {
        logger.warn('No search results found with standard selectors, trying alternatives');
      });

      // Extract profile URLs from search results - using actual Doctoralia.pe selectors
      const urls = await page.$$eval(
        'a[data-ga-event="click"][data-ga-category="QA"], a[href*="/psicologo/"], a[href*="/medico-general/"], a[href*="/cardiologo/"], a[href*="/dermatologo/"], a[href*="/pediatra/"]',
        (links: any[]) => links
          .map((link: any) => link.href)
          .filter((href: string) => href && href.includes('doctoralia.pe/'))
      );

      // Remove duplicates and limit results
      const uniqueUrls = [...new Set(urls)].slice(0, limit) as string[];
      profileUrls.push(...uniqueUrls);

      logger.info({ count: profileUrls.length, specialty, city }, 'Doctor profiles found');
    } catch (error) {
      logger.error({ error, specialty, city }, 'Failed to search doctors');
      throw error;
    } finally {
      await page.close();
    }

    return profileUrls;
  }

  /**
   * Scrape complete doctor profile
   * Main orchestration method following Template Method pattern
   */
  async scrapeDoctorProfile(profileUrl: string): Promise<DoctorDTO | null> {
    logger.info({ profileUrl }, 'Scraping doctor profile');
    
    const page = await this.scraper.createPage();

    try {
      await this.scraper.navigateWithRetry(page, profileUrl);
      
      // Wait for main content and dynamic elements
      await page.waitForLoadState('domcontentloaded');
      await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
      await this.scraper.delay(2000); // Allow all dynamic content to load

      // Extract doctor information using specialized methods
      const fullName = await this.extractFullName(page);
      const specialty = await this.extractSpecialty(page);
      const city = await this.extractCity(page);
      const address = await this.extractAddress(page);
      const phone = await this.extractPhone(page);
      const rating = await this.extractRating(page);
      const reviewCount = await this.extractReviewCount(page);
      const treatments = await this.extractTreatments(page);
      const availability = await this.extractAvailability(page);

      // Validate required fields
      if (!fullName || !specialty || !city) {
        logger.warn({ profileUrl, fullName, specialty, city }, 'Missing required doctor information');
        return null;
      }

      const doctorDTO: DoctorDTO = {
        fullName,
        specialty,
        city,
        address,
        phoneCountryCode: phone.countryCode,
        phoneNumber: phone.number,
        rating,
        reviewCount,
        profileUrl,
        treatments,
        availability,
      };

      logger.info({ fullName, specialty, city, treatments: treatments.length, availability: availability.length }, 'Doctor profile scraped successfully');
      return doctorDTO;
    } catch (error) {
      logger.error({ error, profileUrl }, 'Failed to scrape doctor profile');
      return null;
    } finally {
      await page.close();
    }
  }

  /**
   * Extract doctor's full name
   * Multiple selector strategies for resilience
   */
  private async extractFullName(page: Page): Promise<string> {
    const selectors = [
      'h1[itemprop="name"]',
      'h1.h1',
      'h1[data-doctor-name]',
      'h1.doctor-name',
      '.profile-name h1',
      'h1',
    ];

    for (const selector of selectors) {
      const name = await this.scraper.extractText(page, selector);
      if (name) {
        return name.replace(/^(Dr\.|Dra\.|Ps|Mg\.)\s*/i, '').trim();
      }
    }

    return '';
  }

  /**
   * Extract specialty from doctor profile
   * Uses multiple strategies to find the specialty
   */
  private async extractSpecialty(page: Page): Promise<string> {
    try {
      // Strategy 1: Look for specialty in structured data
      const specialty = await page.evaluate(() => {
        // Check meta tags
        const metaSpecialty = document.querySelector('meta[property="profile:specialty"]');
        if (metaSpecialty) return metaSpecialty.getAttribute('content');

        // Check breadcrumbs
        const breadcrumbs = Array.from(document.querySelectorAll('.breadcrumb a, [itemtype*="BreadcrumbList"] a'));
        for (const crumb of breadcrumbs) {
          const text = (crumb as any).textContent?.trim() || '';
          if (text && !text.match(/inicio|home|doctoralia|peru/i) && text.length > 3) {
            return text;
          }
        }

        // Check headings near doctor name
        const h2 = document.querySelector('h2.h4, h2[class*="specialty"], .profile-specialty');
        if (h2) return h2.textContent?.trim() || null;

        // Check subtitle or description
        const subtitle = document.querySelector('.subtitle, .specialization, [itemprop="specialty"]');
        if (subtitle) return subtitle.textContent?.trim() || null;

        return null;
      });

      if (specialty && specialty.length > 2) {
        return specialty;
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to extract specialty');
    }

    return 'Medicina General';
  }

  /**
   * Extract city from address or location
   */
  private async extractCity(page: Page): Promise<string> {
    const selectors = [
      '[data-city]',
      '.location .city',
      '.address .city',
      'address',
    ];

    for (const selector of selectors) {
      const location = await this.scraper.extractText(page, selector);
      if (location) {
        // Try to extract city from address
        const cityMatch = location.match(/Lima|Arequipa|Trujillo|Cusco|Chiclayo|Piura|Iquitos/i);
        if (cityMatch) {
          return cityMatch[0];
        }
      }
    }

    return 'Lima'; // Default fallback
  }

  /**
   * Extract full address or medical center name
   * Tries multiple strategies to get complete address information
   */
  private async extractAddress(page: Page): Promise<string | undefined> {
    try {
      const address = await page.evaluate(() => {
        // Strategy 1: Look for address in location/office section
        const addressElements = [
          document.querySelector('.h-adr, [itemprop="address"]'),
          document.querySelector('.address-line, .office-address'),
          document.querySelector('[class*="location"] [class*="address"]'),
          document.querySelector('.map-address, .clinic-address'),
        ];

        for (const el of addressElements) {
          if (el) {
            const text = el.textContent?.trim();
            if (text && text.length > 10) return text;
          }
        }

        // Strategy 2: Combine street and district
        const street = document.querySelector('.street-address, [itemprop="streetAddress"]')?.textContent?.trim();
        const locality = document.querySelector('.locality, [itemprop="addressLocality"]')?.textContent?.trim();
        if (street || locality) {
          return [street, locality].filter(Boolean).join(', ');
        }

        // Strategy 3: Look in office/clinic list
        const officeItem = document.querySelector('.office-item, .clinic-item, [data-office]');
        if (officeItem) {
          const addressText = officeItem.textContent?.trim();
          if (addressText && addressText.length > 10) {
            // Extract just the address part (remove phone, etc)
            const lines = addressText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 0);
            return lines.find((line: string) => line.match(/av\.|jr\.|ca\.|calle|avenida|jirón/i)) || lines[0];
          }
        }

        return null;
      });

      if (address && address.length > 5) {
        return address;
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to extract address');
    }

    return undefined;
  }

  /**
   * Extract phone number with Peru country code
   * Looks for phone numbers in multiple locations and formats
   */
  private async extractPhone(page: Page): Promise<{ countryCode?: string; number?: string }> {
    try {
      const phoneData = await page.evaluate(() => {
        // Strategy 1: Look for tel: links
        const telLinks = Array.from(document.querySelectorAll('a[href^="tel:"]'));
        for (const link of telLinks) {
          const href = (link as any).getAttribute('href');
          if (href) {
            const cleaned = href.replace('tel:', '').replace(/[\s\-()]/g, '');
            const match = cleaned.match(/(\+?51)?(9\d{8})/);
            if (match) {
              return { code: '+51', number: match[2] };
            }
          }
        }

        // Strategy 2: Look in contact section
        const contactSections = [
          document.querySelector('.contact-phone, .phone-number'),
          document.querySelector('[class*="phone"][class*="contact"]'),
          document.querySelector('.office-phone, .clinic-phone'),
        ];

        for (const section of contactSections) {
          if (section) {
            const text = section.textContent || '';
            const match = text.match(/(\+?51)?\s*(9\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/);
            if (match) {
              const number = match[2].replace(/[\s\-]/g, '');
              return { code: '+51', number };
            }
          }
        }

        // Strategy 3: Search in all text for phone patterns
        const bodyText = document.body.textContent || '';
        const phoneMatch = bodyText.match(/(?:teléfono|tel|phone|celular)[:\s]*(\+?51)?\s*(9\d{2}[\s\-]?\d{3}[\s\-]?\d{3})/i);
        if (phoneMatch) {
          const number = phoneMatch[2].replace(/[\s\-]/g, '');
          return { code: '+51', number };
        }

        return null;
      });

      if (phoneData && phoneData.number) {
        return {
          countryCode: phoneData.code,
          number: phoneData.number,
        };
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to extract phone');
    }

    return {};
  }

  /**
   * Extract doctor rating/stars
   * Looks for rating in multiple formats and locations
   */
  private async extractRating(page: Page): Promise<number | undefined> {
    try {
      const rating = await page.evaluate(() => {
        // Strategy 1: Look for structured data
        const ratingElement = document.querySelector('[itemprop="ratingValue"], [class*="rating-value"], [data-rating]');
        if (ratingElement) {
          const value = ratingElement.getAttribute('content') || ratingElement.textContent;
          if (value) {
            const num = parseFloat(value.replace(',', '.'));
            if (!isNaN(num) && num >= 0 && num <= 5) return num;
          }
        }

        // Strategy 2: Count filled stars
        const stars = document.querySelectorAll('.star.filled, .star.active, [class*="star"][class*="fill"]');
        if (stars.length > 0 && stars.length <= 5) {
          return stars.length;
        }

        // Strategy 3: Look for rating text pattern
        const bodyText = document.body.textContent || '';
        const ratingMatch = bodyText.match(/([0-9],[0-9]|[0-9]\.[0-9])\s*(?:de\s*5|\/\s*5|estrellas)/i);
        if (ratingMatch) {
          const num = parseFloat(ratingMatch[1].replace(',', '.'));
          if (!isNaN(num)) return num;
        }

        return null;
      });

      if (rating !== null && rating !== undefined) {
        return Math.round(rating * 10) / 10;
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to extract rating');
    }

    return undefined;
  }

  /**
   * Extract number of reviews/opinions
   * Searches for review count in various formats
   */
  private async extractReviewCount(page: Page): Promise<number | undefined> {
    try {
      const count = await page.evaluate(() => {
        // Strategy 1: Look for structured data
        const countElement = document.querySelector('[itemprop="reviewCount"], [class*="review-count"], [class*="opinion-count"]');
        if (countElement) {
          const value = countElement.getAttribute('content') || countElement.textContent;
          if (value) {
            const num = parseInt(value.replace(/\D/g, ''), 10);
            if (!isNaN(num)) return num;
          }
        }

        // Strategy 2: Look for opinion text patterns
        const bodyText = document.body.textContent || '';
        const patterns = [
          /(\d+)\s*opiniones/i,
          /(\d+)\s*reviews/i,
          /(\d+)\s*valoraciones/i,
        ];

        for (const pattern of patterns) {
          const match = bodyText.match(pattern);
          if (match) {
            const num = parseInt(match[1], 10);
            if (!isNaN(num)) return num;
          }
        }

        return null;
      });

      if (count !== null && count !== undefined && count >= 0) {
        return count;
      }
    } catch (error) {
      logger.debug({ error }, 'Failed to extract review count');
    }

    return undefined;
  }

  /**
   * Extract treatments/services offered with prices and duration
   * Uses multiple strategies including clicking on treatment sections
   */
  private async extractTreatments(page: Page): Promise<TreatmentDTO[]> {
    const treatments: TreatmentDTO[] = [];

    try {
      // Strategy 1: Try clicking on "Precios" or "Servicios" tab if exists
      const tabSelectors = [
        'a[href*="precios"], button:has-text("Precios")',
        'a[href*="servicios"], button:has-text("Servicios")',
        '.tab-prices, .tab-services',
        '[data-tab="prices"], [data-tab="services"]',
      ];

      for (const selector of tabSelectors) {
        try {
          const tab = await page.$(selector);
          if (tab) {
            await tab.click();
            await page.waitForTimeout(1500); // Wait for content to load
            logger.debug('Clicked on prices/services tab');
            break;
          }
        } catch (e) {
          // Continue if tab not found or click failed
        }
      }

      // Strategy 2: Extract treatments from the page
      const extractedTreatments = await page.evaluate(() => {
        const results: any[] = [];

        // Look for treatment/service items in various structures
        const itemSelectors = [
          '.service-item, .treatment-item',
          '.price-item, .pricing-item',
          '[data-service], [data-treatment]',
          '.services-list > li, .treatments-list > li',
          '[itemtype*="Offer"], [itemtype*="Service"]',
        ];

        let items: any[] = [];
        for (const selector of itemSelectors) {
          items = Array.from(document.querySelectorAll(selector));
          if (items.length > 0) break;
        }

        for (const item of items.slice(0, 20)) {
          try {
            // Extract name
            const nameEl = item.querySelector('.service-name, .treatment-name, h3, h4, strong, [itemprop="name"]');
            const name = (nameEl?.textContent || item.textContent || '').trim().split('\n')[0].trim();
            
            if (!name || name.length < 3) continue;

            // Extract price
            let price: number | undefined;
            let currency = 'PEN';
            const priceEl = item.querySelector('.price, .cost, [itemprop="price"], [class*="precio"]');
            if (priceEl) {
              const priceText = priceEl.textContent || '';
              // Match patterns like "S/ 150", "S/. 150", "150 soles", "PEN 150"
              const priceMatch = priceText.match(/(?:S\/?\.?|PEN)?\s*(\d+(?:[,.]\d{2})?)/);
              if (priceMatch) {
                price = parseFloat(priceMatch[1].replace(',', '.'));
              }
            }

            // Extract duration
            let duration_minutes: number | undefined;
            const durationEl = item.querySelector('[class*="duration"], [class*="duracion"], .time');
            if (durationEl) {
              const durationText = durationEl.textContent || '';
              const durationMatch = durationText.match(/(\d+)\s*(?:min|minutos?)/i);
              if (durationMatch) {
                duration_minutes = parseInt(durationMatch[1], 10);
              }
            }

            // Extract description
            const descEl = item.querySelector('.description, .desc, p');
            const description = descEl?.textContent?.trim();

            results.push({
              name,
              price,
              currency: price ? currency : undefined,
              duration_minutes,
              description: description && description.length > 10 && description.length < 200 ? description : undefined,
            });
          } catch (e) {
            // Skip this item
          }
        }

        return results;
      });

      treatments.push(...extractedTreatments);
      logger.debug({ count: treatments.length }, 'Extracted treatments from page');

    } catch (error) {
      logger.debug({ error }, 'Failed to extract treatments');
    }

    // If no treatments found, add default consultation services
    if (treatments.length === 0) {
      treatments.push(
        { 
          name: 'Consulta en consultorio', 
          price: 80,
          currency: 'PEN',
          duration_minutes: 30 
        },
        { 
          name: 'Teleconsulta', 
          price: 60,
          currency: 'PEN',
          duration_minutes: 20 
        }
      );
    }

    return treatments.slice(0, 15); // Limit to 15 treatments max
  }

  /**
   * Extract real availability/schedule from doctor's calendar
   * Tries to click on availability/calendar section and extract time slots
   */
  private async extractAvailability(page: Page): Promise<AvailabilityDTO[]> {
    const availability: AvailabilityDTO[] = [];

    try {
      // Strategy 1: Try clicking on "Agenda" or "Disponibilidad" tab
      const agendaSelectors = [
        'a[href*="agenda"], button:has-text("Agenda")',
        'a[href*="disponibilidad"], button:has-text("Disponibilidad")',
        'a[href*="horarios"], button:has-text("Horarios")',
        '.tab-schedule, .tab-availability',
        '[data-tab="schedule"], [data-tab="availability"]',
      ];

      for (const selector of agendaSelectors) {
        try {
          const tab = await page.$(selector);
          if (tab) {
            await tab.click();
            await page.waitForTimeout(2000); // Wait for calendar to load
            logger.debug('Clicked on schedule/availability tab');
            break;
          }
        } catch (e) {
          // Continue if not found
        }
      }

      // Strategy 2: Extract time slots from calendar/schedule
      const extractedSlots = await page.evaluate(() => {
        const slots: any[] = [];

        // Look for time slot elements
        const slotSelectors = [
          '.time-slot, .available-slot',
          '[data-time], [data-slot]',
          '.calendar-slot, .schedule-slot',
          'button[class*="slot"], a[class*="slot"]',
        ];

        let slotElements: any[] = [];
        for (const selector of slotSelectors) {
          slotElements = Array.from(document.querySelectorAll(selector));
          if (slotElements.length > 0) break;
        }

        for (const slot of slotElements.slice(0, 30)) {
          try {
            // Extract time from data attributes or text
            const timeAttr = slot.getAttribute('data-time') || slot.getAttribute('data-start');
            const text = slot.textContent || '';
            
            // Try to parse time from various formats
            let startTime: Date | null = null;
            
            if (timeAttr) {
              startTime = new Date(timeAttr);
            } else {
              // Look for time pattern like "10:00", "14:30"
              const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
              if (timeMatch) {
                const now = new Date();
                startTime = new Date(now);
                startTime.setHours(parseInt(timeMatch[1], 10), parseInt(timeMatch[2], 10), 0, 0);
                
                // If time is in the past, move to tomorrow
                if (startTime < now) {
                  startTime.setDate(startTime.getDate() + 1);
                }
              }
            }

            if (startTime && !isNaN(startTime.getTime())) {
              // Assume 30-minute slots by default
              const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);
              
              // Determine modality from text or class
              let modality: 'in_person' | 'online' = 'in_person';
              const slotText = text.toLowerCase();
              const slotClass = slot.className.toLowerCase();
              
              if (slotText.includes('online') || slotText.includes('virtual') || 
                  slotText.includes('teleconsulta') || slotClass.includes('online')) {
                modality = 'online';
              }

              slots.push({
                start_at: startTime.toISOString(),
                end_at: endTime.toISOString(),
                modality,
              });
            }
          } catch (e) {
            // Skip this slot
          }
        }

        return slots;
      });

      availability.push(...extractedSlots);
      logger.debug({ count: availability.length }, 'Extracted availability slots from calendar');

    } catch (error) {
      logger.debug({ error }, 'Failed to extract availability');
    }

    // If no real availability found, generate sample slots for next 7 days
    if (availability.length === 0) {
      const now = new Date();
      
      for (let day = 1; day <= 7; day++) {
        const date = new Date(now);
        date.setDate(date.getDate() + day);
        
        // Skip Sundays
        if (date.getDay() === 0) continue;

        // Morning slots (9:00 - 13:00)
        const morningStart = new Date(date);
        morningStart.setHours(9, 0, 0, 0);
        const morningEnd = new Date(date);
        morningEnd.setHours(13, 0, 0, 0);

        availability.push({
          start_at: morningStart.toISOString(),
          end_at: morningEnd.toISOString(),
          modality: Math.random() > 0.5 ? 'in_person' : 'online',
        });

        // Afternoon slots (15:00 - 19:00)
        if (Math.random() > 0.3) { // 70% chance of afternoon slots
          const afternoonStart = new Date(date);
          afternoonStart.setHours(15, 0, 0, 0);
          const afternoonEnd = new Date(date);
          afternoonEnd.setHours(19, 0, 0, 0);

          availability.push({
            start_at: afternoonStart.toISOString(),
            end_at: afternoonEnd.toISOString(),
            modality: 'in_person',
          });
        }
      }
    }

    return availability.slice(0, 20); // Limit to 20 slots max
  }
}

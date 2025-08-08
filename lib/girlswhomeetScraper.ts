import puppeteer, { Browser } from 'puppeteer';
import chromium from '@sparticuz/chromium';

export interface ScrapedEvent {
  id: string;
  name: string;
  description?: string;
  location: string;
  address?: string;
  date: string; // ISO date string
  time?: string;
  end_time?: string;
  category?: string;
  event_type?: string;
  price?: number;
  currency?: string;
  max_capacity?: number;
  organizer?: string;
  organizer_website?: string;
  image_url?: string;
  external_url?: string;
  source: 'girlswhomeet';
  source_id: string;
}

export class GirlsWhoMeetScraper {
  private browser: Browser | null = null;
  
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async init() {
    if (!this.browser) {
      const isServerless = process.env.VERCEL === '1';
      
      if (isServerless) {
        const executablePath = await chromium.executablePath();
        this.browser = await puppeteer.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        });
      } else {
        this.browser = await puppeteer.launch({
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--single-process',
            '--disable-extensions'
          ]
        });
      }
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeEvents(): Promise<ScrapedEvent[]> {
    try {
      const timeoutPromise = new Promise<ScrapedEvent[]>((_, reject) => {
        setTimeout(() => reject(new Error('Scraping timeout after 120 seconds')), 120000);
      });

      const scrapingPromise = this._scrapeEvents();
      return await Promise.race([scrapingPromise, timeoutPromise]);
    } catch (error) {
      console.error('Girls Who Meet scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private async _scrapeEvents(): Promise<ScrapedEvent[]> {
    await this.init();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const allEvents: ScrapedEvent[] = [];
    
    // Scrape main events page
    console.log('Scraping main events page...');
    const mainEvents = await this.scrapePage('https://www.girlswhomeet.com/events-1');
    allEvents.push(...mainEvents);
    
    // Scrape blind dates page
    console.log('Scraping blind dates page...');
    const blindDateEvents = await this.scrapePage('https://www.girlswhomeet.com/blind-dates');
    allEvents.push(...blindDateEvents);
    
    console.log(`Total events scraped: ${allEvents.length} (${mainEvents.length} from main page, ${blindDateEvents.length} from blind dates page)`);
    
    return allEvents;
  }

  private async scrapePage(url: string): Promise<ScrapedEvent[]> {
    const page = await this.browser!.newPage();
    
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000
      });
      
      await GirlsWhoMeetScraper.delay(3000);
      
      console.log('Extracting events from page...');
      const events = await page.evaluate((pageUrl) => {
        const debugInfo: any[] = [];
        const eventElements = document.querySelectorAll('li[data-hook="event-list-item"]');
        const events: any[] = [];
        
        eventElements.forEach((element, index) => {
          try {
            const debugEvent = { 
              index: index + 1, 
              dateText: null as string | null, 
              dateElementFound: false,
              dateMatch: null as string | null,
              parsedDate: null as string | null
            };
            
            // Extract date
            const dateElement = element.querySelector('[data-hook="ev-date"] span, [data-hook="ev-date-tbd"] span');
            const dateText = dateElement?.textContent?.trim();
            
            debugEvent.dateText = dateText || null;
            debugEvent.dateElementFound = !!dateElement;
            debugInfo.push(debugEvent);
            
            // Skip events without proper dates (like "See full calendar")
            if (!dateText || dateText === 'See full calendar') {
              return;
            }
            
            // Extract title
            const titleElement = element.querySelector('[data-hook="ev-list-item-title"]');
            const title = titleElement?.textContent?.trim();
            
            // Extract location
            const locationElement = element.querySelector('[data-hook="ev-list-item-location"] span');
            const location = locationElement?.textContent?.trim();
            
            // Extract full date and time
            const fullDateElement = element.querySelector('[data-hook="date"]');
            const fullDateText = fullDateElement?.textContent?.trim();
            
            // Extract full address
            const addressElement = element.querySelector('[data-hook="location"]');
            const address = addressElement?.textContent?.trim();
            
            // Extract external URL
            const rsvpButton = element.querySelector('[data-hook="ev-rsvp-button"]');
            const externalUrl = rsvpButton?.getAttribute('href');
            
            // Extract description (if available)
            const descriptionElement = element.querySelector('[data-hook="ev-list-item-description"]');
            const description = descriptionElement?.textContent?.trim();
            
            if (!title || !location) {
              return;
            }
            
            // Parse date from dateText (e.g., "Sun, Aug 10")
            const dateMatch = dateText.match(/(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d+)/);
            let eventDate = new Date();
            
            debugEvent.dateMatch = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : 'no match';
            
            if (dateMatch) {
              const month = dateMatch[1];
              const day = parseInt(dateMatch[2]);
              const currentYear = new Date().getFullYear();
              const monthIndex = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].indexOf(month);
              eventDate = new Date(currentYear, monthIndex, day);
              
              // If the date is in the past, assume it's next year
              if (eventDate < new Date()) {
                eventDate = new Date(currentYear + 1, monthIndex, day);
              }
              
              debugEvent.parsedDate = eventDate.toISOString();
            } else {
              // Use a fallback date
              eventDate = new Date();
              debugEvent.parsedDate = 'fallback';
            }
            
            // Parse time from fullDateText (e.g., "Aug 10, 2025, 2:30 PM – 4:30 PM")
            let eventTime: string | undefined;
            let endTime: string | undefined;
            
            if (fullDateText) {
              const timeMatch = fullDateText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
              if (timeMatch) {
                eventTime = `${timeMatch[1]}:${timeMatch[2]} ${timeMatch[3]}`;
              }
              
              const endTimeMatch = fullDateText.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*–\s*(\d{1,2}):(\d{2})\s*(AM|PM)/);
              if (endTimeMatch) {
                endTime = `${endTimeMatch[4]}:${endTimeMatch[5]} ${endTimeMatch[6]}`;
              }
            }
            
            // Determine category based on title and page URL
            let category = 'Wellness';
            const titleLower = title.toLowerCase();
            const isBlindDatePage = pageUrl.includes('blind-dates');
            
            if (isBlindDatePage || titleLower.includes('blind date')) {
              category = 'Social';
            } else if (titleLower.includes('yoga')) {
              category = 'Yoga';
            } else if (titleLower.includes('meditation')) {
              category = 'Meditation';
            } else if (titleLower.includes('sound') || titleLower.includes('healing')) {
              category = 'Healing';
            } else if (titleLower.includes('breathwork')) {
              category = 'Breathwork';
            } else if (titleLower.includes('forest') || titleLower.includes('nature')) {
              category = 'Nature';
            } else if (titleLower.includes('workshop')) {
              category = 'Workshop';
            }
            
            // Create source ID from title and date
            const sourceId = `${title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${dateText.replace(/\s+/g, '-')}`;
            
            console.log('Debug - Parsed event:', {
              title,
              dateText,
              eventDate: eventDate.toISOString(),
              location,
              category,
              pageUrl
            });
            
            events.push({
              name: title,
              location,
              address,
              date: eventDate.toISOString(), // Convert Date to ISO string
              time: eventTime,
              end_time: endTime,
              category,
              description,
              source_id: sourceId,
              external_url: externalUrl || pageUrl
            });
          } catch (error) {
            console.error('Error parsing event element:', error);
          }
        });
        
        return { events, debugInfo };
      }, url);
      
      console.log(`Found ${events.events.length} events from ${url}`);
      console.log('Debug info:', events.debugInfo);
      
      return events.events.map((event, index) => ({
        ...event,
        id: `gwm-${Date.now()}-${index}`,
        source: 'girlswhomeet' as const,
        description: `${event.name} at ${event.location}`,
        event_type: 'wellness',
        currency: 'USD',
        organizer: 'Girls Who Meet',
        organizer_website: 'https://www.girlswhomeet.com'
      }));
      
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }
}

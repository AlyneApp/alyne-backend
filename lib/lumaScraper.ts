import puppeteer, { Browser } from 'puppeteer';
import chromium from '@sparticuz/chromium';
import { saveLumaEventsToDatabase } from './lumaEventsDb';

export interface LumaEvent {
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
  organizer_avatar_url?: string;
  image_url?: string;
  external_url?: string;
  source: 'luma';
  source_id: string;
  event_url?: string;
  tags?: string[];
}

export class LumaScraper {
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

  async scrapeEvents(): Promise<LumaEvent[]> {
    try {
      const timeoutPromise = new Promise<LumaEvent[]>((_, reject) => {
        setTimeout(() => reject(new Error('Luma scraping timeout after 120 seconds')), 120000);
      });

      const scrapingPromise = this._scrapeEvents();
      return await Promise.race([scrapingPromise, timeoutPromise]);
    } catch (error) {
      console.error('Luma scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  async scrapeAndSaveEvents(): Promise<{
    scraped: number;
    inserted: number;
    updated: number;
    errors: string[];
  }> {
    console.log('🚀 Starting Luma events scraping and saving process...');
    
    try {
      // Scrape events
      const events = await this.scrapeEvents();
      
      if (events.length === 0) {
        console.log('❌ No Luma events found during scraping');
        return { scraped: 0, inserted: 0, updated: 0, errors: [] };
      }

      console.log(`✅ Successfully scraped ${events.length} Luma events`);

      // Save to database
      const dbResult = await saveLumaEventsToDatabase(events);

      return {
        scraped: events.length,
        inserted: dbResult.inserted,
        updated: dbResult.updated,
        errors: dbResult.errors
      };

    } catch (error) {
      console.error('Luma scraping and saving error:', error instanceof Error ? error.message : 'Unknown error');
      return {
        scraped: 0,
        inserted: 0,
        updated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error']
      };
    }
  }

  private async _scrapeEvents(): Promise<LumaEvent[]> {
    await this.init();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const allEvents: LumaEvent[] = [];
    
    // Scrape fitness events
    console.log('Scraping Luma fitness events...');
    const fitnessEvents = await this.scrapePage('https://luma.com/fitness', 'fitness');
    allEvents.push(...fitnessEvents);
    
    // Scrape wellness events
    console.log('Scraping Luma wellness events...');
    const wellnessEvents = await this.scrapePage('https://luma.com/wellness', 'wellness');
    allEvents.push(...wellnessEvents);
    
    console.log(`Total Luma events scraped: ${allEvents.length} (${fitnessEvents.length} fitness, ${wellnessEvents.length} wellness)`);
    
    return allEvents;
  }

  private async scrapePage(url: string, category: 'fitness' | 'wellness'): Promise<LumaEvent[]> {
    const page = await this.browser!.newPage();
    
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      
      console.log(`Navigating to ${url}...`);
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 60000
      });
      
      await LumaScraper.delay(5000);
      
      // Debug: Check if page loaded and what's on it
      const pageTitle = await page.title();
      console.log(`Page title: ${pageTitle}`);
      
      // Check if timeline exists
      const timelineExists = await page.$('.timeline');
      console.log(`Timeline element exists: ${!!timelineExists}`);
      
      // Get page content for debugging
      const pageContent = await page.content();
      console.log(`Page content length: ${pageContent.length}`);
      
      // Aggressive scrolling to load ALL content (lazy loading)
      console.log('Starting aggressive scrolling to load all content...');
      
      let previousHeight = 0;
      let currentHeight = 0;
      let scrollAttempts = 0;
      const maxScrollAttempts = 20; // Prevent infinite loops
      
      do {
        previousHeight = currentHeight;
        
        // Get current page height
        currentHeight = await page.evaluate(() => {
          return Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
          );
        });
        
        console.log(`Scroll attempt ${scrollAttempts + 1}: Height ${currentHeight} (previous: ${previousHeight})`);
        
        // Scroll to bottom
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Also try scrolling in smaller increments to trigger lazy loading
        await page.evaluate(() => {
          const scrollHeight = document.body.scrollHeight;
          const viewportHeight = window.innerHeight;
          const scrollStep = viewportHeight * 0.8;
          
          for (let i = 0; i < scrollHeight; i += scrollStep) {
            window.scrollTo(0, i);
          }
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Scroll back to bottom
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        scrollAttempts++;
        
        // Get new height after scrolling
        currentHeight = await page.evaluate(() => {
          return Math.max(
            document.body.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.clientHeight,
            document.documentElement.scrollHeight,
            document.documentElement.offsetHeight
          );
        });
        
      } while (currentHeight > previousHeight && scrollAttempts < maxScrollAttempts);
      
      console.log(`Finished scrolling after ${scrollAttempts} attempts. Final height: ${currentHeight}`);
      
      // Final scroll to top to ensure we can see all content
      await page.evaluate(() => {
        window.scrollTo(0, 0);
      });
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Extracting events from listing page...');
      const events = await page.evaluate((pageUrl, pageCategory) => {
        const events: any[] = [];
        
        // Look for the timeline container first
        const timeline = document.querySelector('.timeline');
        if (!timeline) {
          console.log('No timeline container found');
          return events;
        }
        
        console.log('Timeline found, looking for event cards...');
        
        // Look for event cards - the main container for each event
        const eventCards = timeline.querySelectorAll('.card-wrapper, .content-card, [class*="event-card"]');
        console.log(`Found ${eventCards.length} event cards`);
        
        // First, extract date information from timeline titles and create a date map
        const timelineTitles = timeline.querySelectorAll('[class*="timeline-title"], [class*="date-title"]');
        const dateMap = new Map(); // Map to store date for each section
        console.log(`Found ${timelineTitles.length} timeline title sections`);

        timelineTitles.forEach((titleEl, index) => {
          const dateEl = titleEl.querySelector('[class*="date"]');
          const weekdayEl = titleEl.querySelector('[class*="weekday"]');
          
          if (dateEl && weekdayEl) {
            const dateText = dateEl.textContent?.trim() || '';
            const weekdayText = weekdayEl.textContent?.trim() || '';
            console.log(`Timeline section ${index + 1}: ${dateText} (${weekdayText})`);
            
            // Parse the date
            let eventDate = new Date();
            
            if (dateText.toLowerCase() === 'today') {
              eventDate = new Date();
            } else if (dateText.toLowerCase() === 'tomorrow') {
              eventDate = new Date();
              eventDate.setDate(eventDate.getDate() + 1);
            } else {
              // Try to parse as a regular date
              try {
                eventDate = new Date(dateText);
                if (isNaN(eventDate.getTime())) {
                  // Try alternative parsing
                  const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
                                    'july', 'august', 'september', 'october', 'november', 'december'];
                  const monthAbbrs = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                                    'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
                  
                  const text = dateText.toLowerCase();
                  let monthIndex = -1;
                  
                  for (let i = 0; i < monthNames.length; i++) {
                    if (text.includes(monthNames[i]) || text.includes(monthAbbrs[i])) {
                      monthIndex = i;
                      break;
                    }
                  }
                  
                  if (monthIndex !== -1) {
                    const dayMatch = dateText.match(/(\d{1,2})/);
                    if (dayMatch) {
                      const day = parseInt(dayMatch[1]);
                      const currentYear = new Date().getFullYear();
                      eventDate = new Date(currentYear, monthIndex, day);
                      
                      // If date is in the past, assume next year
                      if (eventDate < new Date()) {
                        eventDate = new Date(currentYear + 1, monthIndex, day);
                      }
                    }
                  }
                }
              } catch (e) {
                console.log('Date parsing error:', e);
              }
            }
            
            // Store the date for this title section
            const dateKey = eventDate.toISOString().split('T')[0];
            dateMap.set(dateKey, eventDate);
            console.log(`Found date: ${dateText} -> ${dateKey}`);
          }
        });
        
        // Find ALL event cards first, then associate them with dates
        const allEventCards = timeline.querySelectorAll('.card-wrapper');
        
        // Create a map to store date associations
        const eventDateMap = new Map();
        
        // Wait a bit for dynamic content to load
        new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to scroll down to load more content (lazy loading)
        window.scrollTo(0, document.body.scrollHeight);
        new Promise(resolve => setTimeout(resolve, 2000));
        
        // Scroll back up
        window.scrollTo(0, 0);
        new Promise(resolve => setTimeout(resolve, 1000));
        
        // Find ONLY the date-title elements (section headers), not the individual date elements
        // Try multiple selectors to catch all date-title elements
        const dateTitleElements1 = timeline.querySelectorAll('[class*="date-title"]');
        const dateTitleElements2 = timeline.querySelectorAll('.timeline-title.date-title');
        const dateTitleElements3 = timeline.querySelectorAll('[class*="timeline-title"][class*="date-title"]');
        
        // Combine all results and remove duplicates
        const allDateTitleElements = new Set();
        [...dateTitleElements1, ...dateTitleElements2, ...dateTitleElements3].forEach(el => {
          allDateTitleElements.add(el);
        });
        
        const dateTitleElements = Array.from(allDateTitleElements);
        
        // Log the counts to the Node.js context
        const cardCount = allEventCards.length;
        const dateCount = dateTitleElements.length;
        
        dateTitleElements.forEach((dateTitleEl) => {
          // Find the actual date element within this date-title section
          const dateEl = (dateTitleEl as Element).querySelector('[class*="date"]');
          if (!dateEl) return;
          
          const dateText = dateEl.textContent?.trim() || '';
          let parsedDate = new Date();
          
          if (dateText.toLowerCase() === 'today') {
            parsedDate = new Date();
          } else if (dateText.toLowerCase() === 'tomorrow') {
            parsedDate = new Date();
            parsedDate.setDate(parsedDate.getDate() + 1);
          } else {
            // Handle formats like "Sep 11", "Sep 10", etc.
            const monthDayMatch = dateText.match(/^([A-Za-z]{3})\s+(\d{1,2})$/);
            if (monthDayMatch) {
              const monthAbbr = monthDayMatch[1];
              const day = parseInt(monthDayMatch[2]);
              
              const monthMap: { [key: string]: number } = {
                'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
                'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
              };
              
              const monthIndex = monthMap[monthAbbr.toLowerCase()];
              if (monthIndex !== undefined) {
                const currentYear = new Date().getFullYear();
                const tempDate = new Date(currentYear, monthIndex, day);
                
                // If date is in the past, assume next year
                if (tempDate < new Date()) {
                  parsedDate = new Date(currentYear + 1, monthIndex, day);
                } else {
                  parsedDate = tempDate;
                }
              }
            }
          }
          
          // Find the parent timeline section containing this date-title and its events
          let currentElement = dateTitleEl as Element;
          while (currentElement && currentElement !== timeline) {
            currentElement = currentElement.parentElement as Element;
            if (currentElement) {
              // Look for the timeline section that contains both the date-title and event cards
              const sectionCards = currentElement.querySelectorAll('.card-wrapper');
              if (sectionCards.length > 0) {
                // Map all cards in this section to the date
                sectionCards.forEach(card => {
                  eventDateMap.set(card, parsedDate);
                });
                break;
              }
            }
          }
        });
        
        // Process all event cards
        allEventCards.forEach((card) => {
          try {
            // Get the date for this event from the map, fallback to today
            const eventDate = eventDateMap.get(card) || new Date();
            
            // Extract event URL - look for the main event link
            const eventLinkEl = card.querySelector('a[href*="/"], a[href*="event"]');
            const eventUrl = eventLinkEl ? (eventLinkEl as HTMLAnchorElement).href : '';
            const fullEventUrl = eventUrl.startsWith('http') ? eventUrl : `https://luma.com${eventUrl}`;
            
            // Extract event title - look for the main title element
            const titleEl = card.querySelector('h3, h2, h1, [class*="title"]');
            const name = titleEl?.textContent?.trim() || '';
            
            // Extract time - look for time elements
            const timeEl = card.querySelector('[class*="event-time"] span, [class*="time"], [class*="time-info"]');
            const time = timeEl?.textContent?.trim() || '';
            
            // Extract organizer - look for "By [Name]" pattern in attribute elements
            let organizer = '';
            const organizerAttribute = card.querySelector('[class*="attribute"]:has(.text-ellipses)');
            if (organizerAttribute) {
              const organizerText = organizerAttribute.textContent?.trim() || '';
              const byMatch = organizerText.match(/By\s+(.+)/);
              organizer = byMatch ? byMatch[1] : organizerText;
            }
            
            // Extract location - look for attribute with location icon (SVG)
            let location = '';
            const locationAttribute = card.querySelector('[class*="attribute"]:has(svg)');
            if (locationAttribute) {
              const locationText = locationAttribute.querySelector('.text-ellipses')?.textContent?.trim() || '';
              location = locationText;
            }
            
            // Extract event image
            const imageEl = card.querySelector('img[alt*="Cover Image"], img[src*="event-covers"], img[src*="cdn-cgi"]');
            const imageUrl = imageEl ? (imageEl as HTMLImageElement).src : '';
            
            // Extract organizer image - look for avatar with background-image style
            let organizerImageUrl = '';
            const avatarEl = card.querySelector('[class*="avatar"][style*="background-image"]');
            if (avatarEl) {
              const style = avatarEl.getAttribute('style') || '';
              const match = style.match(/url\(["']?([^"']+)["']?\)/);
              if (match) {
                organizerImageUrl = match[1];
              }
            }
            
            // Clean up title (remove emojis as per user preference)
            const cleanTitle = name.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
            
            if (cleanTitle && cleanTitle.length > 3) {
              // Create source ID from title and date
              const sourceId = `${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${eventDate.toISOString().split('T')[0]}`;
              
              events.push({
                name: cleanTitle,
                description: `${cleanTitle} - ${pageCategory} event`,
                location: location || 'Location TBD',
                address: location, // Use location as address for now
                date: eventDate.toISOString(),
                time: time,
                category: pageCategory,
                event_type: pageCategory,
                organizer: organizer || 'Luma Community',
                organizer_website: 'https://luma.com',
                organizer_avatar_url: organizerImageUrl,
                image_url: imageUrl,
                external_url: fullEventUrl,
                event_url: fullEventUrl,
                source_id: sourceId,
                tags: [pageCategory]
              });
            }
          } catch (error) {
            console.error('Error parsing event card:', error);
          }
        });
        
        // If we didn't find many events through sections, try processing all cards directly
        if (events.length < 5) {
          console.log('Few events found through sections, trying direct card processing...');
          const allCards = timeline.querySelectorAll('.card-wrapper');
          console.log(`Found ${allCards.length} total cards to process directly`);
          
          allCards.forEach((card) => {
            try {
              // Extract event URL - look for the main event link
              const eventLinkEl = card.querySelector('a[href*="/"], a[href*="event"]');
              const eventUrl = eventLinkEl ? (eventLinkEl as HTMLAnchorElement).href : '';
              const fullEventUrl = eventUrl.startsWith('http') ? eventUrl : `https://luma.com${eventUrl}`;

              // Extract event title
              const titleEl = card.querySelector('h3, [class*="title"], .event-title');
              const name = titleEl ? titleEl.textContent?.trim() || '' : '';

              // Extract time
              const timeEl = card.querySelector('[class*="time"], .event-time span');
              const time = timeEl ? timeEl.textContent?.trim() || '' : '';

              // Extract location
              const locationEl = card.querySelector('[class*="location"], [class*="address"]');
              const location = locationEl ? locationEl.textContent?.trim() || '' : '';

              // Extract organizer
              const organizerEl = card.querySelector('[class*="organizer"], [class*="by"]');
              const organizer = organizerEl ? organizerEl.textContent?.trim() || '' : '';

              // Extract organizer image
              const organizerImageEl = card.querySelector('[class*="avatar"][style*="background-image"]');
              let organizerImageUrl = '';
              if (organizerImageEl) {
                const style = organizerImageEl.getAttribute('style') || '';
                const match = style.match(/url\(["']?([^"')]+)["']?\)/);
                if (match) {
                  organizerImageUrl = match[1];
                }
              }

              // Extract event image
              const imageEl = card.querySelector('img[src*="event-covers"], img[src*="event"]');
              const imageUrl = imageEl ? (imageEl as HTMLImageElement).src : '';

              // Clean up title (remove emojis as per user preference)
              const cleanTitle = name.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
              
              if (cleanTitle && cleanTitle.length > 3) {
                // Create source ID from title and date
                const sourceId = `${cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}`;
                
                events.push({
                  name: cleanTitle,
                  description: `${cleanTitle} - ${pageCategory} event`,
                  location: location || 'Location TBD',
                  address: location, // Use location as address for now
                  date: new Date().toISOString(),
                  time: time,
                  category: pageCategory,
                  event_type: pageCategory,
                  organizer: organizer || 'Luma Community',
                  organizer_website: 'https://luma.com',
                  organizer_avatar_url: organizerImageUrl,
                  image_url: imageUrl,
                  external_url: fullEventUrl,
                  event_url: fullEventUrl,
                  source_id: sourceId,
                  tags: [pageCategory]
                });
              }
            } catch (error) {
              console.error('Error parsing event card:', error);
            }
          });
        }
        
        console.log(`Found ${cardCount} total event cards and ${dateCount} date elements`);
        console.log(`Found ${events.length} events from cards`);
        
        
        // Deduplicate events by source_id
        const uniqueEvents = new Map();
        events.forEach(event => {
          if (!uniqueEvents.has(event.source_id)) {
            uniqueEvents.set(event.source_id, event);
          } else {
            console.log(`Removing duplicate event: ${event.name} (${event.source_id})`);
          }
        });
        
        const deduplicatedEvents = Array.from(uniqueEvents.values());
        console.log(`After deduplication: ${deduplicatedEvents.length} unique events`);
        
        // Collect debug information about what we found
        const debugInfo = {
          cardCount,
          dateCount,
          timelineTitlesCount: timelineTitles.length,
          selector1Count: dateTitleElements1.length,
          selector2Count: dateTitleElements2.length,
          selector3Count: dateTitleElements3.length,
          combinedCount: dateTitleElements.length,
          dateTitleElements: Array.from(dateTitleElements).map(el => ({
            text: (el as Element).textContent?.trim() || '',
            className: (el as Element).className,
            parentClassName: (el as Element).parentElement?.className || '',
            dateText: (el as Element).querySelector('[class*="date"]')?.textContent?.trim() || ''
          })),
          timelineTitles: Array.from(timelineTitles).map(el => ({
            text: el.textContent?.trim() || '',
            className: el.className,
            hasDate: !!el.querySelector('[class*="date"]'),
            hasWeekday: !!el.querySelector('[class*="weekday"]')
          })),
          allEventCards: Array.from(allEventCards).map(card => ({
            title: card.querySelector('h3, h2, h1, [class*="title"]')?.textContent?.trim() || '',
            hasLink: !!card.querySelector('a[href*="/"]'),
            className: card.className
          }))
        };
        
        return { events: deduplicatedEvents, debugInfo };
      }, url, category);
      
      const { events: scrapedEvents, debugInfo } = Array.isArray(events) ? { events, debugInfo: null } : events;
      
      console.log(`\n=== SCRAPING RESULTS for ${url} ===`);
      console.log(`  - Total event cards found: ${debugInfo?.cardCount || 'N/A'}`);
      console.log(`  - Timeline sections found: ${debugInfo?.timelineTitlesCount || 'N/A'}`);
      console.log(`  - Events extracted: ${scrapedEvents.length}`);
      console.log(`  - Date range covered: ${scrapedEvents.length > 0 ? 'Multiple dates' : 'No dates'}`);
      
      // Show date distribution
      const dateGroups = scrapedEvents.reduce((acc, event) => {
        const date = event.date || 'Unknown';
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log(`  - Events by date:`);
      Object.entries(dateGroups).forEach(([date, count]) => {
        console.log(`    ${date}: ${count} events`);
      });
      
      console.log(`\n=== DATE-TITLE ELEMENTS FOUND ===`);
      debugInfo?.dateTitleElements?.forEach((dateTitleEl, index) => {
        console.log(`  ${index + 1}. Text: "${dateTitleEl.text}" | Date: "${dateTitleEl.dateText}" | Class: "${dateTitleEl.className}" | Parent: "${dateTitleEl.parentClassName}"`);
      });
      
      console.log(`\n=== TIMELINE TITLES FOUND ===`);
      debugInfo?.timelineTitles?.forEach((title, index) => {
        console.log(`  ${index + 1}. Text: "${title.text}" | Class: "${title.className}" | Has Date: ${title.hasDate} | Has Weekday: ${title.hasWeekday}`);
      });
      
      console.log(`\n=== EVENT CARDS FOUND ===`);
      debugInfo?.allEventCards?.forEach((card, index) => {
        console.log(`  ${index + 1}. Title: "${card.title}" | Has Link: ${card.hasLink} | Class: "${card.className}"`);
      });
      
      console.log(`\n=== EXTRACTED EVENTS ===`);
      scrapedEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. "${event.name}" | Date: ${event.date} | Time: ${event.time}`);
      });
      
      return scrapedEvents.map((event, index) => ({
        ...event,
        id: `luma-${category}-${Date.now()}-${index}`,
        source: 'luma' as const,
        currency: 'USD',
        max_capacity: null,
        price: null
      }));
      
    } catch (error) {
      console.error(`Error scraping ${url}:`, error);
      return [];
    } finally {
      await page.close();
    }
  }

}

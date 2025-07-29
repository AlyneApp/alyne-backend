import puppeteer, { Browser, Page } from 'puppeteer';
import chromium from '@sparticuz/chromium';

export interface ScrapedClass {
  id: string;
  name: string;
  description: string;
  duration: number | null;
  difficulty_level: string | null;
  class_type: string | null;
  max_capacity: number | null;
  price: number | null;
  start_time?: string;
  end_time?: string;
  instructor?: string | null;
  is_available?: boolean;
  total_booked?: number;
  source: 'web_scraping' | 'database';
}

export interface ScrapingConfig {
  studioName: string;
  websiteUrl: string;
  studioAddress?: string; // Add studio address for filtering
  selectors?: {
    classContainer?: string;
    className?: string;
    classTime?: string;
    classInstructor?: string;
    classDuration?: string;
    classPrice?: string;
    classCapacity?: string;
    classType?: string;
    difficultyLevel?: string;
  };
  customScrapingFunction?: (page: Page, date?: string, address?: string) => Promise<ScrapedClass[]>;
}

export class WebScraper {
  private browser: Browser | null = null;
  
  // Helper function to delay execution (replaces waitForTimeout)
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Helper function to parse date strings properly and avoid timezone issues
  private static parseDateSafely(dateString: string): { targetDate: Date; targetDateString: string; targetDateFormats: string[] } {
    console.log(`📅 Original date parameter: ${dateString}`);
    
    let targetDate: Date;
    if (typeof dateString === 'string' && dateString.includes('-')) {
      // If it's a date string like "2025-07-25", parse it as UTC to avoid timezone shifts
      const [year, month, day] = dateString.split('-').map(Number);
      targetDate = new Date(year, month - 1, day); // month is 0-indexed
      console.log(`📅 Parsed date string as UTC: ${year}-${month}-${day}`);
    } else {
      targetDate = new Date(dateString);
      console.log(`📅 Parsed date using default constructor`);
    }
    
    console.log(`📅 Parsed date object: ${targetDate.toISOString()}`);
    console.log(`📅 Date components: year=${targetDate.getFullYear()}, month=${targetDate.getMonth()}, day=${targetDate.getDate()}`);
    
    const targetMonth = targetDate.getMonth() + 1; // getMonth() returns 0-11
    const targetDay = targetDate.getDate();
    const targetDateString = `${targetMonth.toString().padStart(2, '0')}/${targetDay.toString().padStart(2, '0')}`;
    
    // Create multiple date formats for different studio types
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayName = dayNames[targetDate.getDay()];
    const monthName = monthNames[targetMonth - 1];
    
    const targetDateFormats = [
      targetDateString, // "07/25" - for Solidcore
      `${dayName}, ${monthName} ${targetDay}`, // "Fri, Jul 25" - for CorePower
      `${monthName} ${targetDay}`, // "Jul 25" - alternative format
      `${targetDay}`, // "25" - just the day
      targetDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) // "Fri, Jul 25"
    ];
    
    console.log(`📅 Target date formats: [${targetDateFormats.join(', ')}]`);
    
    return { targetDate, targetDateString, targetDateFormats };
  }

  async init() {
    if (!this.browser) {
      // Check if we're in a serverless environment (Vercel)
      const isServerless = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';
      
      if (isServerless) {
        // Use serverless-compatible Chromium for Vercel
        const executablePath = await chromium.executablePath();
        
        this.browser = await puppeteer.launch({
          args: chromium.args,
          executablePath,
          headless: true,
        });
      } else {
        // Use regular Puppeteer for local development
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

  static getScrapingConfig(studioName: string, websiteUrl: string, studioAddress?: string): ScrapingConfig | null {
    // Universal scraper for all studio booking sites
    // Only exclude iframes and 3rd party booking platforms
    const url = websiteUrl.toLowerCase();
    
    console.log(`🔍 Configuring scraper for studio: "${studioName}" with URL: "${websiteUrl}" and address: "${studioAddress}"`);
    
    // Check for iframe-based booking systems
    if (url.includes('mindbody') || url.includes('zenplanner') || url.includes('wellnessliving')) {
      console.log('⚠️ Detected 3rd party booking platform, skipping web scraping');
      return null;
    }
    
    // Special handling for marianaiframes.com platform (Barry's, SLT, etc.)
    if (url.includes('marianaiframes.com')) {
      console.log('🎯 Detected marianaiframes.com platform, using Barry\'s table scraper');
      return {
        studioName,
        websiteUrl, // Use the booking_site URL from the database
        studioAddress, // Pass studio address for filtering
        customScrapingFunction: WebScraper.barrysTableScraping
      };
    }
    
    // Special handling for CorePower Yoga
    if (studioName.toLowerCase().includes('corepower') || url.includes('corepower.com')) {
      console.log('🧘 Detected CorePower Yoga studio, using enhanced universal scraper');
      return {
        studioName,
        websiteUrl,
        studioAddress, // Pass studio address for filtering
        customScrapingFunction: WebScraper.universalStudioScraping
      };
    }
    
    // Universal configuration for all other studio sites
    console.log('🌐 Using universal scraper for studio:', studioName);
    return {
      studioName,
      websiteUrl,
      studioAddress, // Pass studio address for filtering
      customScrapingFunction: WebScraper.universalStudioScraping
    };
  }

  async scrapeClasses(config: ScrapingConfig, date?: string): Promise<ScrapedClass[]> {
    try {
      // Add timeout mechanism
      const timeoutPromise = new Promise<ScrapedClass[]>((_, reject) => {
        setTimeout(() => reject(new Error('Scraping timeout after 45 seconds')), 45000);
      });

      const scrapingPromise = this._scrapeClasses(config, date);
      
      return await Promise.race([scrapingPromise, timeoutPromise]);
    } catch (error) {
      console.log('❌ Scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  private async _scrapeClasses(config: ScrapingConfig, date?: string): Promise<ScrapedClass[]> {
    await this.init();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      console.log('🚀 Ultra-fast scraping for:', config.websiteUrl);
      console.log('📅 Target date:', date);
      
      // Optimize page loading
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      // Navigate with faster timeout and less waiting
      await page.goto(config.websiteUrl, { 
        waitUntil: 'domcontentloaded', // Faster than 'networkidle'
        timeout: 15000 // Reduced timeout
      });
      
      // Wait for any class-related elements to appear (more flexible)
      try {
        await page.waitForSelector('[class*="schedule"], [class*="class"], .schedule-item, .class-item, .workout-item', { timeout: 5000 });
      } catch {
        console.log('⚠️ No specific class elements found, continuing anyway...');
      }
      
      let classes: ScrapedClass[] = [];
      
      // Use custom scraping function if available
      if (config.customScrapingFunction) {
        classes = await config.customScrapingFunction(page, date, config.studioAddress);
      } else {
        // Use generic scraping with selectors
        classes = await WebScraper.genericScraping(page, config.selectors || {});
      }
      
      console.log(`✅ Extracted ${classes.length} classes in ultra-fast mode`);
      return classes;
      
    } catch (error) {
      console.error('❌ Web scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    } finally {
      await this.close();
    }
  }

  // Universal studio scraping function - works for all studio booking sites
  static async universalStudioScraping(page: Page, date?: string, studioAddress?: string): Promise<ScrapedClass[]> {
    console.log('🌐 Universal studio scraping for:', page.url());
    console.log('🌐 Studio address for filtering:', studioAddress);
    
    try {
      // If no date specified, return empty array
      if (!date) {
        console.log('❌ No date specified, returning empty array');
        return [];
      }
      
      // Parse the date
      const { targetDateString, targetDateFormats } = WebScraper.parseDateSafely(date);
      console.log(`📅 Looking for classes on: ${targetDateString}`);
      console.log(`📅 Using date formats: [${targetDateFormats.join(', ')}]`);
      
      // Try to navigate to the specific date for Solidcore
      let targetDateTextContent = '';
      try {
        // Look for date navigation elements
        const dateElements = await page.$$('[class*="date"], [class*="day"], .schedule-day-header-date');
        console.log(`🔍 Found ${dateElements.length} date elements`);
        
        // Try to find and click the target date
        let targetDateFound = false;
        for (const element of dateElements) {
          const elementText = await page.evaluate(el => el.textContent, element);
          console.log(`🔍 Date element: "${elementText}"`);
          
          // Check against all possible date formats
          if (elementText && targetDateFormats.some(format => elementText.trim().includes(format))) {
            console.log(`✅ Found target date element: ${elementText}`);
            targetDateTextContent = elementText;
            await page.evaluate((el) => (el as HTMLElement).click(), element);
            targetDateFound = true;
            await WebScraper.delay(500); // Reduced from 2000ms
            break;
          }
        }
        
        if (!targetDateFound) {
          console.log('⚠️ Target date not found, using current page data');
        }
      } catch (error) {
        console.log('⚠️ Date navigation failed:', error instanceof Error ? error.message : 'Unknown error');
      }
      
      // UNIVERSAL SCRAPING: Handle multiple studio types including CorePower Yoga
      const classes = await page.$$eval(
        'body',
        (body, evalInfo) => {
          const { targetDate, targetDateFormats, studioAddress, targetDateTextContent } = evalInfo;
          console.log('🔍 Analyzing page structure for universal scraping...');
          
          // For Solidcore, look for the specific date container
          const scheduleDays = document.querySelectorAll('.schedule-day');
          console.log(`🔍 Found ${scheduleDays.length} schedule days`);
          
          let targetDateClasses: Element[] = [];
          let targetDateText = targetDateTextContent || '';
          
          if (targetDateText) {
            console.log(`📝 Using pre-captured date text content: "${targetDateText.substring(0, 200)}..."`);
          }
          
          for (const day of scheduleDays) {
            const dateHeader = day.querySelector('.schedule-day-header-date');
            if (dateHeader) {
              const dateText = dateHeader.textContent?.trim();
              console.log(`🔍 Checking schedule day: "${dateText}" vs target: "${targetDate}"`);
              
              if (dateText && targetDateFormats.some(format => dateText.includes(format))) {
                console.log(`✅ Found target date container for ${targetDate}`);
                // Get all class elements within this specific date container
                const dayClasses = day.querySelectorAll('li.class');
                console.log(`✅ Found ${dayClasses.length} classes in target date container`);
                targetDateClasses = Array.from(dayClasses);
                
                // Also get the full text content of the date element for text-based parsing
                const fullDateElement = day.querySelector('[class*="date"], [class*="day"], .schedule-day-header-date');
                if (fullDateElement) {
                  targetDateText = fullDateElement.textContent || '';
                  console.log(`📝 Found date text content: "${targetDateText.substring(0, 200)}..."`);
                }
                break;
              }
            }
          }

          // If we didn't find classes in the schedule days, try to get text content from the date element we found
          if (targetDateText === '') {
            // Look for any element that contains our target date and class information
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
              const text = el.textContent?.trim() || '';
              if (text && targetDateFormats.some(format => text.includes(format))) {
                // Check if this element contains class information (has "Studio" in it)
                if (text.includes('Studio') && text.includes('|') && text.includes('min')) {
                  targetDateText = text;
                  console.log(`📝 Found target date text content: "${targetDateText.substring(0, 200)}..."`);
                  break;
                }
              }
            }
          }
          
          // For CorePower Yoga, look for session-row-view containers
          const corePowerClasses = document.querySelectorAll('.session-row-view');
          console.log(`🔍 Found ${corePowerClasses.length} CorePower session rows`);
          
          // If we found classes for the target date, use those; otherwise, use all classes
          let classElements = targetDateClasses.length > 0 ? targetDateClasses : [];
          
          // If no Solidcore classes found, try CorePower classes
          if (classElements.length === 0 && corePowerClasses.length > 0) {
            classElements = Array.from(corePowerClasses);
            console.log(`✅ Using ${classElements.length} CorePower classes`);
            
            // Debug: Log the first few CorePower classes to see their structure
            for (let i = 0; i < Math.min(3, classElements.length); i++) {
              const classEl = classElements[i];
              const className = classEl.querySelector('.session-card_sessionName__EKrdk')?.textContent?.trim();
              const classTime = classEl.querySelector('.session-card_sessionTime__hNAfR')?.textContent?.trim();
              const classInstructor = classEl.querySelector('.session-card_sessionTeacher__tFtaz')?.textContent?.trim();
              const classStudio = classEl.querySelector('.session-card_sessionStudio__yRE6h')?.textContent?.trim();
              console.log(`🔍 CorePower class ${i + 1}: "${className}" at "${classTime}" with "${classInstructor}" at "${classStudio}"`);
            }
          }
          
          // If we have text content but no HTML elements, parse the text for classes
          if (classElements.length === 0 && targetDateText) {
            console.log('🔍 No HTML class elements found, parsing text content for classes');
            console.log(`📝 Full date text content: "${targetDateText}"`);
            
            // Parse the text content to extract classes
            // Updated regex to better match the actual format from logs
            const classMatches = targetDateText.match(/Studio \d+ \| ([^|\n]+)\s*\n\s*(\d{1,2}:\d{2}(?:am|pm)) - (\d{1,2}:\d{2}(?:am|pm)) \((\d+) min\)\s*\n\s*([^.\n]+)\.(\d+) of (\d+) open (Reserve|Waitlist)/g);
            
            console.log(`🔍 Regex matches found: ${classMatches ? classMatches.length : 0}`);
            if (classMatches) {
              classMatches.forEach((match, i) => {
                console.log(`🔍 Match ${i + 1}: "${match}"`);
              });
            }
            
            if (classMatches && classMatches.length > 0) {
              console.log(`✅ Found ${classMatches.length} classes in text content`);
              
              // Create virtual elements for text-based classes
              classElements = classMatches.map((match, index) => {
                const virtualElement = document.createElement('div');
                virtualElement.setAttribute('data-class-index', index.toString());
                virtualElement.setAttribute('data-class-text', match);
                
                // Extract class details from the match
                const parts = match.match(/Studio \d+ \| ([^|\n]+)\s*\n\s*(\d{1,2}:\d{2}(?:am|pm)) - (\d{1,2}:\d{2}(?:am|pm)) \((\d+) min\)\s*\n\s*([^.\n]+)\.(\d+) of (\d+) open (Reserve|Waitlist)/);
                if (parts) {
                  const className = parts[1].trim();
                  const startTime = parts[2];
                  const endTime = parts[3];
                  const duration = parts[4];
                  const instructor = parts[5].trim();
                  const booked = parts[6];
                  const capacity = parts[7];
                  const status = parts[8];
                  
                  console.log(`🔍 Parsed class ${index + 1}: "${className}" at "${startTime} - ${endTime}" with "${instructor}"`);
                  
                  virtualElement.innerHTML = `
                    <div class="class-name">${className}</div>
                    <div class="class-time">${startTime} - ${endTime}</div>
                    <div class="class-duration">${duration} min</div>
                    <div class="class-instructor">${instructor}</div>
                    <div class="class-capacity">${booked} of ${capacity} open ${status}</div>
                  `;
                } else {
                  console.log(`❌ Failed to parse match: "${match}"`);
                }
                
                return virtualElement;
              });
            } else {
              // Try a simpler regex pattern
              console.log('🔍 Trying simpler regex pattern...');
              const simpleMatches = targetDateText.match(/Studio \d+ \| ([^|\n]+)/g);
              console.log(`🔍 Simple matches: ${simpleMatches ? simpleMatches.length : 0}`);
              if (simpleMatches) {
                simpleMatches.forEach((match, i) => {
                  console.log(`🔍 Simple match ${i + 1}: "${match}"`);
                });
              }
            }
          }
          
          // If still no classes found, try to get all available classes
          if (classElements.length === 0) {
            console.log('⚠️ No classes found for target date, trying to get all available classes');

            // Try different selectors for class elements
            const allClassSelectors = [
              '.class', '.schedule-item', '.class-item', '.workout-item',
              '.session-row-view', '.session-card', '.class-card',
              '[class*="class"]', '[class*="session"]', '[class*="workout"]'
            ];

            for (const selector of allClassSelectors) {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                classElements = Array.from(elements);
                console.log(`✅ Found ${classElements.length} classes using selector: ${selector}`);
                break;
              }
            }

            // If still no classes, try to get any elements that might contain class information
            if (classElements.length === 0) {
              console.log('⚠️ No specific class elements found, trying to extract from page content');
              // This will be handled in the extraction logic below
            }
          }
          
          // Extract class data with flexible selectors
          return classElements.map((el, index) => {
            console.log(`🔍 Processing class element ${index + 1}:`, el.outerHTML ? el.outerHTML.substring(0, 200) + '...' : 'No HTML');
            
            // Enhanced selectors for CorePower Yoga
            const nameSelectors = [
              // CorePower specific
              '.session-card_sessionName__EKrdk', '.session-title-link',
              // Barry's specific
              '.ButtonLabel-sc-vvc4oq',
              // Universal
              '.class-name', '.name', '[class*="name"]',
              'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              '.title', '[class*="title"]',
              '.workout-name', '.session-name'
            ];
            
            // Enhanced selectors for time
            const timeSelectors = [
              // CorePower specific
              '.session-card_sessionTime__hNAfR', '.session-time',
              // Barry's specific
              '.BoldLabel-sc-ha1dsk',
              // Universal
              '.class-time', '.time', '[class*="time"]',
              '.schedule-time', '.start-time',
              '.workout-time', '.session-time'
            ];
            
            // Enhanced selectors for instructor
            const instructorSelectors = [
              // CorePower specific
              '.session-card_sessionTeacher__tFtaz', '.session-teacher',
              // Barry's specific
              '.ButtonLabel-sc-vvc4oq',
              // Universal
              '.class-teacher', '.instructor', '[class*="instructor"]',
              '.teacher', '[class*="teacher"]',
              '.trainer', '[class*="trainer"]',
              '.coach', '[class*="coach"]',
              'p[class*="LineItem"]', 'p.fKKBMd'
            ];
            
            // Enhanced selectors for duration
            const durationSelectors = [
              // Barry's specific
              '.StyledMeta-sc-1tw3zxx',
              // Universal
              '.class-duration', '.duration', '[class*="duration"]',
              '.length', '[class*="length"]',
              '.workout-duration', '.session-duration'
            ];
            
            // Enhanced selectors for studio/location
            const studioSelectors = [
              // CorePower specific
              '.session-card_sessionStudio__yRE6h', '.session-studio',
              // Universal
              '.studio', '[class*="studio"]',
              '.location', '[class*="location"]'
            ];
            
            // Extract data using flexible selectors
            let name = null;
            let time = '';
            let instructor = '';
            let duration = '';
            let studio = '';
            
            // Extract class name
            for (const selector of nameSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                name = element.textContent.trim();
                console.log(`✅ Found name with selector "${selector}": "${name}"`);
                break;
              }
            }
            
            // Extract time
            for (const selector of timeSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                time = element.textContent.trim();
                console.log(`✅ Found time with selector "${selector}": "${time}"`);
                break;
              }
            }
            
            // Extract instructor
            for (const selector of instructorSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                instructor = element.textContent.trim();
                console.log(`✅ Found instructor with selector "${selector}": "${instructor}"`);
                break;
              }
            }
            
            // Extract duration
            for (const selector of durationSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                duration = element.textContent.trim();
                console.log(`✅ Found duration with selector "${selector}": "${duration}"`);
                break;
              }
            }
            
            // Extract studio/location
            for (const selector of studioSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                studio = element.textContent.trim();
                console.log(`✅ Found studio with selector "${selector}": "${studio}"`);
                break;
              }
            }
            
            console.log(`🔍 Extracted data for class ${index + 1}: name="${name}", time="${time}", instructor="${instructor}", duration="${duration}"`);
            
            // LOCATION FILTERING: Filter by studio address if provided
            if (studioAddress && studio) {
              console.log(`🔍 Checking location filter - Studio address: "${studioAddress}", Class location: "${studio}"`);
              
              // Extract location keywords from studio address (e.g., "UES - 85th and Lex" from full address)
              const addressLower = studioAddress.toLowerCase();
              const studioLower = studio.toLowerCase();
              
              console.log(`🔍 Address lower: "${addressLower}", Studio lower: "${studioLower}"`);
              
              // Check if the class location matches any part of the studio address
              const addressWords = addressLower.split(/[,\s]+/).filter(word => word.length > 2);
              const studioWords = studioLower.split(/[,\s]+/).filter(word => word.length > 2);
              
              console.log(`🔍 Address words: [${addressWords.join(', ')}], Studio words: [${studioWords.join(', ')}]`);
              
              const hasMatchingLocation = addressWords.some(addrWord => 
                studioWords.some(studioWord => 
                  addrWord.includes(studioWord) || studioWord.includes(addrWord)
                )
              );
              
              console.log(`🔍 Has matching location: ${hasMatchingLocation}`);
              
              if (!hasMatchingLocation) {
                console.log(`❌ Skipping class - location "${studio}" doesn't match studio address "${studioAddress}"`);
                return null;
              }
              
              console.log(`✅ Class location "${studio}" matches studio address "${studioAddress}"`);
            } else {
              console.log(`⚠️ No location filtering - studioAddress: "${studioAddress}", studio: "${studio}"`);
            }
            
            // Fallback: if no name found, try to get any text content
            if (!name) {
              const textContent = el.textContent?.trim();
              if (textContent && textContent.length < 100 && textContent.length > 3) {
                // Avoid navigation elements like "Schedule", "Book Now", etc.
                const lowerText = textContent.toLowerCase();
                if (!lowerText.includes('schedule') && 
                    !lowerText.includes('book') && 
                    !lowerText.includes('menu') && 
                    !lowerText.includes('nav') &&
                    !lowerText.includes('header') &&
                    !lowerText.includes('footer')) {
                  name = textContent.split('\n')[0].trim(); // First line as name
                  console.log(`✅ Fallback name from text content: "${name}"`);
                }
              }
            }
            
            // FLEXIBLE DATE VALIDATION: Be more lenient with date matching
            
            // For Solidcore: If we found classes in the target date container, they're already filtered
            if (targetDateClasses.length > 0 && targetDateClasses.includes(el)) {
              console.log(`✅ Class confirmed to be in target date container: "${name}"`);
            } else if (corePowerClasses.length > 0) {
              // For CorePower: Find the specific date section this class belongs to
              let currentParent = el.parentElement;
              let foundDateSection = false;
              
              // Walk up the DOM tree to find the date section
              while (currentParent && currentParent !== document.body) {
                // Look for date headers in this parent
                const dateHeaders = currentParent.querySelectorAll('.schedule-list__date, .days-bar, [class*="date"], [class*="day"]');
                
                for (const header of dateHeaders) {
                  const headerText = header.textContent?.trim();
                  console.log(`🔍 Checking date header: "${headerText}" against formats: [${targetDateFormats.join(', ')}]`);
                  
                  // Check if this header exactly matches one of our target date formats
                  if (headerText && targetDateFormats.some(format => {
                    // For CorePower, we need exact or very close matches
                    return headerText === format || 
                           headerText.includes(format) && 
                           (format.length > 3 || headerText.split(' ').some(word => word === format));
                  })) {
                    console.log(`✅ Found exact date match: "${headerText}" for class "${name}"`);
                    foundDateSection = true;
                    break;
                  }
                }
                
                if (foundDateSection) break;
                currentParent = currentParent.parentElement;
              }
              
              // If we didn't find a date section, this class is not for our target date
              if (!foundDateSection) {
                console.log(`❌ Skipping class - no date section found for target date ${targetDate}: "${name}"`);
                return null;
              }
            } else {
              // For other sites, be more flexible with date matching
              let parent = el.parentElement;
              let foundDateMatch = false;
              
              while (parent && parent !== document.body) {
                const parentText = parent.textContent || '';
                
                // Check for exact date matches in parent text
                if (parentText && targetDateFormats.some(format => {
                  return parentText.includes(format) && 
                         (format.length > 3 || parentText.split(' ').some(word => word === format));
                })) {
                  foundDateMatch = true;
                  console.log(`✅ Found exact date match in parent: "${parentText.substring(0, 50)}..."`);
                  break;
                }
                
                // Check for date headers
                const dateHeaders = parent.querySelectorAll('.schedule-day-header-date, [class*="date"], [class*="day"]');
                for (const header of dateHeaders) {
                  const headerText = header.textContent?.trim();
                  if (headerText && targetDateFormats.some(format => headerText === format || headerText.includes(format))) {
                    foundDateMatch = true;
                    console.log(`✅ Found exact date header: "${headerText}"`);
                    break;
                  }
                }
                
                if (foundDateMatch) break;
                parent = parent.parentElement;
              }
              
              // If no exact date match found, but we have classes, include them anyway
              // This handles cases where the target date is not available but other dates are
              if (!foundDateMatch) {
                console.log(`⚠️ No exact date match found for target date ${targetDate}, but including class anyway: "${name}"`);
              }
            }
            
            console.log(`✅ Including class for target date ${targetDate}: "${name}" at "${time}" with "${instructor}" at "${studio}"`);
            
            return {
              name,
              time,
              instructor,
              duration,
              studio,
              price: '',
              classDate: targetDate
            };
          }).filter(Boolean); // Remove null entries
        },
        { targetDate: targetDateString, targetDateFormats, studioAddress, targetDateTextContent: targetDateTextContent || '' }
      );
      
      console.log(`✅ Found ${classes.length} classes using universal scraper`);
      
      if (classes.length === 0) {
        console.log(`📅 No classes found for date ${targetDateString} (${targetDateFormats.join(', ')})`);
        console.log(`📅 Studio address filter: ${studioAddress || 'none'}`);
        console.log(`📅 This could mean: 1) No classes scheduled for this date, 2) Date format mismatch, 3) Page structure changed, 4) Location filtering removed all classes`);
      }
      
      // Convert to ScrapedClass format
      return classes
        .filter((classData): classData is NonNullable<typeof classData> => classData !== null)
        .map((classData, index) => ({
          id: `universal-${Date.now()}-${index}`,
          name: classData.name || `Class ${index + 1}`,
          description: `${classData.name || 'Studio'} class${classData.studio ? ` at ${classData.studio}` : ''}`,
          duration: WebScraper.extractDuration(classData.duration),
          difficulty_level: WebScraper.extractDifficulty(classData.name || ''),
          class_type: WebScraper.extractClassType(classData.name || ''),
          max_capacity: null,
          price: WebScraper.extractPrice(classData.price),
          start_time: classData.time,
          instructor: classData.instructor || null,
          is_available: true,
          total_booked: 0,
          source: 'web_scraping' as const
        }));
      
    } catch (error) {
      console.log('❌ Universal scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  // Barry's table scraping function - targets the table structure
  static async barrysTableScraping(page: Page, date?: string, studioAddress?: string): Promise<ScrapedClass[]> {
    console.log('🎯 Barry\'s table scraping for:', page.url());
    console.log('🎯 Barry\'s table scraping - this function is being called!');
    console.log('🎯 Studio address for filtering:', studioAddress);
    
    try {
      // If no date specified, return empty array
      if (!date) {
        console.log('❌ No date specified, returning empty array');
        return [];
      }
      
      // Parse the date
      const { targetDate, targetDateString } = WebScraper.parseDateSafely(date);
      console.log(`📅 Looking for classes on: ${targetDateString}`);
      
      // Wait for the page to fully load
      await WebScraper.delay(2000); // Reduced from 5000ms
      
      // Try to wait for date buttons to be available
      try {
        await page.waitForSelector('button[data-test-date-button]', { timeout: 10000 });
      } catch {
        console.log('⚠️ Date buttons not found after waiting, continuing anyway...');
      }
      
      // Try to navigate to the specific date
      let dateNavigationSuccessful = false;
      try {
        // First, try to close any modal dialogs that might be blocking clicks
        try {
          const modalCloseButtons = await page.$$('[aria-label="Close"], .close, .modal-close, [data-testid="close"], button[aria-label*="close" i]');
          for (const closeButton of modalCloseButtons) {
            try {
              await page.evaluate((el) => (el as HTMLElement).click(), closeButton);
              console.log('✅ Closed modal dialog');
              await WebScraper.delay(500); // Reduced from 1000ms
            } catch {
              // Ignore errors for individual close attempts
            }
          }
        } catch {
          console.log('⚠️ No modal close buttons found or failed to close modals');
        }

        // Look for date navigation buttons
        const dateButtons = await page.$$('button[data-test-date-button]');
        console.log(`🔍 Found ${dateButtons.length} date buttons`);
        
        // Log all date buttons for debugging
        for (let i = 0; i < dateButtons.length; i++) {
          const buttonText = await page.evaluate(el => el.textContent, dateButtons[i]);
          const buttonDate = await page.evaluate((el) => el.getAttribute('data-test-date-button'), dateButtons[i]);
          console.log(`🔍 Date button ${i}: "${buttonText}" (${buttonDate})`);
        }
        
        // Find the target date button
        let targetDateButton = null;
        const targetDay = targetDate.getDate().toString();
        console.log(`🔍 Looking for target day: ${targetDay}`);
        
        for (const button of dateButtons) {
          const buttonDate = await page.evaluate((el) => el.getAttribute('data-test-date-button'), button);
          
          // Check if this button matches our target date
          if (buttonDate && (buttonDate.includes(targetDay) || buttonDate.includes(`active-${targetDay}`))) {
            console.log(`✅ Found target date button: ${buttonDate}`);
            targetDateButton = button;
            break;
          }
        }
        
        // Try to click the target date button with different strategies
        if (targetDateButton) {
          try {
            // Strategy 1: Try direct click
            await page.evaluate((el) => (el as HTMLElement).click(), targetDateButton);
            console.log('✅ Successfully clicked date button');
            await WebScraper.delay(750); // Reduced from 1500ms
            dateNavigationSuccessful = true;
          } catch {
            try {
              // Strategy 2: Try JavaScript click
              await page.evaluate((el) => {
                if (el && 'click' in el) {
                  (el as HTMLElement).click();
                }
              }, targetDateButton);
              console.log('✅ Successfully clicked date button via JavaScript');
              await WebScraper.delay(750); // Reduced from 1500ms
              dateNavigationSuccessful = true;
            } catch {
              try {
                // Strategy 3: Try keyboard navigation
                await page.evaluate((el) => (el as HTMLElement).focus(), targetDateButton);
                await page.keyboard.press('Enter');
                console.log('✅ Successfully navigated via keyboard');
                await WebScraper.delay(750); // Reduced from 1500ms
                dateNavigationSuccessful = true;
              } catch {
                console.log('❌ All date navigation strategies failed');
              }
            }
          }
        } else {
          console.log('⚠️ Target date button not found');
        }
      } catch {
        console.log('⚠️ Date navigation failed');
      }

    // NEW: Filter by location/room BEFORE class extraction to improve performance
    if (studioAddress && dateNavigationSuccessful) {
      console.log(`🔍 Filtering by location: "${studioAddress}"`);
      try {
        // Wait for the page to load after date selection
        await WebScraper.delay(1000);
        
        // Look for and click the "Rooms" or "Location" filter button
        const roomFilterSelectors = [
          'button[data-test-dropdown-button="rooms"]', // Exact match for the Rooms button
          'button[data-test-button*="room"]',
          'button[data-test-button*="location"]',
          'button[data-test-button*="filter"]',
          '.room-filter',
          '.location-filter',
          '[class*="room"]',
          '[class*="location"]'
        ];
        
        let roomFilterClicked = false;
        for (const selector of roomFilterSelectors) {
          try {
            const roomButton = await page.$(selector);
            if (roomButton) {
              console.log(`✅ Found room filter button with selector: "${selector}"`);
              
              // Try to click the button
              await page.evaluate((el) => (el as HTMLElement).click(), roomButton);
              console.log(`✅ Clicked room filter button`);
              
              // Wait for the dropdown to appear
              await WebScraper.delay(1000);
              
              // Check if the dropdown actually appeared by looking for the ul with location options
              const dropdownUl = await page.$('ul.StyledListNavigation-sc-85emb3');
              if (dropdownUl) {
                console.log(`✅ Dropdown appeared after clicking Rooms button`);
                roomFilterClicked = true;
                break;
              } else {
                console.log(`⚠️ Dropdown did not appear after clicking Rooms button, trying next selector`);
              }
            }
          } catch (error) {
            console.log(`⚠️ Error with selector "${selector}": ${error instanceof Error ? error.message : 'Unknown error'}`);
            // Continue to next selector
          }
        }
        
        if (roomFilterClicked) {
          // Wait for the dropdown to fully open
          await WebScraper.delay(1000);
          
          // DEBUG: Log all elements we can find after clicking Rooms button
          console.log('🔍 DEBUG: Looking for location options after clicking Rooms button...');
          
          // First, let's see what li elements exist
          const allLiElements = await page.$$eval(
            'li',
            (elements) => {
              return elements.map((el, index) => ({
                index,
                tagName: el.tagName,
                className: el.className,
                textContent: el.textContent?.trim().substring(0, 100) || '',
                attributes: Array.from(el.attributes).map(attr => `${attr.name}="${attr.value}"`).join(' ')
              }));
            }
          );
          console.log(`🔍 DEBUG: Found ${allLiElements.length} li elements:`, allLiElements.slice(0, 5)); // Show first 5
          
          // Now look for elements with data-test-checkbox-label
          const checkboxElements = await page.$$eval(
            '[data-test-checkbox-label]',
            (elements) => {
              return elements.map((el, index) => ({
                index,
                tagName: el.tagName,
                className: el.className,
                checkboxLabel: el.getAttribute('data-test-checkbox-label'),
                textContent: el.textContent?.trim().substring(0, 100) || ''
              }));
            }
          );
          console.log(`🔍 DEBUG: Found ${checkboxElements.length} elements with data-test-checkbox-label:`, checkboxElements);
          
          // Now look for the specific location option using the correct selectors
          try {
            const locationOptions = await page.$$eval(
              'ul.StyledListNavigation-sc-85emb3 div[data-test-checkbox-label]',
              (elements, targetLocation) => {
                return elements.map(el => {
                  const checkboxLabel = el.getAttribute('data-test-checkbox-label');
                  if (!checkboxLabel) return null;
                  
                  const lowerText = checkboxLabel.toLowerCase();
                  const targetLower = targetLocation.toLowerCase();
                  
                  // Check if this option matches our studio address
                  if (lowerText.includes(targetLower) || 
                      targetLower.includes(lowerText) ||
                      lowerText.includes('flatiron') && targetLower.includes('flatiron')) {
                    return {
                      element: el,
                      text: checkboxLabel,
                      matchScore: lowerText === targetLower ? 100 : 
                                 lowerText.includes(targetLower) ? 80 : 60
                    };
                  }
                  return null;
                }).filter((item): item is NonNullable<typeof item> => item !== null)
                  .sort((a, b) => b.matchScore - a.matchScore);
              },
              studioAddress
            );
            
            if (locationOptions && locationOptions.length > 0) {
              const bestMatch = locationOptions[0];
              console.log(`✅ Found location option: "${bestMatch.text}" (score: ${bestMatch.matchScore})`);
              
              // Click the checkbox input specifically
              try {
                const checkboxInput = await page.$(`input[data-test-checkbox="${bestMatch.text}"]`);
                if (checkboxInput) {
                  await page.evaluate((el) => (el as HTMLElement).click(), checkboxInput);
                  console.log(`✅ Clicked checkbox input for "${bestMatch.text}"`);
                } else {
                  // Fallback to clicking the element itself
                  await page.evaluate((el) => (el as HTMLElement).click(), bestMatch.element);
                  console.log(`✅ Clicked location element for "${bestMatch.text}"`);
                }
              } catch (clickError) {
                console.log(`⚠️ Failed to click location option: ${clickError instanceof Error ? clickError.message : 'Unknown error'}`);
              }
              
              await WebScraper.delay(1000); // Wait for filter to apply
              console.log(`✅ Successfully filtered by location: "${bestMatch.text}"`);
            } else {
              console.log(`⚠️ No location filter options found for "${studioAddress}", proceeding without filtering`);
            }
          } catch (locationError) {
            console.log(`⚠️ Location options parsing failed: ${locationError instanceof Error ? locationError.message : 'Unknown error'}, proceeding without filtering`);
          }
        } else {
          console.log(`⚠️ No room filter button found, proceeding without location filtering`);
        }
      } catch (error) {
        console.log(`⚠️ Location filtering failed: ${error instanceof Error ? error.message : 'Unknown error'}, proceeding without filtering`);
      }
    }
    
    let classes = [];
    
    try {
      // Add timeout to page.$$eval to prevent hanging
      const extractionPromise = page.$$eval(
        'tr[data-test-row]',
        (rows, { targetDate, targetDateString, studioAddress }) => {
          console.log('🔍 Starting Barry\'s table scraping evaluation...');
          
          // Debug: Log the page structure
          console.log('🔍 Page title:', document.title);
          console.log('🔍 Page URL:', window.location.href);
          
          // Look for table rows that contain class information
          const allRows = Array.from(rows);
          console.log(`🔍 Found ${allRows.length} table rows with data-test-row`);
          
          // If no rows found, try alternative selectors
          if (allRows.length === 0) {
            console.log('🔍 No data-test-row found, trying alternative selectors...');
            
            // Try different table row selectors
            const alternativeRows = document.querySelectorAll('tr, .schedule-row, .class-row, [class*="row"]');
            console.log(`🔍 Found ${alternativeRows.length} alternative rows`);
            
            // Log the first few rows to see their structure
            for (let i = 0; i < Math.min(3, alternativeRows.length); i++) {
              const row = alternativeRows[i];
              console.log(`🔍 Row ${i + 1} HTML:`, row.outerHTML.substring(0, 200) + '...');
            }
            
            // Try to find any elements that might contain class information
            const allElements = document.querySelectorAll('*');
            console.log(`🔍 Total elements on page: ${allElements.length}`);
            
            // Look for elements with class-related text
            const classElements = Array.from(allElements).filter(el => {
              const text = el.textContent?.toLowerCase() || '';
              return text.includes('class') || text.includes('session') || text.includes('workout') || text.includes('min');
            });
            console.log(`🔍 Found ${classElements.length} elements with class-related text`);
            
            // Log some examples
            for (let i = 0; i < Math.min(5, classElements.length); i++) {
              const el = classElements[i];
              console.log(`🔍 Class element ${i + 1}:`, el.outerHTML.substring(0, 200) + '...');
            }
          }
          
          // Use the rows we found (either data-test-row or alternative rows)
          const alternativeRows = rows.length > 0 ? rows : document.querySelectorAll('tr');
          console.log(`🔍 Processing ${alternativeRows.length} total rows`);
          
          return Array.from(alternativeRows).map((row, index) => {
            console.log(`🔍 Processing row ${index + 1}`);
            
            // Get time from first cell
            const timeCell = row.querySelector('td:first-child .BoldLabel-sc-ha1dsk');
            const time = timeCell?.textContent?.trim() || '';
            console.log(`🔍 Time: "${time}"`);
            
            // Get duration from first cell
            const durationCell = row.querySelector('td:first-child .StyledMeta-sc-1tw3zxx');
            const duration = durationCell?.textContent?.trim() || '';
            console.log(`🔍 Duration: "${duration}"`);
            
            // Get location from first cell
            const locationCell = row.querySelector('td:first-child .StyledLocationData-sc-1999s1s');
            const location = locationCell?.textContent?.trim() || '';
            console.log(`🔍 Location: "${location}"`);
            
            // Filter by studio address location
            console.log(`🔍 Checking location filter - Studio address: "${studioAddress}", Class location: "${location}"`);
            if (studioAddress && location) {
              // Extract location keywords from studio address (e.g., "Brooklyn Heights" from full address)
              const addressLower = studioAddress.toLowerCase();
              const locationLower = location.toLowerCase();
              
              console.log(`🔍 Address lower: "${addressLower}", Location lower: "${locationLower}"`);
              
              // Check if the class location matches any part of the studio address
              const addressWords = addressLower.split(/[,\s]+/).filter(word => word.length > 2);
              const locationWords = locationLower.split(/[,\s]+/).filter(word => word.length > 2);
              
              console.log(`🔍 Address words: [${addressWords.join(', ')}], Location words: [${locationWords.join(', ')}]`);
              
              const hasMatchingLocation = addressWords.some(addrWord => 
                locationWords.some(locWord => 
                  addrWord.includes(locWord) || locWord.includes(addrWord)
                )
              );
              
              console.log(`🔍 Has matching location: ${hasMatchingLocation}`);
              
              if (!hasMatchingLocation) {
                console.log(`❌ Skipping class - location "${location}" doesn't match studio address "${studioAddress}"`);
                return null;
              }
              
              console.log(`✅ Class location "${location}" matches studio address "${studioAddress}"`);
            } else {
              console.log(`⚠️ No filtering - studioAddress: "${studioAddress}", location: "${location}"`);
            }
            
            // Get class name from second cell - be more specific to avoid icons
            const classButton = row.querySelector('button[data-test-button*="class-details"] .ButtonLabel-sc-vvc4oq');
            let name = classButton?.textContent?.trim() || '';
            
            // If the name contains unusual characters, try to get just the text nodes
            if (classButton && (name.includes('🚲') || name.includes('🏃') || name.includes('💪'))) {
              // Get only text nodes, excluding any icon elements
              const textNodes = Array.from(classButton.childNodes)
                .filter(node => node.nodeType === Node.TEXT_NODE)
                .map(node => node.textContent?.trim())
                .filter(text => text && text.length > 0)
                .join(' ');
              name = textNodes || name;
            }
            console.log(`🔍 Class name: "${name}"`);
            
            // Get instructor from second cell
            const instructorButton = row.querySelector('button[data-test-button*="instructor-details"] .ButtonLabel-sc-vvc4oq');
            let instructor = instructorButton?.textContent?.trim() || '';
            
            // Enhanced instructor selector to catch more instructor elements
            if (!instructor) {
              const instructorSelectors = [
                'button[data-test-button*="instructor-details"] .ButtonLabel-sc-vvc4oq',
                '.instructor', '.teacher', '.trainer', '.staff',
                '[data-instructor]', '.class-instructor', '.coach',
                'p[class*="LineItem"]', 'p.fKKBMd'
              ];
              
              for (const selector of instructorSelectors) {
                const instructorElement = row.querySelector(selector);
                if (instructorElement) {
                  const potentialInstructor = instructorElement.textContent?.trim() || '';
                  
                  // Validate that this looks like an instructor name, not duration or other data
                  if (potentialInstructor && 
                      potentialInstructor.length > 0 && 
                      !potentialInstructor.match(/^\d+\s*min/i) && // Not "50 min" or similar
                      !potentialInstructor.match(/^\d+$/) && // Not just numbers
                      !potentialInstructor.match(/^[0-9:]+$/) && // Not time format
                      potentialInstructor.length < 50 && // Reasonable name length
                      /[a-zA-Z]/.test(potentialInstructor)) { // Contains letters
                    
                    instructor = potentialInstructor;
                    console.log(`✅ Found instructor with selector "${selector}": "${instructor}"`);
                    break;
                  }
                }
              }
            }
            
            console.log(`🔍 Instructor: "${instructor}"`);
            
            // Clean up class name (remove duration and any icons/special characters)
            let cleanName = name;
            if (duration) {
              cleanName = name.replace(new RegExp(`\\(${duration}\\)`, 'i'), '').trim();
            }
            
            // Remove any icons, emojis, or special characters that might be included
            cleanName = cleanName
              .replace(/[\u{1F600}-\u{1F64F}]/gu, '') // Remove emojis
              .replace(/[\u{1F300}-\u{1F5FF}]/gu, '') // Remove miscellaneous symbols
              .replace(/[\u{1F680}-\u{1F6FF}]/gu, '') // Remove transport symbols
              .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '') // Remove regional indicator symbols
              .replace(/[\u{2600}-\u{26FF}]/gu, '') // Remove miscellaneous symbols
              .replace(/[\u{2700}-\u{27BF}]/gu, '') // Remove dingbats
              .replace(/[^\w\s\-\(\)]/g, '') // Remove any other special characters except letters, numbers, spaces, hyphens, and parentheses
              .replace(/\s+/g, ' ') // Replace multiple spaces with single space
              .trim();
            
            console.log(`🔍 Clean class name: "${cleanName}"`);
            
            // Validate that this class is for the target date
            const pageHeader = document.querySelector('h1');
            const headerText = pageHeader?.textContent || '';
            console.log(`🔍 Page header: "${headerText}"`);
            
            // Check if the active date button matches our target date
            const activeDateButton = document.querySelector('button[data-test-date-button*="active"]');
            const activeButtonDate = activeDateButton?.getAttribute('data-test-date-button') || '';
            console.log(`🔍 Active date button: "${activeButtonDate}"`);
            
            // Check if the page header contains the target date or if the active button matches
            const targetDay = targetDateString.split('/')[1]; // Get the day part
            console.log(`🔍 Target day: ${targetDay}, Active button: "${activeButtonDate}", Header: "${headerText}"`);
            
            const isTargetDate = headerText.includes(targetDate) || 
                               headerText.includes(targetDateString) ||
                               activeButtonDate.includes(targetDay) ||
                               activeButtonDate.includes(`active-${targetDay}`);
            
            if (!isTargetDate) {
              console.log(`❌ Skipping class - not for target date ${targetDateString} (header: "${headerText}", active button: "${activeButtonDate}")`);
              return null;
            }
            
            console.log(`✅ Including class for target date ${targetDateString}`);
            
            return {
              name: cleanName,
              time,
              instructor,
              duration,
              price: '',
              classDate: targetDate
            };
          }).filter(Boolean); // Remove null entries
        },
        { targetDate: targetDateString, targetDateString, studioAddress },
        { timeout: 20000 } // Add timeout for page.$$eval
      );
      
      classes = await extractionPromise; // Assign the result to the 'classes' variable
      console.log(`✅ Found ${classes.length} classes using Barry's table scraper`);
      
      // Convert to ScrapedClass format (filter out null values)
      return classes
        .filter((classData): classData is NonNullable<typeof classData> => classData !== null)
        .map((classData, index) => ({
          id: `barrys-table-${Date.now()}-${index}`,
          name: classData.name || `Barry's Class ${index + 1}`,
          description: `${classData.name || 'Barry\'s'} class`,
          duration: WebScraper.extractDuration(classData.duration),
          difficulty_level: WebScraper.extractDifficulty(classData.name || ''),
          class_type: WebScraper.extractClassType(classData.name || ''),
          max_capacity: null,
          price: WebScraper.extractPrice(classData.price),
          start_time: classData.time,
          instructor: classData.instructor || null,
        is_available: true,
        total_booked: 0,
          source: 'web_scraping' as const
        }));
      
    } catch (error) {
      console.log('❌ Barry\'s table scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  } catch (error) {
    console.log('❌ Barry\'s table scraping main error:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

  // Generic scraping with selectors
  static async genericScraping(page: Page, selectors: Record<string, string>): Promise<ScrapedClass[]> {
    const classes: ScrapedClass[] = [];
    
    try {
      const classElements = await page.$$eval(
        selectors.classContainer || '.class, .schedule-item, .class-item',
        (elements, sel) => {
          return elements.map((el, index) => {
            const name = el.querySelector(sel.className || '.class-name, .title, h3, h4')?.textContent?.trim() || 
                        `Class ${index + 1}`;
            const time = el.querySelector(sel.classTime || '.time, .schedule-time')?.textContent?.trim() || '';
            const instructor = el.querySelector(sel.classInstructor || '.instructor, .teacher')?.textContent?.trim() || '';
            const duration = el.querySelector(sel.classDuration || '.duration')?.textContent?.trim() || '';
            const price = el.querySelector(sel.classPrice || '.price')?.textContent?.trim() || '';
            
            return {
              name,
              time,
              instructor,
              duration,
              price
            };
          });
        },
        selectors
      );
      
      // Convert to ScrapedClass format
      classes.push(...classElements.map((classData, index) => ({
        id: `generic-${Date.now()}-${index}`,
        name: classData.name,
        description: `${classData.name} class`,
        duration: WebScraper.extractDuration(classData.duration),
        difficulty_level: null,
        class_type: null,
        max_capacity: null,
        price: WebScraper.extractPrice(classData.price),
        start_time: classData.time,
        instructor: classData.instructor || null,
        is_available: true,
        total_booked: 0,
        source: 'web_scraping' as const
      })));
      
    } catch (error) {
      console.error('Error in generic scraping:', error instanceof Error ? error.message : 'Unknown error');
    }
    
    return classes;
  }

  // Utility functions
  static extractDuration(durationText: string): number | null {
    if (!durationText) return null;
    const match = durationText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }

  static extractPrice(priceText: string): number | null {
    if (!priceText) return null;
    const match = priceText.match(/\$?(\d+(?:\.\d{2})?)/);
    return match ? parseFloat(match[1]) : null;
  }

  static extractDifficulty(className: string): string | null {
    if (!className) return null;
    const lowerName = className.toLowerCase();
    if (lowerName.includes('beginner') || lowerName.includes('starter')) return 'beginner';
    if (lowerName.includes('advanced')) return 'advanced';
    if (lowerName.includes('intermediate')) return 'intermediate';
    return 'intermediate';
  }

  static extractClassType(className: string): string | null {
    if (!className) return null;
    const lowerName = className.toLowerCase();
    if (lowerName.includes('pilates')) return 'pilates';
    if (lowerName.includes('yoga')) return 'yoga';
    if (lowerName.includes('cardio')) return 'cardio';
    if (lowerName.includes('strength')) return 'strength';
    if (lowerName.includes('core')) return 'core';
    return 'fitness';
  }
}
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

export class WebScraper {
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

  async scrapeClasses(websiteUrl: string, date?: string, studioAddress?: string): Promise<ScrapedClass[]> {
    try {
      const timeoutPromise = new Promise<ScrapedClass[]>((_, reject) => {
        setTimeout(() => reject(new Error('Scraping timeout after 30 seconds')), 30000);
      });

      const scrapingPromise = this._scrapeClasses(websiteUrl, date, studioAddress);
      return await Promise.race([scrapingPromise, timeoutPromise]);
    } catch (error) {
      console.error('Scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    }
  }

  static getScrapingConfig(websiteUrl: string): 'mariana' | 'universal' {
    const url = websiteUrl.toLowerCase();

    
    if (url.includes('marianaiframes.com')) {
      return 'mariana';
    }
    
    return 'universal';
  }

  private async _scrapeClasses(websiteUrl: string, date?: string, studioAddress?: string): Promise<ScrapedClass[]> {
    await this.init();
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      await page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      await page.goto(websiteUrl, { 
        waitUntil: 'domcontentloaded',
        timeout: 10000
      });
      
      const scrapingType = WebScraper.getScrapingConfig(websiteUrl);

      
      if (scrapingType === 'mariana') {
        return await this.marianaIframeScraping(page, date, studioAddress);
      } else {
        return await this.universalStudioScraping(page, date, studioAddress);
      }
      
    } catch (error) {
      console.error('Web scraping error:', error instanceof Error ? error.message : 'Unknown error');
      return [];
    } finally {
      await this.close();
    }
  }

  private async marianaIframeScraping(page: Page, date?: string, studioAddress?: string): Promise<ScrapedClass[]> {
    if (!date) return [];
    
    try {
      await WebScraper.delay(500);
      
      // Set viewport to desktop size to ensure filter buttons are visible
      await page.setViewport({ width: 1200, height: 800 });
      
      // Navigate to target date
      const [year, month, day] = date.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      const targetDay = targetDate.getDate().toString();
      
      const dateButtons = await page.$$('button[data-test-date-button]');
      for (const button of dateButtons) {
        const buttonDate = await page.evaluate((el) => el.getAttribute('data-test-date-button'), button);
        const buttonText = await page.evaluate((el) => el.textContent?.trim(), button);
        
        if (buttonDate && (buttonDate.includes(targetDay) || buttonDate.includes(`active-${targetDay}`))) {
          await page.evaluate((el) => (el as HTMLElement).click(), button);
          await WebScraper.delay(750);
          break;
        } else if (buttonText && buttonText.includes(targetDay)) {
          await page.evaluate((el) => (el as HTMLElement).click(), button);
          await WebScraper.delay(750);
          break;
        }
      }
      
      // Wait for table to load
      let tableExists = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        await WebScraper.delay(1000);
        
        tableExists = await page.evaluate(() => {
          const scheduleTable = document.querySelector('table[data-test-table="schedule"]');
          const rows = document.querySelectorAll('tr[data-test-row="table-row"]');
          return scheduleTable !== null && rows.length > 0;
        });
        
        if (tableExists) break;
      }
      
      if (!tableExists) {
        return [];
      }
      
      // Filter by location if specified
      if (studioAddress) {
        await WebScraper.delay(1000);
        
        // Clear any existing location filters
        await page.evaluate(() => {
          const checkedCheckboxes = document.querySelectorAll('input[type="checkbox"]:checked');
          checkedCheckboxes.forEach(checkbox => {
            (checkbox as HTMLInputElement).click();
            (checkbox as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
          });
        });
        
        await WebScraper.delay(1000);
        
        // Click the Rooms button to open location filter
        const roomButton = await page.$('button[data-test-dropdown-button="rooms"][aria-label="Filter Button"]');
        if (roomButton) {
          await page.evaluate((el) => (el as HTMLElement).click(), roomButton);
          await WebScraper.delay(1000);
          
          // Find and click the checkbox for the specified location
          const checkboxes = await page.$$('input[type="checkbox"]');
          for (const checkbox of checkboxes) {
            const parentText = await page.evaluate((el) => {
              const parent = el.closest('li, div, label');
              return parent?.textContent?.trim() || '';
            }, checkbox);
            
            if (parentText.toLowerCase() === studioAddress.toLowerCase()) {
              await page.evaluate((el) => {
                (el as HTMLInputElement).click();
                (el as HTMLInputElement).dispatchEvent(new Event('change', { bubbles: true }));
              }, checkbox);
              
              await WebScraper.delay(500);
              
              // Close dropdown
              await page.evaluate(() => {
                document.body.click();
              });
              
              await WebScraper.delay(2000);
              break;
            }
          }
        }
      }
      
      // Extract classes
      const rows = await page.evaluate(() => {
        const rowSelectors = [
          'table[data-test-table="schedule"] tr[data-test-row="table-row"]',
          'tr[data-test-row="table-row"]',
          'tr[data-test-row]',
          'tbody tr',
          'table tr'
        ];
        
        let rows: Element[] = [];
        for (const selector of rowSelectors) {
          const found = document.querySelectorAll(selector);
          rows = Array.from(found);
          if (rows.length > 0) break;
        }
        
        return rows.map((row) => {
          const time = row.querySelector('td:first-child p.BoldLabel-sc-ha1dsk')?.textContent?.trim() || 
                      row.querySelector('td:first-child p:first-child')?.textContent?.trim() || '';
          
          const duration = row.querySelector('td:first-child p.LineItem-sc-kwjy1o.StyledMeta-sc-1tw3zxx')?.textContent?.trim() || 
                          row.querySelector('td:first-child p:nth-child(2)')?.textContent?.trim() || '';
          
          const location = row.querySelector('td:first-child p.LineItem-sc-kwjy1o.StyledLocationData-sc-1999s1s')?.textContent?.trim() || 
                          row.querySelector('td:first-child p:nth-child(3)')?.textContent?.trim() || '';
          
          const name = row.querySelector('button[data-test-button*="class-details"] .ButtonLabel-sc-vvc4oq')?.textContent?.trim() || 
                      row.querySelector('button[data-test-button*="class-details"] span')?.textContent?.trim() || '';
          
          const instructor = row.querySelector('button[data-test-button*="instructor-details"] .ButtonLabel-sc-vvc4oq')?.textContent?.trim() || 
                           row.querySelector('button[data-test-button*="instructor-details"] span')?.textContent?.trim() || '';
          
          const studioType = row.querySelector('td:last-child p')?.textContent?.trim() || 
                           row.querySelector('td:nth-child(2) p:last-child')?.textContent?.trim() || '';
          
          return { time, duration, location, name, instructor, studioType };
        });
      });
      
      const classes = rows
        .filter(row => {
          if (!studioAddress) return true;
          
          const addressLower = studioAddress.toLowerCase();
          const hasStudioType = addressLower.includes('ride') || addressLower.includes('run') || addressLower.includes('lift');
          
          if (hasStudioType && row.studioType) {
            const studioTypeLower = row.studioType.toLowerCase();
            return studioTypeLower === addressLower;
          } else {
            const locationLower = row.location.toLowerCase();
            return locationLower === addressLower;
          }
        })
        .filter(row => row.time && row.name)
        .map(row => ({
          name: row.name.replace(/^\d+\s*[-–]\s*/, '').trim(),
          time: row.time,
          instructor: row.instructor,
          duration: this.extractDuration(row.duration),
          studioType: row.studioType,
          price: '',
          classDate: `${month}/${day}`
        }));
      
      return classes.map((classData, index) => ({
        id: `mariana-iframe-${Date.now()}-${index}`,
        name: classData.name || `Mariana Iframe Class ${index + 1}`,
        description: `${classData.name || 'Mariana Iframe'} class${classData.studioType ? ` at ${classData.studioType}` : ''}`,
        duration: classData.duration,
        difficulty_level: 'intermediate',
        class_type: 'fitness',
        max_capacity: null,
        price: null,
        start_time: classData.time,
        instructor: classData.instructor || null,
        is_available: true,
        total_booked: 0,
        source: 'web_scraping' as const
      }));
      
    } catch {

      return [];
    }
  }

  private async universalStudioScraping(page: Page, date?: string, studioAddress?: string): Promise<ScrapedClass[]> {
    if (!date) return [];
    
    try {
      const [year, month, day] = date.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      const targetDateString = `${targetDate.getMonth() + 1}`.padStart(2, '0') + '/' + 
                              `${targetDate.getDate()}`.padStart(2, '0');
      
      const classes = await page.$$eval(
        'body',
        (body, evalInfo) => {
          const { targetDate, studioAddress } = evalInfo;
          
          const scheduleDays = document.querySelectorAll('.schedule-day');
          let targetDateClasses: Element[] = [];
          
          for (const day of scheduleDays) {
            const dateHeader = day.querySelector('.schedule-day-header-date');
            if (dateHeader) {
              const dateText = dateHeader.textContent?.trim();
              if (dateText && dateText.includes(targetDate)) {
                const dayClasses = day.querySelectorAll('li.class');
                targetDateClasses = Array.from(dayClasses);
                break;
              }
            }
          }

          const corePowerClasses = document.querySelectorAll('.session-row-view');
          const classElements = targetDateClasses.length > 0 ? targetDateClasses : Array.from(corePowerClasses);
          
          return classElements.map((el) => {
            const nameSelectors = [
              '.session-card_sessionName__EKrdk', '.ButtonLabel-sc-vvc4oq',
              '.class-name', '.name', '[class*="name"]', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
              '.title', '[class*="title"]', '.workout-name', '.session-name'
            ];
            
            const timeSelectors = [
              '.session-card_sessionTime__hNAfR', '.BoldLabel-sc-ha1dsk',
              '.class-time', '.time', '[class*="time"]', '.schedule-time', '.start-time'
            ];
            
            const instructorSelectors = [
              '.session-card_sessionTeacher__tFtaz', '.ButtonLabel-sc-vvc4oq',
              '.class-teacher', '.instructor', '[class*="instructor"]', '.teacher', '[class*="teacher"]',
              'p[class*="LineItem"]', 'p.fKKBMd'
            ];
            
            const studioSelectors = [
              '.session-card_sessionStudio__yRE6h', '.session-studio',
              '.studio', '[class*="studio"]', '.location', '[class*="location"]'
            ];
            
            let name = null;
            let time = '';
            let instructor = '';
            let studio = '';
            
            for (const selector of nameSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                name = element.textContent.trim();
                break;
              }
            }
            
            for (const selector of timeSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                time = element.textContent.trim();
                break;
              }
            }
            
            for (const selector of instructorSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                instructor = element.textContent.trim();
                break;
              }
            }
            
            for (const selector of studioSelectors) {
              const element = el.querySelector(selector);
              if (element?.textContent?.trim()) {
                studio = element.textContent.trim();
                break;
              }
            }
            
            if (studioAddress && studio) {
              const addressLower = studioAddress.toLowerCase();
              const studioLower = studio.toLowerCase();
              const addressWords = addressLower.split(/[,\s]+/).filter(word => word.length > 2);
              const studioWords = studioLower.split(/[,\s]+/).filter(word => word.length > 2);
              
              const hasMatchingLocation = addressWords.some(addrWord => 
                studioWords.some(studioWord => 
                  addrWord.includes(studioWord) || studioWord.includes(addrWord)
                )
              );
              
              if (!hasMatchingLocation) {
                return null;
              }
            }
            
            if (!name) {
              const textContent = el.textContent?.trim();
              if (textContent && textContent.length < 100 && textContent.length > 3) {
                const lowerText = textContent.toLowerCase();
                if (!lowerText.includes('schedule') && 
                    !lowerText.includes('book') && 
                    !lowerText.includes('menu') && 
                    !lowerText.includes('nav') &&
                    !lowerText.includes('header') &&
                    !lowerText.includes('footer')) {
                  name = textContent.split('\n')[0].trim();
                }
              }
            }
            
            return {
              name,
              time,
              instructor,
              studio,
              price: '',
              classDate: targetDate
            };
          }).filter(Boolean);
        },
        { targetDate: targetDateString, studioAddress }
      );
      
      return classes
        .filter((classData): classData is NonNullable<typeof classData> => classData !== null)
        .map((classData, index) => ({
          id: `universal-${Date.now()}-${index}`,
          name: classData.name || `Class ${index + 1}`,
          description: `${classData.name || 'Studio'} class${classData.studio ? ` at ${classData.studio}` : ''}`,
          duration: this.extractDuration(''),
          difficulty_level: 'intermediate',
          class_type: 'fitness',
          max_capacity: null,
          price: null,
          start_time: classData.time,
          instructor: classData.instructor || null,
        is_available: true,
        total_booked: 0,
          source: 'web_scraping' as const
        }));
      
    } catch {
      console.error('Universal scraping error: Unknown error');
      return [];
  }
}

  private extractDuration(durationText: string): number | null {
    if (!durationText) return null;
    const match = durationText.match(/(\d+)/);
    return match ? parseInt(match[1]) : null;
  }
}
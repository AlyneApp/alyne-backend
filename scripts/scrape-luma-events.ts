import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') });

async function scrapeLumaEvents() {
  console.log('Scraping Luma events and saving to database...');
  
  try {
    // Dynamically import the LumaScraper after environment variables are loaded
    const { LumaScraper } = await import('../lib/lumaScraper');
    
    const scraper = new LumaScraper();
    
    try {
      const result = await scraper.scrapeAndSaveEvents();
      
      console.log(`\n=== LUMA DATABASE INTEGRATION RESULTS ===`);
      console.log(`Scraped: ${result.scraped} events`);
      console.log(`Inserted: ${result.inserted} new events`);
      console.log(`Updated: ${result.updated} existing events`);
      
      if (result.errors.length > 0) {
        console.log(`\nErrors: ${result.errors.length}`);
        result.errors.forEach(error => console.log(`  - ${error}`));
      } else {
        console.log('\n✅ No errors!');
      }
      
    } finally {
      await scraper.close();
    }
    
  } catch (error) {
    console.error('Error scraping Luma events:', error);
  }
}

// Run the scraper
scrapeLumaEvents().catch(console.error);

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file FIRST, before any other imports
config({ path: resolve(__dirname, '../.env') });
config({ path: resolve(__dirname, '../.env.local') }); // Also try .env.local if it exists

// Verify environment variables are loaded
if (!process.env.EXPO_PUBLIC_SUPABASE_URL || !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  console.error('❌ Missing required Supabase environment variables');
  console.error('Please ensure .env file contains:');
  console.error('  - EXPO_PUBLIC_SUPABASE_URL');
  console.error('  - EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

async function runFullScraping() {
  console.log('🎯 Full Wellness Events Scraping Process');
  console.log('=' .repeat(50));
  console.log('');
  
  console.log('📋 This script will:');
  console.log('   1. Scrape events from Girls Who Meet website');
  console.log('   2. Scrape events from Luma fitness and wellness pages');
  console.log('   3. Add new events to the events table');
  console.log('   4. Update existing events if they changed');
  console.log('   5. Deactivate events no longer on the websites');
  console.log('');
  
  console.log('🚀 Starting scraping process...');
  console.log('');
  
  try {
    // Dynamically import modules that depend on environment variables
    // This ensures dotenv config is loaded first
    const { scrapeAndUpdateEvents } = await import('./scrape-wellness-events');
    
    // Scrape Girls Who Meet events
    console.log('📅 Scraping Girls Who Meet events...');
    await scrapeAndUpdateEvents();
    
    // Scrape Luma events
    console.log('📅 Scraping Luma events...');
    const { LumaScraper } = await import('../lib/lumaScraper');
    const lumaScraper = new LumaScraper();
    try {
      const lumaResult = await lumaScraper.scrapeAndSaveEvents();
      console.log(`✅ Luma scraping completed:`);
      console.log(`   - Scraped: ${lumaResult.scraped} events`);
      console.log(`   - Inserted: ${lumaResult.inserted} new events`);
      console.log(`   - Updated: ${lumaResult.updated} existing events`);
      if (lumaResult.errors.length > 0) {
        console.log(`   - Errors: ${lumaResult.errors.length}`);
        lumaResult.errors.forEach(error => console.log(`     - ${error}`));
      }

    } finally {
      await lumaScraper.close();
    }
    
    console.log('');
    console.log('✅ Scraping completed successfully!');
    console.log('');
    console.log('📱 Next steps:');
    console.log('   1. Start your mobile app');
    console.log('   2. Navigate to Record > Wellness Events');
    console.log('   3. You should now see the real events from Girls Who Meet and Luma');
    console.log('');
    console.log('🔗 API endpoints:');
    console.log('   GET /api/wellness-events - All events (Girls Who Meet + Luma)');
    console.log('   GET /api/luma-events - Luma events only');
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Make sure the events table exists in your database');
    console.log('   2. Check your internet connection');
    console.log('   3. Verify the Girls Who Meet and Luma websites are accessible');
    console.log('   4. Run: yarn test-scraper (to test without DB updates)');
    console.log('   5. Run: yarn test-luma-scraper (to test Luma scraper)');
  }
}

// Run the script if called directly
if (require.main === module) {
  runFullScraping()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Script failed:', error);
      process.exit(1);
    });
}

export { runFullScraping };


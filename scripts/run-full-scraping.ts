import { scrapeAndUpdateEvents } from './scrape-wellness-events';

async function runFullScraping() {
  console.log('🎯 Full Wellness Events Scraping Process');
  console.log('=' .repeat(50));
  console.log('');
  
  console.log('📋 This script will:');
  console.log('   1. Scrape events from Girls Who Meet website');
  console.log('   2. Add new events to the events table');
  console.log('   3. Update existing events if they changed');
  console.log('   4. Deactivate events no longer on the website');
  console.log('');
  
  console.log('🚀 Starting scraping process...');
  console.log('');
  
  try {
    await scrapeAndUpdateEvents();
    
    console.log('');
    console.log('✅ Scraping completed successfully!');
    console.log('');
    console.log('📱 Next steps:');
    console.log('   1. Start your mobile app');
    console.log('   2. Navigate to Record > Wellness Events');
    console.log('   3. You should now see the real events from Girls Who Meet');
    console.log('');
    console.log('🔗 API endpoint: GET /api/wellness-events');
    console.log('   This will return the scraped events for your app');
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Make sure the events table exists in your database');
    console.log('   2. Check your internet connection');
    console.log('   3. Verify the Girls Who Meet website is accessible');
    console.log('   4. Run: npm run test-scraper (to test without DB updates)');
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


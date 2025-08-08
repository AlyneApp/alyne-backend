import { GirlsWhoMeetScraper } from '../lib/girlswhomeetScraper';

async function testScraper() {
  console.log('🧪 Testing Girls Who Meet scraper...');
  
  const scraper = new GirlsWhoMeetScraper();
  
  try {
    const events = await scraper.scrapeEvents();
    
    console.log(`\n✅ Scraping completed! Found ${events.length} events:\n`);
    
          events.forEach((event, index) => {
        console.log(`${index + 1}. ${event.name}`);
        console.log(`   📍 Location: ${event.location}`);
        console.log(`   📅 Date: ${event.date.split('T')[0]}`);
        console.log(`   🕐 Time: ${event.time || 'TBD'}`);
        if (event.end_time) {
          console.log(`   🕐 End Time: ${event.end_time}`);
        }
        console.log(`   🏷️ Category: ${event.category}`);
        if (event.description) {
          console.log(`   📝 Description: ${event.description}`);
        }
        if (event.address) {
          console.log(`   🏠 Address: ${event.address}`);
        }
        console.log(`   🔗 URL: ${event.external_url}`);
        console.log(`   🆔 Source ID: ${event.source_id}`);
        console.log('');
      });
    
    if (events.length === 0) {
      console.log('❌ No events found. This might indicate an issue with the scraper or the website structure.');
    }
    
  } catch (error) {
    console.error('❌ Scraping failed:', error);
  } finally {
    await scraper.close();
  }
}

// Run the test if called directly
if (require.main === module) {
  testScraper()
    .then(() => {
      console.log('🎉 Test completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Test failed:', error);
      process.exit(1);
    });
}

export { testScraper };

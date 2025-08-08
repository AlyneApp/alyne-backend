import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') });

import { supabase } from '../lib/supabase';
import { GirlsWhoMeetScraper, ScrapedEvent } from '../lib/girlswhomeetScraper';

interface DatabaseEvent {
  id: string;
  name: string;
  description?: string;
  location: string;
  address?: string;
  date: string;
  time?: string;
  end_time?: string;
  category?: string;
  event_type?: string;
  price?: number;
  currency?: string;
  max_capacity?: number;
  current_attendees?: number;
  organizer?: string;
  organizer_website?: string;
  image_url?: string;
  external_url?: string;
  source: string;
  source_id: string;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

async function scrapeAndUpdateEvents() {
  console.log('🚀 Starting wellness events scraping process...');
  
  // Debug: Check environment variables
  console.log('🔍 Environment variables check:');
  console.log('  EXPO_PUBLIC_SUPABASE_URL:', process.env.EXPO_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing');
  console.log('  EXPO_PUBLIC_SUPABASE_ANON_KEY:', process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ? '✅ Set' : '❌ Missing');
  console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set' : '❌ Missing');
  console.log('');
  
  const scraper = new GirlsWhoMeetScraper();
  
  try {
    // Step 1: Scrape events from Girls Who Meet
    console.log('📡 Scraping events from Girls Who Meet...');
    const scrapedEvents = await scraper.scrapeEvents();
    
    if (scrapedEvents.length === 0) {
      console.log('❌ No events found during scraping');
      return;
    }
    
    console.log(`✅ Successfully scraped ${scrapedEvents.length} events`);
    
    // Step 2: Get existing events from database
    console.log('🗄️ Fetching existing events from database...');
    const { data: existingEvents, error: fetchError } = await supabase
      .from('events')
      .select('source_id, name, date, location')
      .eq('source', 'girlswhomeet');
    
    if (fetchError) {
      console.error('❌ Error fetching existing events:', fetchError);
      return;
    }
    
    const existingEventIds = new Set(existingEvents?.map(e => e.source_id) || []);
    console.log(`📊 Found ${existingEventIds.size} existing events in database`);
    
    // Step 3: Filter out events that already exist
    const newEvents = scrapedEvents.filter(event => !existingEventIds.has(event.source_id));
    const updatedEvents = scrapedEvents.filter(event => existingEventIds.has(event.source_id));
    
    console.log(`🆕 Found ${newEvents.length} new events to add`);
    console.log(`🔄 Found ${updatedEvents.length} existing events to update`);
    
    // Step 4: Insert new events
    if (newEvents.length > 0) {
      console.log('💾 Inserting new events...');
      const eventsToInsert: Omit<DatabaseEvent, 'id' | 'created_at' | 'updated_at'>[] = newEvents.map(event => ({
        name: event.name,
        description: event.description || `${event.name} at ${event.location}`,
        location: event.location,
        address: event.address,
        date: event.date.split('T')[0], // Extract just the date part from ISO string
        time: event.time,
        end_time: event.end_time,
        category: event.category,
        event_type: event.event_type,
        price: event.price,
        currency: event.currency,
        max_capacity: event.max_capacity,
        current_attendees: 0,
        organizer: event.organizer,
        organizer_website: event.organizer_website,
        image_url: event.image_url,
        external_url: event.external_url,
        source: event.source,
        source_id: event.source_id,
        is_active: true,
        is_featured: false
      }));
      
      const { data: insertedEvents, error: insertError } = await supabase
        .from('events')
        .insert(eventsToInsert)
        .select();
      
      if (insertError) {
        console.error('❌ Error inserting new events:', insertError);
      } else {
        console.log(`✅ Successfully inserted ${insertedEvents?.length || 0} new events`);
      }
    }
    
    // Step 5: Update existing events
    if (updatedEvents.length > 0) {
      console.log('🔄 Updating existing events...');
      
      for (const event of updatedEvents) {
        const { error: updateError } = await supabase
          .from('events')
          .update({
            name: event.name,
            description: event.description || `${event.name} at ${event.location}`,
            location: event.location,
            address: event.address,
            date: event.date.split('T')[0], // Extract just the date part from ISO string
            time: event.time,
            end_time: event.end_time,
            category: event.category,
            event_type: event.event_type,
            price: event.price,
            currency: event.currency,
            max_capacity: event.max_capacity,
            organizer: event.organizer,
            organizer_website: event.organizer_website,
            image_url: event.image_url,
            external_url: event.external_url,
            is_active: true
          })
          .eq('source_id', event.source_id);
        
        if (updateError) {
          console.error(`❌ Error updating event ${event.source_id}:`, updateError);
        }
      }
      
      console.log(`✅ Successfully updated ${updatedEvents.length} existing events`);
    }
    
    // Step 6: Deactivate old events (events that are no longer on the website)
    console.log('🧹 Cleaning up old events...');
    const scrapedEventIds = new Set(scrapedEvents.map(e => e.source_id));
    const oldEventIds = Array.from(existingEventIds).filter(id => !scrapedEventIds.has(id));
    
    if (oldEventIds.length > 0) {
      const { error: deactivateError } = await supabase
        .from('events')
        .update({ is_active: false })
        .in('source_id', oldEventIds);
      
      if (deactivateError) {
        console.error('❌ Error deactivating old events:', deactivateError);
      } else {
        console.log(`✅ Deactivated ${oldEventIds.length} old events`);
      }
    }
    
    // Step 7: Summary
    console.log('\n📈 Scraping Summary:');
    console.log(`   • Total events scraped: ${scrapedEvents.length}`);
    console.log(`   • New events added: ${newEvents.length}`);
    console.log(`   • Existing events updated: ${updatedEvents.length}`);
    console.log(`   • Old events deactivated: ${oldEventIds.length}`);
    
    // Log some example events
    if (scrapedEvents.length > 0) {
      console.log('\n📋 Example events:');
      scrapedEvents.slice(0, 3).forEach(event => {
        console.log(`   • ${event.name} - ${event.location} (${event.date.toLocaleDateString()})`);
      });
    }
    
  } catch (error) {
    console.error('❌ Fatal error during scraping process:', error);
  } finally {
    await scraper.close();
  }
}

// Run the script if called directly
if (require.main === module) {
  scrapeAndUpdateEvents()
    .then(() => {
      console.log('🎉 Scraping process completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Scraping process failed:', error);
      process.exit(1);
    });
}

export { scrapeAndUpdateEvents };

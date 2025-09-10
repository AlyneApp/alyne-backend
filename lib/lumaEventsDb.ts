import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env file
config({ path: resolve(__dirname, '../.env') });

import { supabaseAdmin } from './supabase';
import { LumaEvent } from './lumaScraper';

// Helper function to clean time format for PostgreSQL
function cleanTimeFormat(timeStr: string): string | undefined {
  if (!timeStr) return undefined;
  
  // Remove "LIVE" prefix and clean up the time
  let cleanTime = timeStr.replace(/^LIVE/i, '').trim();
  
  // Handle various time formats
  // Convert "9:00 PM" to "21:00:00"
  try {
    const timeMatch = cleanTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (timeMatch) {
      let hours = parseInt(timeMatch[1]);
      const minutes = timeMatch[2];
      const ampm = timeMatch[3].toUpperCase();
      
      if (ampm === 'PM' && hours !== 12) {
        hours += 12;
      } else if (ampm === 'AM' && hours === 12) {
        hours = 0;
      }
      
      return `${hours.toString().padStart(2, '0')}:${minutes}:00`;
    }
    
    // Handle 24-hour format "21:00"
    const time24Match = cleanTime.match(/(\d{1,2}):(\d{2})/);
    if (time24Match) {
      return `${time24Match[1].padStart(2, '0')}:${time24Match[2]}:00`;
    }
    
    return undefined;
  } catch (error) {
    console.log('Error parsing time:', timeStr, error);
    return undefined;
  }
}

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
  updated_at: string;
}

export async function saveLumaEventsToDatabase(events: LumaEvent[]): Promise<{
  inserted: number;
  updated: number;
  errors: string[];
}> {
  console.log('🗄️ Saving Luma events to database...');
  
  if (events.length === 0) {
    console.log('❌ No Luma events to save');
    return { inserted: 0, updated: 0, errors: [] };
  }

  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return { inserted: 0, updated: 0, errors: ['Database connection not available'] };
  }

  // Get existing Luma events from database
  console.log('📊 Fetching existing Luma events from database...');
  const { data: existingEvents, error: fetchError } = await supabaseAdmin
    .from('events')
    .select('source_id, name, date, location')
    .eq('source', 'luma');

  if (fetchError) {
    console.error('❌ Error fetching existing Luma events:', fetchError);
    return { inserted: 0, updated: 0, errors: [fetchError.message] };
  }

  const existingEventIds = new Set(existingEvents?.map(e => e.source_id) || []);
  console.log(`📊 Found ${existingEventIds.size} existing Luma events in database`);

  // Filter events
  const newEvents = events.filter(event => !existingEventIds.has(event.source_id));
  const updatedEvents = events.filter(event => existingEventIds.has(event.source_id));

  console.log(`🆕 Found ${newEvents.length} new Luma events to insert`);
  console.log(`🔄 Found ${updatedEvents.length} existing Luma events to update`);

  const errors: string[] = [];
  let insertedCount = 0;
  let updatedCount = 0;

  // Insert new events
  if (newEvents.length > 0) {
    console.log('💾 Inserting new Luma events...');
    const eventsToInsert: Omit<DatabaseEvent, 'id' | 'created_at' | 'updated_at'>[] = newEvents.map(event => ({
      name: event.name,
      description: event.description || `${event.name} - ${event.category} event`,
      location: event.location,
      address: event.address,
      date: event.date.split('T')[0], // Extract just the date part from ISO string
      time: event.time ? cleanTimeFormat(event.time) : undefined,
      end_time: event.end_time ? cleanTimeFormat(event.end_time) : undefined,
      category: event.category,
      event_type: event.event_type,
      price: event.price,
      currency: event.currency || 'USD',
      max_capacity: event.max_capacity,
      current_attendees: 0,
        organizer: event.organizer,
        organizer_website: event.organizer_website,
        organizer_avatar_url: event.organizer_avatar_url,
        image_url: event.image_url,
        external_url: event.external_url,
      source: event.source,
      source_id: event.source_id,
      is_active: true,
      is_featured: false
    }));

    const { data: insertedEvents, error: insertError } = await supabaseAdmin
      .from('events')
      .insert(eventsToInsert)
      .select();

    if (insertError) {
      console.error('❌ Error inserting new Luma events:', insertError);
      errors.push(`Insert error: ${insertError.message}`);
    } else {
      insertedCount = insertedEvents?.length || 0;
      console.log(`✅ Successfully inserted ${insertedCount} new Luma events`);
    }
  }

  // Update existing events
  if (updatedEvents.length > 0) {
    console.log('🔄 Updating existing Luma events...');
    
    for (const event of updatedEvents) {
      const eventToUpdate = {
        name: event.name,
        description: event.description || `${event.name} - ${event.category} event`,
        location: event.location,
        address: event.address,
        date: event.date.split('T')[0],
        time: event.time ? cleanTimeFormat(event.time) : null,
        end_time: event.end_time ? cleanTimeFormat(event.end_time) : null,
        category: event.category,
        event_type: event.event_type,
        price: event.price,
        currency: event.currency || 'USD',
        max_capacity: event.max_capacity,
        organizer: event.organizer,
        organizer_website: event.organizer_website,
        organizer_avatar_url: event.organizer_avatar_url,
        image_url: event.image_url,
        external_url: event.external_url,
        updated_at: new Date().toISOString()
      };

      const { error: updateError } = await supabaseAdmin
        .from('events')
        .update(eventToUpdate)
        .eq('source', 'luma')
        .eq('source_id', event.source_id);

      if (updateError) {
        console.error(`❌ Error updating Luma event ${event.source_id}:`, updateError);
        errors.push(`Update error for ${event.source_id}: ${updateError.message}`);
      } else {
        updatedCount++;
      }
    }

    console.log(`✅ Successfully updated ${updatedCount} existing Luma events`);
  }

  // Deactivate events that are no longer in the scraped data
  const scrapedEventIds = new Set(events.map(e => e.source_id));
  const eventsToDeactivate = existingEvents?.filter(e => !scrapedEventIds.has(e.source_id)) || [];
  
  if (eventsToDeactivate.length > 0) {
    console.log(`🔒 Deactivating ${eventsToDeactivate.length} Luma events no longer found on website...`);
    
    const { error: deactivateError } = await supabaseAdmin
      .from('events')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('source', 'luma')
      .in('source_id', eventsToDeactivate.map(e => e.source_id));

    if (deactivateError) {
      console.error('❌ Error deactivating Luma events:', deactivateError);
      errors.push(`Deactivate error: ${deactivateError.message}`);
    } else {
      console.log(`✅ Successfully deactivated ${eventsToDeactivate.length} Luma events`);
    }
  }

  return {
    inserted: insertedCount,
    updated: updatedCount,
    errors
  };
}

export async function getLumaEventsFromDatabase(): Promise<DatabaseEvent[]> {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not available');
    return [];
  }

  const { data: events, error } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('source', 'luma')
    .eq('is_active', true)
    .order('date', { ascending: true })
    .order('time', { ascending: true });

  if (error) {
    console.error('Error fetching Luma events from database:', error);
    return [];
  }

  return events || [];
}

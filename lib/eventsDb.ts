import { supabaseAdmin } from './supabase';

export interface UpcomingEvent {
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
  organizer?: string;
  organizer_website?: string;
  organizer_avatar_url?: string;
  image_url?: string;
  external_url?: string;
  source: string;
  source_id: string;
  is_featured: boolean;
}

export async function getUpcomingEvents(limit = 20): Promise<UpcomingEvent[]> {
  if (!supabaseAdmin) {
    console.error('Supabase admin client not available');
    return [];
  }

  const today = new Date().toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('events')
    .select(
      'id, name, description, location, address, date, time, end_time, category, event_type, price, currency, organizer, organizer_website, organizer_avatar_url, image_url, external_url, source, source_id, is_featured'
    )
    .eq('is_active', true)
    .gte('date', today)
    .order('date', { ascending: true })
    .order('time', { ascending: true, nullsFirst: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching upcoming events:', error);
    return [];
  }

  return data || [];
}

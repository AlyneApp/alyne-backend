import { NextRequest, NextResponse } from 'next/server';
import { LumaScraper } from '@/lib/lumaScraper';
import { getLumaEventsFromDatabase } from '@/lib/lumaEventsDb';

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const forceScrape = searchParams.get('force_scrape') === 'true';
    
    if (forceScrape) {
      // Force scrape and return fresh data
      console.log('Force scraping Luma events...');
      const scraper = new LumaScraper();
      
      try {
        const events = await scraper.scrapeEvents();
        
        console.log(`Found ${events.length} Luma events`);
        
        return NextResponse.json({
          success: true,
          events: events,
          count: events.length,
          source: 'luma',
          scraped: true
        });
        
      } finally {
        await scraper.close();
      }
    } else {
      // Return events from database
      console.log('Fetching Luma events from database...');
      const events = await getLumaEventsFromDatabase();
      
      return NextResponse.json({
        success: true,
        events: events,
        count: events.length,
        source: 'luma',
        from_database: true
      });
    }
    
  } catch (error) {
    console.error('Luma events API error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch Luma events',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;
    
    if (action === 'scrape') {
      console.log('Starting Luma events scraping and saving via POST...');
      
      const scraper = new LumaScraper();
      
      try {
        const result = await scraper.scrapeAndSaveEvents();
        
        console.log(`Luma scraping completed: ${result.scraped} scraped, ${result.inserted} inserted, ${result.updated} updated`);
        
        return NextResponse.json({
          success: true,
          scraped: result.scraped,
          inserted: result.inserted,
          updated: result.updated,
          errors: result.errors,
          source: 'luma',
          scraped_at: new Date().toISOString()
        });
        
      } finally {
        await scraper.close();
      }
    }
    
    return NextResponse.json({
      success: false,
      error: 'Invalid action. Use action: "scrape"'
    }, { status: 400 });
    
  } catch (error) {
    console.error('Luma events scraping failed:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      events: [],
      count: 0
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { WebScraper } from '@/lib/webScraper';
  
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: studioId } = await params;

    if (!studioId) {
      return NextResponse.json(
        { error: 'Studio ID is required' },
        { status: 400 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');

    // Fetch studio information
    const { data: studio, error: studioError } = await supabaseAdmin!
      .from('studios')
      .select('*')
      .eq('id', studioId)
      .single();

    if (studioError || !studio) {
      console.error('Error fetching studio:', studioError);
      return NextResponse.json(
        { error: 'Studio not found' },
        { status: 404 }
      );
    }

    let classes: Array<{
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
    }> = [];

    // Try web scraping if studio has a website or booking site
    const websiteUrl = studio.booking_site || studio.website;
    console.log('🔍 Checking for website URL:', { 
      websiteUrl, 
      hasUrl: !!websiteUrl,
      studioName: studio.name,
      bookingSite: studio.booking_site,
      website: studio.website
    });
    
    if (websiteUrl) {
      console.log('🌐 Attempting web scraping for:', websiteUrl);
      try {
        const webScraper = new WebScraper();
        const scrapingConfig = WebScraper.getScrapingConfig(studio.name, websiteUrl, studio.address);
        console.log('🔧 Scraping config:', scrapingConfig);
        
        if (!scrapingConfig) {
          console.log('❌ No scraping config found for this studio');
        }
        
        if (scrapingConfig) {
          const scrapedClasses = await webScraper.scrapeClasses(scrapingConfig, startDate || undefined);
          
          // Transform scraped classes to match database format
          classes = scrapedClasses.map((scrapedClass) => ({
            id: scrapedClass.id,
            name: scrapedClass.name,
            description: scrapedClass.description,
            duration: scrapedClass.duration,
            difficulty_level: scrapedClass.difficulty_level,
            class_type: scrapedClass.class_type,
            max_capacity: scrapedClass.max_capacity,
            price: scrapedClass.price,
            start_time: scrapedClass.start_time,
            end_time: scrapedClass.end_time,
            instructor: scrapedClass.instructor,
            is_available: scrapedClass.is_available,
            total_booked: scrapedClass.total_booked,
            source: 'web_scraping'
          }));
          
          console.log('✅ Web scraping successful, classes:', classes);
        }
      } catch (scrapingError) {
        console.error('❌ Web scraping error:', scrapingError);
      } finally {
        // Close the browser to free up resources
        const webScraper = new WebScraper();
        await webScraper.close();
      }
    } else {
      console.log('⚠️ No website URL found for studio, skipping web scraping');
    }

    // If no classes found from scraping, fall back to database
    if (classes.length === 0) {
      console.log('📊 No classes from web scraping, fetching from database');
      
      const { data: dbClasses, error: dbError } = await supabase
        .from('classes')
        .select(`
          id,
          name,
          description,
          duration,
          difficulty_level,
          class_type,
          max_capacity,
          price
        `)
        .eq('studio_id', studioId)
        .order('name');

      if (dbError) {
        console.error('Error fetching classes from database:', dbError);
        return NextResponse.json(
          { error: 'Failed to fetch classes' },
          { status: 500 }
        );
      }

      classes = (dbClasses || []).map(classItem => ({
        ...classItem,
        source: 'database' as const
      }));
    }

    return NextResponse.json({
      success: true,
      data: classes,
      source: classes.length > 0 ? classes[0].source : 'none',
      message: classes.length === 0 ? 'No classes available for the selected date' : undefined
    });

  } catch (error) {
    console.error('Classes API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
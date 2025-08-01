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
    
    if (websiteUrl) {

      try {
        const webScraper = new WebScraper();
        const scrapingType = WebScraper.getScrapingConfig(websiteUrl);

        
        if (scrapingType) {
          const scrapedClasses = await webScraper.scrapeClasses(websiteUrl, startDate || undefined, studio.address);
          
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
          

        }
      } catch (scrapingError) {
        console.error('Web scraping error:', scrapingError);
      } finally {
        // Close the browser to free up resources
          const webScraper = new WebScraper();
          await webScraper.close();
      }
    } else {

    }

    // If no classes found from scraping, fall back to database
    if (classes.length === 0) {

      
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
import { NextRequest, NextResponse } from 'next/server';
import { WebScraper, MarianaClass } from '../../../lib/webScraper';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { websiteUrl, date, studioAddress } = body;

    // Basic validation
    if (!websiteUrl || !date || !studioAddress) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    const browserlessToken = process.env.BROWSERLESS_TOKEN;
    if (!browserlessToken) {
      return NextResponse.json(
        { error: 'Browserless token not configured' },
        { status: 500 }
      );
    }

    const scraper = new WebScraper(browserlessToken);
    const classes: MarianaClass[] = await scraper.scrapeMarianaClasses(
      websiteUrl,
      date,
      studioAddress
    );

    return NextResponse.json({
      success: true,
      data: classes,
      count: classes.length
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to scrape classes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Mariana Scraper API',
    usage: {
      method: 'POST',
      body: {
        websiteUrl: 'https://*.marianaiframes.com/iframe/schedule/*',
        date: 'YYYY-MM-DD',
        studioAddress: 'string'
      }
    }
  });
} 
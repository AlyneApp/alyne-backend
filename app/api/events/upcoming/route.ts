import { NextRequest, NextResponse } from 'next/server';
import { getUpcomingEvents } from '@/lib/eventsDb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 100) : 20;

    const events = await getUpcomingEvents(limit);

    return NextResponse.json({
      success: true,
      events,
      count: events.length,
    });
  } catch (error) {
    console.error('Upcoming events API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch upcoming events',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

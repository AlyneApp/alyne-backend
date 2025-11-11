import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    })
  : null;

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const body = await request.json();
    const { activityId, eventName, eventPrice, eventDate, eventLocation, eventOrganizer } = body;

    if (!activityId) {
      return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
    }

    // Check if activity exists (for new events, it might not exist yet)
    let finalActivityId: string | null = null;
    
    // Check if it's a temporary ID (starts with 'event-')
    if (activityId.toString().startsWith('event-')) {
      finalActivityId = null; // Temporary ID, set to null
    } else {
      // Try to fetch the activity to verify it exists
      const { data: activityData, error: activityError } = await supabaseAdmin!
        .from('activity_feed')
        .select('id, user_id, extra_data')
        .eq('id', activityId)
        .single();

      if (!activityError && activityData) {
        finalActivityId = activityId; // Activity exists, use the ID
      } else {
        // Activity doesn't exist yet (new event), set to null to avoid foreign key constraint error
        finalActivityId = null;
      }
    }

    // Parse price (handle "Free", "$50", "50", etc.)
    let amount = 0;
    if (eventPrice && eventPrice !== 'Free' && eventPrice !== 'free') {
      const priceStr = eventPrice.toString().replace(/[^0-9.]/g, '');
      amount = Math.round(parseFloat(priceStr) * 100); // Convert to cents
    }

    // If free event, create booking directly without Stripe
    if (amount === 0) {
      const { data: booking, error: bookingError } = await supabaseAdmin!
        .from('event_bookings')
        .insert({
          user_id: user.id,
          activity_id: finalActivityId, // Will be null if activity doesn't exist yet
          event_name: eventName || 'Event',
          price: 0,
          status: 'confirmed',
          payment_intent_id: null,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (bookingError) {
        console.error('Error creating free booking:', bookingError);
        return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        booking: booking,
        isFree: true,
      });
    }

    // For paid events, Stripe is required
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe is not configured. Paid events require Stripe setup.' }, { status: 500 });
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: eventName || 'Event Registration',
              description: eventLocation ? `Event at ${eventLocation}` : 'Event registration',
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/events/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/events/booking-cancel`,
      metadata: {
        activity_id: activityId,
        user_id: user.id,
        event_name: eventName || 'Event',
        event_date: eventDate || '',
        event_location: eventLocation || '',
        event_organizer: eventOrganizer || '',
      },
      customer_email: user.email || undefined,
    });

    // Create pending booking
    const { data: booking, error: bookingError } = await supabaseAdmin!
      .from('event_bookings')
      .insert({
        user_id: user.id,
        activity_id: finalActivityId, // Use finalActivityId (null if activity doesn't exist)
        event_name: eventName || 'Event',
        price: amount / 100, // Store in dollars
        status: 'pending',
        payment_intent_id: session.id, // Checkout session ID
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      // Still return the checkout session URL even if booking creation fails
      // The webhook will handle booking creation on payment success
    }

    return NextResponse.json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url,
      booking: booking,
    });

  } catch (error: any) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create checkout session' },
      { status: 500 }
    );
  }
}


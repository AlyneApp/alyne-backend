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
    // TEST MODE: Allow testing without Stripe configured (will create booking but not process payment)
    const TEST_MODE_WITHOUT_STRIPE = process.env.TEST_MODE_WITHOUT_STRIPE === 'true';
    
    if (!stripe && !TEST_MODE_WITHOUT_STRIPE) {
      return NextResponse.json({ 
        error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables, or set TEST_MODE_WITHOUT_STRIPE=true for testing without payment processing.' 
      }, { status: 500 });
    }

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
    const { activityId, amount } = body;

    if (!activityId || !amount) {
      return NextResponse.json({ error: 'activityId and amount are required' }, { status: 400 });
    }

    // Check if activity exists (for new events, it might not exist yet)
    let activity = null;
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
        activity = activityData;
        finalActivityId = activityId; // Activity exists, use the ID
      } else {
        // Activity doesn't exist yet (new event), set to null to avoid foreign key constraint error
        finalActivityId = null;
      }
    }

    // Convert amount to cents
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // TEST MODE: If Stripe is not configured and test mode is enabled, skip payment processing
    let paymentIntent: any = null;
    let clientSecret: string | null = null;
    let paymentIntentId: string | null = null;

    if (!stripe && TEST_MODE_WITHOUT_STRIPE) {
      // Create a mock payment intent ID for testing
      paymentIntentId = `pi_test_${Date.now()}`;
      clientSecret = `pi_test_${Date.now()}_secret_test`;
      console.log('⚠️ TEST MODE: Skipping Stripe payment processing. Booking will be created with mock payment intent.');
    } else if (stripe) {
      // Create Payment Intent
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        metadata: {
          activity_id: activityId,
          user_id: user.id,
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
    }

    // Create pending booking BEFORE returning payment intent
    // This ensures we have a booking record before the user can complete payment
    const { data: booking, error: bookingError } = await supabaseAdmin!
      .from('event_bookings')
      .insert({
        user_id: user.id,
        activity_id: finalActivityId, // Will be null if activity doesn't exist yet
        event_name: (activity?.extra_data as any)?.event_name || 'Event',
        price: amount,
        status: TEST_MODE_WITHOUT_STRIPE ? 'confirmed' : 'pending', // Auto-confirm in test mode
        payment_intent_id: paymentIntentId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (bookingError) {
      console.error('Error creating booking:', bookingError);
      // Cancel the payment intent since we can't create a booking (only if Stripe is configured)
      if (stripe && paymentIntent) {
        try {
          await stripe.paymentIntents.cancel(paymentIntent.id);
        } catch (cancelError) {
          console.error('Error canceling payment intent:', cancelError);
        }
      }
      return NextResponse.json(
        { error: 'Failed to create booking. Payment was not processed.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      clientSecret: clientSecret,
      paymentIntentId: paymentIntentId,
      booking: booking,
      isTestMode: TEST_MODE_WITHOUT_STRIPE,
    });

  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create payment intent' },
      { status: 500 }
    );
  }
}


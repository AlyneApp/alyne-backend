import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-10-29.clover',
    })
  : null;

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

export async function POST(request: NextRequest) {
  try {
    if (!stripe || !webhookSecret) {
      return NextResponse.json({ error: 'Stripe webhook not configured' }, { status: 500 });
    }

    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      // Update booking status to confirmed
      if (session.metadata?.activity_id && session.payment_status === 'paid') {
        const { error: updateError } = await supabaseAdmin!
          .from('event_bookings')
          .update({
            status: 'confirmed',
            payment_intent_id: session.payment_intent as string,
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', session.id);

        if (updateError) {
          console.error('Error updating booking:', updateError);
        } else {
          console.log('Booking confirmed for activity:', session.metadata.activity_id);
        }
      }
    }

    // Handle Payment Intent succeeded (for in-app payments)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;

      // Update booking status to confirmed
      if (paymentIntent.metadata?.activity_id) {
        const { error: updateError } = await supabaseAdmin!
          .from('event_bookings')
          .update({
            status: 'confirmed',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
          })
          .eq('payment_intent_id', paymentIntent.id);

        if (updateError) {
          console.error('Error updating booking:', updateError);
        } else {
          console.log('Booking confirmed for activity:', paymentIntent.metadata.activity_id);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: error.message || 'Webhook handler failed' },
      { status: 500 }
    );
  }
}


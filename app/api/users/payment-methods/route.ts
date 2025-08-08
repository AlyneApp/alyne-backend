import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { userId, paymentMethod, paymentDetails } = await request.json();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Check if user already has a payment method
    const { data: existingMethod } = await supabaseAdmin
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', userId)
      .single();

    let result;
    if (existingMethod) {
      // Update existing payment method
      const { data, error } = await supabaseAdmin
        .from('user_payment_methods')
        .update({
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        console.error('Error updating payment method:', error);
        return NextResponse.json({ error: 'Failed to update payment method' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new payment method
      const { data, error } = await supabaseAdmin
        .from('user_payment_methods')
        .insert({
          user_id: userId,
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating payment method:', error);
        return NextResponse.json({ error: 'Failed to create payment method' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json({ 
      success: true, 
      data: result 
    });

  } catch (error) {
    console.error('Error in POST /api/users/payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    const { data: paymentMethod, error } = await supabaseAdmin
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Error fetching payment method:', error);
      return NextResponse.json({ error: 'Failed to fetch payment method' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: paymentMethod || null 
    });

  } catch (error) {
    console.error('Error in GET /api/users/payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

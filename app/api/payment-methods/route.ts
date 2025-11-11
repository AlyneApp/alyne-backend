import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper function to authenticate user
async function authenticateUser(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Authorization header required', user: null };
  }

  const token = authHeader.substring(7);
  const { data: { user }, error: authError } = await supabaseAdmin!.auth.getUser(token);

  if (authError || !user) {
    return { error: 'Invalid authentication token', user: null };
  }

  return { error: null, user };
}

export async function POST(request: NextRequest) {
  try {
    const { error: authError, user } = await authenticateUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { paymentMethod, paymentDetails, userId } = body;

    console.log('Payment method creation request:', {
      userId: userId,
      paymentMethod: paymentMethod,
      paymentDetails: paymentDetails,
      bodyKeys: Object.keys(body)
    });

    if (!paymentMethod || !paymentDetails) {
      console.error('Missing required fields:', { paymentMethod: !!paymentMethod, paymentDetails: !!paymentDetails });
      return NextResponse.json({ error: 'Payment method and details are required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Check if user already has a payment method
    const { data: existingPaymentMethod } = await supabaseAdmin
      .from('user_payment_methods')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    let data, error;
    
    if (existingPaymentMethod) {
      // Update existing payment method
      const { data: updatedData, error: updateError } = await supabaseAdmin
        .from('user_payment_methods')
        .update({
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', user.id)
        .select()
        .single();
      
      data = updatedData;
      error = updateError;
    } else {
      // Create new payment method
      const { data: insertedData, error: insertError } = await supabaseAdmin
        .from('user_payment_methods')
        .insert({
          user_id: user.id,
          payment_method: paymentMethod,
          payment_details: paymentDetails,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();
      
      data = insertedData;
      error = insertError;
    }

    if (error) {
      console.error('Error creating payment method:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('User ID:', user.id);
      console.error('Payment Method:', paymentMethod);
      console.error('Payment Details:', paymentDetails);
      return NextResponse.json({ 
        error: 'Failed to create payment method',
        details: error.message || error.details || 'Unknown error'
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: data 
    });

  } catch (error) {
    console.error('Error in POST /api/payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { error: authError, user } = await authenticateUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Get all payment methods for the authenticated user
    const { data: paymentMethods, error } = await supabaseAdmin
      .from('user_payment_methods')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching payment methods:', error);
      return NextResponse.json({ error: 'Failed to fetch payment methods' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: paymentMethods || [] 
    });

  } catch (error) {
    console.error('Error in GET /api/payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { error: authError, user } = await authenticateUser(request);
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Payment method ID is required' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Verify the payment method belongs to the user before deleting
    const { data: paymentMethod, error: fetchError } = await supabaseAdmin
      .from('user_payment_methods')
      .select('user_id')
      .eq('id', id)
      .single();

    if (fetchError || !paymentMethod) {
      return NextResponse.json({ error: 'Payment method not found' }, { status: 404 });
    }

    if (paymentMethod.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the payment method
    const { error: deleteError } = await supabaseAdmin
      .from('user_payment_methods')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (deleteError) {
      console.error('Error deleting payment method:', deleteError);
      return NextResponse.json({ error: 'Failed to delete payment method' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Payment method deleted successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/payment-methods:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

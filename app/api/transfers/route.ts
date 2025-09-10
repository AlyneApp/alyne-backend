import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { bookingData, paymentMethod, paymentDetails, transferType, userId } = await request.json();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // For claimed bookings, we might not have a valid original_booking_id
    // Check if the booking exists in the bookings table
    const { data: existingBooking } = await supabaseAdmin
      .from('bookings')
      .select('id')
      .eq('id', bookingData.id)
      .single();

    // If the booking doesn't exist, it might be a claimed booking
    // In this case, we'll set original_booking_id to null and handle it as a standalone transfer
    const originalBookingId = existingBooking ? bookingData.id : null;

    // Create a new transfer record
    const { data: transfer, error } = await supabaseAdmin
      .from('booking_transfers')
      .insert({
        original_booking_id: originalBookingId,
        transferrer_id: userId,
        studio_name: bookingData.studioName,
        class_name: bookingData.className,
        instructor_name: bookingData.instructorName,
        date: bookingData.date,
        time: bookingData.time,
        price: bookingData.price,
        booking_type: bookingData.bookingType,
        studio_image: bookingData.studioImage,
        payment_method: paymentMethod,
        payment_details: paymentDetails,
        transfer_type: transferType, // 'member' or 'feed'
        status: 'available', // 'available', 'claimed', 'completed', 'cancelled'
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating transfer:', error);
      return NextResponse.json({ error: 'Failed to create transfer' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: transfer 
    });

  } catch (error) {
    console.error('Error in POST /api/transfers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'available';
    const userId = searchParams.get('userId');
    const transferrerId = searchParams.get('transferrer_id');
    const claimerId = searchParams.get('claimer_id');

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    let query = supabaseAdmin
      .from('booking_transfers')
      .select(`
        *,
        transferrer:users!booking_transfers_transferrer_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        ),
        claimer:users!booking_transfers_claimer_id_fkey(
          id,
          username,
          full_name,
          avatar_url
        )
      `);

    if (transferrerId) {
      query = query.eq('transferrer_id', transferrerId);
    } else if (claimerId) {
      query = query.eq('claimer_id', claimerId);
    } else {
      query = query.eq('status', status);

      if (userId) {
        if (status === 'claimed') {
          query = query.eq('claimer_id', userId);
        } else if (status === 'transferred') {
          query = query.eq('transferrer_id', userId);
        }
      }
    }

    const { data: transfers, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching transfers:', error);
      return NextResponse.json({ error: 'Failed to fetch transfers' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      data: transfers 
    });

  } catch (error) {
    console.error('Error in GET /api/transfers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transferId = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!transferId || !userId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // First, verify the transfer belongs to the user
    const { data: transfer, error: fetchError } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('transferrer_id', userId)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: 'Transfer not found or access denied' }, { status: 404 });
    }

    // Only allow cancellation if the transfer is still available
    if (transfer.status !== 'available') {
      return NextResponse.json({ error: 'Cannot cancel a transfer that has been claimed' }, { status: 400 });
    }

    // Delete the transfer
    const { error: deleteError } = await supabaseAdmin
      .from('booking_transfers')
      .delete()
      .eq('id', transferId)
      .eq('transferrer_id', userId);

    if (deleteError) {
      console.error('Error deleting transfer:', deleteError);
      return NextResponse.json({ error: 'Failed to delete transfer' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Transfer cancelled successfully' 
    });

  } catch (error) {
    console.error('Error in DELETE /api/transfers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

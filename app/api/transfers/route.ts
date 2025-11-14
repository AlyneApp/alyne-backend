import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { bookingData, paymentMethod, paymentDetails, transferType, userId } = await request.json();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // For manual bookings, the ID might be "manual-..." which is not a valid UUID
    // Check if the booking ID is a valid UUID before checking the bookings table
    const isManualBooking = bookingData.id && bookingData.id.startsWith('manual-');
    let originalBookingId = null;

    if (!isManualBooking && bookingData.id) {
      // Only check for existing booking if it's a valid UUID format
      try {
        const { data: existingBooking } = await supabaseAdmin
          .from('bookings')
          .select('id')
          .eq('id', bookingData.id)
          .single();

        originalBookingId = existingBooking ? bookingData.id : null;
      } catch {
        // If booking doesn't exist or ID is invalid, set to null
        originalBookingId = null;
      }
    }

    // Prepare the insert data
    const insertData: any = {
      transferrer_id: userId,
      studio_name: bookingData.studioName,
      class_name: bookingData.className,
      instructor_name: bookingData.instructorName,
      date: bookingData.date,
      time: bookingData.time,
      price: bookingData.price,
      booking_type: bookingData.bookingType,
      transfer_type: transferType, // 'member' or 'feed'
      status: 'available', // 'available', 'claimed', 'completed', 'cancelled'
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Only include original_booking_id if it's not null (for real bookings)
    if (originalBookingId) {
      insertData.original_booking_id = originalBookingId;
    }

    // Only include optional fields if they have values
    if (bookingData.studioImage) {
      insertData.studio_image = bookingData.studioImage;
    }
    if (paymentMethod) {
      insertData.payment_method = paymentMethod;
    }
    if (paymentDetails) {
      insertData.payment_details = paymentDetails;
    }

    // Create a new transfer record
    const { data: transfer, error } = await supabaseAdmin
      .from('booking_transfers')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating transfer:', error);
      console.error('Insert data:', JSON.stringify(insertData, null, 2));
      return NextResponse.json({ 
        error: 'Failed to create transfer',
        details: error.message || String(error),
        code: error.code
      }, { status: 500 });
    }

    // If this is a feed transfer, create an activity feed entry
    if (transferType === 'feed') {
      // Get studio information
      const { data: studio } = await supabaseAdmin
        .from('studios')
        .select('id, name')
        .eq('name', bookingData.studioName)
        .single();

      // Create activity feed entry for the transfer
      const { error: activityError } = await supabaseAdmin
        .from('activity_feed')
        .insert({
          user_id: userId,
          type: 'class_transfer',
          studio_id: studio?.id || null,
          content: `New Transfer Available: ${bookingData.className} at ${bookingData.studioName}`,
          extra_data: {
            class_name: bookingData.className,
            class_schedule: `${bookingData.date} ${bookingData.time}`,
            transfer_id: transfer.id
          },
          visibility: 'public'
        });

      if (activityError) {
        console.error('Error creating activity feed entry:', activityError);
        // Don't fail the transfer creation if activity feed fails
      }
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

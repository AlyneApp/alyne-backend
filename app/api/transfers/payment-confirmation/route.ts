import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { transferId, claimerId } = body;

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Get the transfer details
    const { data: transfer, error: fetchError } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('status', 'available')
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: 'Transfer not available or not found' }, { status: 404 });
    }

    // Update the transfer to payment_pending status
    const { data: updatedTransfer, error: updateError } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        claimer_id: claimerId,
        status: 'payment_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating transfer:', updateError);
      return NextResponse.json({ error: 'Failed to update transfer' }, { status: 500 });
    }

    const { data: claimerData, error: claimerError } = await supabaseAdmin
      .from('users')
      .select('full_name, username')
      .eq('id', claimerId)
      .single();

    if (claimerError) {
      console.error('Error fetching claimer data:', claimerError);
    }

    const claimerName = claimerData?.full_name || claimerData?.username || 'Someone';
    
    // Create a notification for the transferrer
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        from_user_id: claimerId,
        to_user_id: transfer.transferrer_id,
        type: 'payment_confirmation',
        message: `${claimerName} wants to claim your ${transfer.class_name} booking. Confirm payment?`,
        related_id: transferId,
        extra_data: {
          transfer_id: transferId,
          claimer_id: claimerId,
          class_name: transfer.class_name,
          studio_name: transfer.studio_name,
          date: transfer.date,
          time: transfer.time,
          price: transfer.price
        },
        created_at: new Date().toISOString()
      });

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the request if notification fails
    }

    return NextResponse.json({
      success: true,
      data: updatedTransfer,
      message: 'Payment confirmation request sent to the booking poster'
    });

  } catch (error) {
    console.error('Error in POST /api/transfers/payment-confirmation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

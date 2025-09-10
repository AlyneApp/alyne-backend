import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { transferId, claimerId } = await request.json();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // First, check if the transfer is still available
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
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferId)
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
      `)
      .single();

    if (updateError) {
      console.error('Error claiming transfer:', updateError);
      return NextResponse.json({ error: 'Failed to claim transfer' }, { status: 500 });
    }

    // Get claimer data for notifications
    const { data: claimerData, error: claimerError } = await supabaseAdmin
      .from('users')
      .select('full_name, username')
      .eq('id', claimerId)
      .single();

    if (claimerError) {
      console.error('Error fetching claimer data:', claimerError);
    }

    const claimerName = claimerData?.full_name || claimerData?.username || 'Someone';

    // Create first notification: informational (no action buttons)
    const { error: infoNotificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        from_user_id: claimerId,
        to_user_id: transfer.transferrer_id,
        type: 'booking_claimed',
        message: `${claimerName} claimed your booking for ${transfer.class_name} with ${transfer.instructor_name} on ${transfer.date} at ${transfer.time} at ${transfer.studio_name}.`,
        related_id: transferId,
        extra_data: {
          transfer_id: transferId,
          claimer_id: claimerId,
          class_name: transfer.class_name,
          instructor_name: transfer.instructor_name,
          studio_name: transfer.studio_name,
          date: transfer.date,
          time: transfer.time,
          price: transfer.price
        },
        status: 'completed', // No action needed for this notification
        created_at: new Date().toISOString()
      });

    if (infoNotificationError) {
      console.error('Error creating info notification:', infoNotificationError);
    }

    // Create second notification: payment confirmation request (with action buttons)
    const { error: paymentNotificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        from_user_id: claimerId,
        to_user_id: transfer.transferrer_id,
        type: 'payment_confirmation',
        message: `Has ${claimerName} sent payment for your booking of ${transfer.class_name} on ${transfer.date} at ${transfer.time} at ${transfer.studio_name}?`,
        related_id: transferId,
        extra_data: {
          transfer_id: transferId,
          claimer_id: claimerId,
          class_name: transfer.class_name,
          instructor_name: transfer.instructor_name,
          studio_name: transfer.studio_name,
          date: transfer.date,
          time: transfer.time,
          price: transfer.price
        },
        status: 'pending', // This one needs action
        created_at: new Date().toISOString()
      });

    if (paymentNotificationError) {
      console.error('Error creating payment notification:', paymentNotificationError);
    }

    return NextResponse.json({ 
      success: true, 
      data: updatedTransfer 
    });

  } catch (error) {
    console.error('Error in POST /api/transfers/claim:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

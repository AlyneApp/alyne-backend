import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { transferId, transferrerId } = await request.json();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Get the transfer details
    const { data: transfer, error: fetchError } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('transferrer_id', transferrerId)
      .eq('status', 'payment_pending')
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ error: 'Transfer not found or not in payment pending status' }, { status: 404 });
    }

    // Update the transfer to claimed status
    const { data: updatedTransfer, error: updateError } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        status: 'claimed',
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
      console.error('Error updating transfer:', updateError);
      return NextResponse.json({ error: 'Failed to confirm payment' }, { status: 500 });
    }

    const { data: transferrerData, error: transferrerError } = await supabaseAdmin
      .from('users')
      .select('full_name, username')
      .eq('id', transfer.transferrer_id)
      .single();

    if (transferrerError) {
      console.error('Error fetching transferrer data:', transferrerError);
    }

    const transferrerName = transferrerData?.full_name || transferrerData?.username || 'The poster';
    
    // Create a notification for the claimer
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        from_user_id: transfer.transferrer_id,
        to_user_id: transfer.claimer_id,
        type: 'payment_confirmed',
        message: `${transferrerName} confirmed your payment for ${transfer.class_name}.`,
        related_id: transferId,
        extra_data: {
          transfer_id: transferId,
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
      message: 'Payment confirmed and booking transferred successfully'
    });

  } catch (error) {
    console.error('Error in POST /api/transfers/confirm-payment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

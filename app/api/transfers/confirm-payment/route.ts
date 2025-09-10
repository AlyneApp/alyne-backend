import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { transferId, transferrerId, notificationId } = await request.json();

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Get the transfer details
    const { data: transfer, error: fetchError } = await supabaseAdmin
      .from('booking_transfers')
      .select('*')
      .eq('id', transferId)
      .eq('status', 'payment_pending')
      .single();

    if (fetchError || !transfer) {
      console.error('Transfer fetch error:', fetchError);
      return NextResponse.json({ error: 'Transfer not found or not in payment pending status' }, { status: 404 });
    }

    // Verify that the transferrerId matches (if provided)
    if (transferrerId && transfer.transferrer_id !== transferrerId) {
      console.error('Transferrer ID mismatch:', { provided: transferrerId, actual: transfer.transferrer_id });
      return NextResponse.json({ error: 'Unauthorized: Transferrer ID does not match' }, { status: 403 });
    }

    // Update the transfer to completed status
    const { data: updatedTransfer, error: updateError } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
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

    // Mark the payment confirmation notification as accepted
    if (notificationId) {
      const { error: notificationUpdateError } = await supabaseAdmin
        .from('notifications')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('to_user_id', transferrerId);

      if (notificationUpdateError) {
        console.error('Error updating notification status:', notificationUpdateError);
      }
    }

    const { error: transferrerError } = await supabaseAdmin
      .from('users')
      .select('full_name, username')
      .eq('id', transfer.transferrer_id)
      .single();

    if (transferrerError) {
      console.error('Error fetching transferrer data:', transferrerError);
    }

    // const transferrerName = transferrerData?.full_name || transferrerData?.username || 'The poster';
    
    // Create a notification for the claimer confirming the transfer
    const { error: notificationError } = await supabaseAdmin
      .from('notifications')
      .insert({
        from_user_id: transfer.transferrer_id,
        to_user_id: transfer.claimer_id,
        type: 'payment_confirmed',
        message: `Payment confirmed. ${transfer.class_name} with ${transfer.instructor_name} on ${transfer.date} at ${transfer.time} at ${transfer.studio_name} is now officially yours.`,
        related_id: transferId,
        extra_data: {
          transfer_id: transferId,
          class_name: transfer.class_name,
          instructor_name: transfer.instructor_name,
          studio_name: transfer.studio_name,
          date: transfer.date,
          time: transfer.time,
          price: transfer.price
        },
        status: 'completed',
        created_at: new Date().toISOString()
      });

    if (notificationError) {
      console.error('Error creating notification:', notificationError);
      // Don't fail the request if notification fails
    }

    // Transfer the original booking to the claimer
    const { error: bookingTransferError } = await supabaseAdmin
      .from('bookings')
      .update({
        user_id: transfer.claimer_id,
        status: 'confirmed', // Reset to confirmed status for the new owner
        updated_at: new Date().toISOString()
      })
      .eq('id', transfer.original_booking_id);

    if (bookingTransferError) {
      console.error('Error transferring booking:', bookingTransferError);
      // Don't fail the entire request if booking transfer fails
      // The transfer record is already marked as completed
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

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

    // Update the transfer to claimed status
    const { data: updatedTransfer, error: updateError } = await supabaseAdmin
      .from('booking_transfers')
      .update({
        claimer_id: claimerId,
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
      console.error('Error claiming transfer:', updateError);
      return NextResponse.json({ error: 'Failed to claim transfer' }, { status: 500 });
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

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST() {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    console.log('Updating booking_transfers status constraint...');

    // Drop the existing constraint
    const { error: dropError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE booking_transfers DROP CONSTRAINT IF EXISTS booking_transfers_status_check;'
    });

    if (dropError) {
      console.error('Error dropping constraint:', dropError);
      return NextResponse.json({ error: 'Failed to drop constraint' }, { status: 500 });
    }

    // Add the new constraint with payment_pending status
    const { error: addError } = await supabaseAdmin.rpc('exec_sql', {
      sql: 'ALTER TABLE booking_transfers ADD CONSTRAINT booking_transfers_status_check CHECK (status IN (\'available\', \'payment_pending\', \'claimed\', \'completed\', \'cancelled\'));'
    });

    if (addError) {
      console.error('Error adding constraint:', addError);
      return NextResponse.json({ error: 'Failed to add constraint' }, { status: 500 });
    }

    console.log('Successfully updated booking_transfers status constraint');

    return NextResponse.json({
      success: true,
      message: 'Database constraint updated successfully'
    });

  } catch (error) {
    console.error('Error in POST /api/transfers/update-constraint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


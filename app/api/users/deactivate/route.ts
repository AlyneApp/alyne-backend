import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

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

    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
    }

    // Make profile undiscoverable by setting is_private to true
    // This will make the profile not visible in searches and discovery
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ is_private: true })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error deactivating account:', updateError);
      return NextResponse.json({ error: 'Failed to deactivate account' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Account deactivated successfully',
    });
  } catch (error) {
    console.error('Error in POST /api/users/deactivate:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


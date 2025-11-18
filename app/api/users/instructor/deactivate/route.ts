import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const admin = supabaseAdmin;
    if (!admin) {
      console.error('Admin client not available for instructor deactivation');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) {
      console.error('Instructor deactivate auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    const { error: updateError } = await admin
      .from('users')
      .update({ is_instructor: false })
      .eq('id', user.id);

    if (updateError) {
      console.error('Error updating user to regular profile:', updateError);
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Instructor profile disabled successfully',
      data: {
        user_id: user.id,
        is_instructor: false,
      },
    });
  } catch (error) {
    console.error('Instructor deactivate API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


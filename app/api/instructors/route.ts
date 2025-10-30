import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    // Fetch all users who are instructors
    const { data: instructors, error: instructorsError } = await supabaseAdmin!
      .from('users')
      .select(`
        id,
        username,
        full_name,
        avatar_url,
        is_instructor
      `)
      .eq('is_instructor', true)
      .order('full_name', { ascending: true });

    if (instructorsError) {
      console.error('Error fetching instructors:', instructorsError);
      return NextResponse.json({ error: 'Failed to fetch instructors' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: instructors || [],
    });

  } catch (error) {
    console.error('Instructors API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

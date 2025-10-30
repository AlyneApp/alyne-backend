import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: instructorUserId } = await params;

    // Ensure instructor exists
    const { data: instructor, error: instructorError } = await supabaseAdmin!
      .from('users')
      .select('id, username, full_name')
      .eq('id', instructorUserId)
      .eq('is_instructor', true)
      .single();

    if (instructorError || !instructor) {
      return NextResponse.json({ error: 'Instructor not found' }, { status: 404 });
    }

    // Fetch ratings for this instructor
    const { data: ratings, error: ratingsError } = await supabaseAdmin!
      .from('activity_ratings')
      .select(`
        id,
        rating,
        comment,
        created_at,
        user_id
      `)
      .eq('rating_type', 'instructor')
      .eq('rated_entity_id', instructorUserId)
      .order('created_at', { ascending: false });

    if (ratingsError) {
      console.error('Error fetching instructor ratings:', ratingsError);
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 });
    }

    const userIds = ratings?.map(r => r.user_id) || [];
    let userData: Record<string, { username: string | null; full_name: string | null; avatar_url: string | null } > = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabaseAdmin!
        .from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', userIds);
      if (!usersError && users) {
        users.forEach(u => {
          userData[u.id] = { username: u.username, full_name: u.full_name, avatar_url: u.avatar_url };
        });
      }
    }

    const result = (ratings || []).map(r => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      user: {
        id: r.user_id,
        username: userData[r.user_id]?.username || null,
        full_name: userData[r.user_id]?.full_name || null,
        avatar_url: userData[r.user_id]?.avatar_url || null,
      },
    }));

    console.log('Instructor ratings result:', result);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error('Instructor ratings API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



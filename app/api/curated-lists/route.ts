import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

// GET - Fetch all active curated lists with their studios
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const client = supabaseAdmin || supabase;

    // Fetch active lists ordered by position
    const { data: lists, error: listsError } = await client
      .from('curated_lists')
      .select('id, slug, title, description, image_url, position')
      .eq('is_active', true)
      .order('position', { ascending: true });

    if (listsError) {
      console.error('Error fetching curated lists:', listsError);
      return NextResponse.json({ error: 'Failed to fetch curated lists' }, { status: 500 });
    }

    if (!lists || lists.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const listIds = lists.map((l) => l.id);

    // Fetch all list↔studio links for these lists, ordered
    const { data: links, error: linksError } = await client
      .from('curated_list_studios')
      .select('list_id, studio_id, position')
      .in('list_id', listIds)
      .order('position', { ascending: true });

    if (linksError) {
      console.error('Error fetching curated list studios:', linksError);
      return NextResponse.json({ error: 'Failed to fetch list studios' }, { status: 500 });
    }

    // Fetch the actual studio records for the linked studios
    const studioIds = [...new Set((links || []).map((l) => l.studio_id))];
    let studioMap: Record<string, any> = {};

    if (studioIds.length > 0) {
      const { data: studios, error: studiosError } = await client
        .from('studios')
        .select('id, name, address, description, type')
        .in('id', studioIds);

      if (studiosError) {
        console.error('Error fetching studios for curated lists:', studiosError);
        return NextResponse.json({ error: 'Failed to fetch studios' }, { status: 500 });
      }

      (studios || []).forEach((s: any) => {
        studioMap[s.id] = s;
      });
    }

    // Group studios by list, preserving the link ordering
    const studiosByList: Record<string, any[]> = {};
    (links || []).forEach((link) => {
      if (!studiosByList[link.list_id]) studiosByList[link.list_id] = [];
      const studio = studioMap[link.studio_id];
      if (studio) studiosByList[link.list_id].push(studio);
    });

    const enriched = lists.map((list) => ({
      ...list,
      studios: studiosByList[list.id] || [],
    }));

    return NextResponse.json({ success: true, data: enriched });

  } catch (error) {
    console.error('Curated lists API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

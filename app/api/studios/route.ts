import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { name, type, address } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Studio name is required' }, { status: 400 });
    }

    const client = supabaseAdmin || supabase;
    const { data: studio, error } = await client
      .from('studios')
      .insert({
        name: name.trim(),
        type: type || null,
        address: address || null,
      })
      .select('id, name, address, description, type')
      .single();

    if (error) {
      console.error('Error creating studio:', error);
      return NextResponse.json({ error: 'Failed to create studio' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: studio,
    });

  } catch (error) {
    console.error('Studios POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get all studios
    const { data: studios, error } = await supabase
      .from('studios')
      .select(`
        id,
        name,
        address,
        description,
        type
      `)
      .order('name');

    if (error) {
      console.error('Error fetching studios:', error);
      return NextResponse.json(
        { error: 'Failed to fetch studios' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: studios || [],
    });

  } catch (error) {
    console.error('Studios API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
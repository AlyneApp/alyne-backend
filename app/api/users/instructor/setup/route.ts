import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);

    // Ensure admin client is available before use
    const admin = supabaseAdmin;
    if (!admin) {
      console.error('Admin client not available');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    // Verify the token and get the user
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

    // Get the request body
    const body = await request.json();
    const {
      specialtyDescriptor,
      studios,
      bio,
      certifications,
      contactInfo,
      instagram,
      tiktok,
      youtube,
      website,
    } = body;

    // Validate required fields
    if (!specialtyDescriptor || !studios) {
      return NextResponse.json(
        { error: 'Specialty Descriptor and Studios/Gyms are required fields' },
        { status: 400 }
      );
    }

    // Check if admin client is available
    // admin is guaranteed by the earlier guard

    // Update the user's is_instructor field to true (idempotent)
    const { error: updateUserError } = await admin
      .from('users')
      .update({ is_instructor: true })
      .eq('id', user.id);

    if (updateUserError) {
      console.error('Error updating user is_instructor:', updateUserError);
      return NextResponse.json(
        { error: 'Failed to update user profile' },
        { status: 500 }
      );
    }

    // Check if instructor_details already exists
    const { data: existingDetails, error: fetchDetailsError } = await admin
      .from('instructor_details')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchDetailsError) {
      console.error('Error fetching existing instructor details:', fetchDetailsError);
      return NextResponse.json(
        { error: 'Failed to verify instructor profile' },
        { status: 500 }
      );
    }

    let instructorDetails;
    if (existingDetails) {
      const { data: updatedDetails, error: updateDetailsError } = await admin
        .from('instructor_details')
        .update({
          specialty_descriptor: specialtyDescriptor,
          studios: studios,
          bio: bio || null,
          certifications: certifications || null,
          contact_info: contactInfo || null,
          instagram: instagram || null,
          tiktok: tiktok || null,
          youtube: youtube || null,
          website: website || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingDetails.id)
        .select()
        .single();

      if (updateDetailsError) {
        console.error('Error updating instructor details:', updateDetailsError);
        return NextResponse.json(
          { error: 'Failed to update instructor profile' },
          { status: 500 }
        );
      }
      instructorDetails = updatedDetails;
    } else {
      const { data: newDetails, error: createDetailsError } = await admin
        .from('instructor_details')
        .insert([{
          user_id: user.id,
          specialty_descriptor: specialtyDescriptor,
          studios: studios,
          bio: bio || null,
          certifications: certifications || null,
          contact_info: contactInfo || null,
          instagram: instagram || null,
          tiktok: tiktok || null,
          youtube: youtube || null,
          website: website || null,
        }])
        .select()
        .single();

      if (createDetailsError) {
        console.error('Error creating instructor details:', createDetailsError);
        return NextResponse.json(
          { error: 'Failed to create instructor profile' },
          { status: 500 }
        );
      }
      instructorDetails = newDetails;
    }

    return NextResponse.json({
      success: true,
      message: 'Instructor profile created successfully',
      data: {
        user_id: user.id,
        is_instructor: true,
        instructor_details: instructorDetails,
      },
    });

  } catch (error) {
    console.error('Instructor setup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


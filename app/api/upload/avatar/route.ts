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
    
    if (!supabaseAdmin) {
      return NextResponse.json(
        { error: 'Storage service not configured' },
        { status: 500 }
      );
    }
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401 }
      );
    }

                    const formData = await request.formData();
                const file = formData.get('file') as File;
                const imageData = formData.get('imageData') as string;
                
                let buffer: Buffer;
                let contentType: string;
                let fileName: string;

                if (file) {
                  // Handle File object (web)
                  if (!file.type.startsWith('image/')) {
                    return NextResponse.json(
                      { error: 'File must be an image' },
                      { status: 400 }
                    );
                  }

                  // Validate file size (max 5MB)
                  const maxSize = 5 * 1024 * 1024; // 5MB
                  if (file.size > maxSize) {
                    return NextResponse.json(
                      { error: 'File size must be less than 5MB' },
                      { status: 400 }
                    );
                  }

                  const bytes = await file.arrayBuffer();
                  buffer = Buffer.from(bytes);
                  contentType = file.type;
                  fileName = file.name;
                } else if (imageData) {
                  // Handle base64 image data (React Native)
                  try {
                    console.log('Processing base64 image data, length:', imageData.length);
                    
                    // Convert base64 to buffer
                    buffer = Buffer.from(imageData, 'base64');
                    contentType = 'image/jpeg';
                    fileName = `avatar-${Date.now()}.jpg`;
                    
                    // Validate file size (max 5MB)
                    const maxSize = 5 * 1024 * 1024; // 5MB
                    if (buffer.length > maxSize) {
                      return NextResponse.json(
                        { error: 'File size must be less than 5MB' },
                        { status: 400 }
                      );
                    }
                    
                    console.log('Successfully processed base64 image:', {
                      size: buffer.length,
                      contentType,
                      fileName
                    });
                  } catch (error) {
                    console.error('Error processing base64 image:', error);
                    return NextResponse.json(
                      { error: 'Failed to process image' },
                      { status: 400 }
                    );
                  }
                } else {
                  return NextResponse.json(
                    { error: 'No file or image data provided' },
                    { status: 400 }
                  );
                }

    // Generate unique filename
    const fileExt = fileName.split('.').pop();
    const uniqueFileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `avatars/${uniqueFileName}`;

    // Check if avatars bucket exists, create if it doesn't
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const avatarsBucketExists = buckets?.some(bucket => bucket.name === 'avatars');
    
    if (!avatarsBucketExists) {
      console.log('Creating avatars bucket...');
      const { error: createBucketError } = await supabaseAdmin.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        fileSizeLimit: 5242880, // 5MB
      });
      
      if (createBucketError) {
        console.error('Error creating bucket:', createBucketError);
        return NextResponse.json(
          { error: 'Failed to create storage bucket' },
          { status: 500 }
        );
      }
      console.log('Avatars bucket created successfully');
    }

    // Upload to Supabase Storage
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: contentType,
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(filePath);

    return NextResponse.json({
      success: true,
      data: {
        url: urlData.publicUrl,
        path: filePath
      }
    });

  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
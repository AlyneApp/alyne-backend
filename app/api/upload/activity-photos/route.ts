import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// Image moderation is dynamically imported to avoid build-time issues

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid authentication' }, { status: 401 });
    }

    const formData = await request.formData();
    const imageData = formData.get('imageData') as string;

    console.log('📸 Activity Photos API - Received request:', {
      hasImageData: !!imageData,
      imageDataLength: imageData?.length || 0,
      imageDataPreview: imageData?.substring(0, 50) + '...' || 'none'
    });

    if (!imageData) {
      console.log('📸 Activity Photos API - No image data provided');
      return NextResponse.json(
        { error: 'No image data provided' },
        { status: 400 }
      );
    }

    let buffer: Buffer;
    let contentType: string;
    let fileName: string;

    try {
      console.log('Processing base64 image data for activity photo, length:', imageData.length);
      
      // Convert base64 to buffer
      buffer = Buffer.from(imageData, 'base64');
      contentType = 'image/jpeg';
      fileName = `activity-photo-${Date.now()}.jpg`;
      
      // Validate file size (max 10MB for activity photos)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (buffer.length > maxSize) {
        return NextResponse.json(
          { error: 'File size must be less than 10MB' },
          { status: 400 }
        );
      }

      // Moderate image using NSFW.js (free) - dynamically imported
      try {
        const { moderateImage } = await import('@/lib/moderation/image');
        const moderationResult = await moderateImage(buffer);
        
        if (moderationResult.flagged) {
          console.log('🚫 Image flagged by moderation:', {
            reason: moderationResult.reason,
            scores: moderationResult.scores
          });
          
          return NextResponse.json(
            { 
              error: 'Image violates content policy',
              flagged: true,
              reason: moderationResult.reason,
              details: moderationResult.scores
            },
            { status: 400 }
          );
        }
      } catch (moderationError) {
        console.error('Error moderating image (allowing upload):', moderationError);
        // Fail open - if moderation fails, allow upload
        // You can change this to fail closed if preferred
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

    // Generate unique filename
    const fileExt = fileName.split('.').pop();
    const uniqueFileName = `${user.id}-${Date.now()}.${fileExt}`;
    const filePath = `activity-photos/${uniqueFileName}`;

    // Check if activity-photos bucket exists, create if it doesn't
    const { data: buckets } = await supabaseAdmin.storage.listBuckets();
    const activityPhotosBucketExists = buckets?.some(bucket => bucket.name === 'activity-photos');
    
    if (!activityPhotosBucketExists) {
      console.log('Creating activity-photos bucket...');
      const { error: bucketError } = await supabaseAdmin.storage.createBucket('activity-photos', {
        public: true,
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        fileSizeLimit: 10485760, // 10MB
      });
      
      if (bucketError) {
        console.error('Error creating bucket:', bucketError);
        return NextResponse.json(
          { error: 'Failed to create storage bucket' },
          { status: 500 }
        );
      }
    }

    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('activity-photos')
      .upload(filePath, buffer, {
        contentType,
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload image' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('activity-photos')
      .getPublicUrl(filePath);

    console.log('📸 Activity Photos API - Successfully uploaded:', {
      path: uploadData.path,
      url: urlData.publicUrl
    });

    const response = {
      success: true,
      data: {
        url: urlData.publicUrl,
        path: uploadData.path
      }
    };

    console.log('📸 Activity Photos API - Returning response:', response);

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error in activity photos upload API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

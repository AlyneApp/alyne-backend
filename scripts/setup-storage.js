const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function setupStorage() {
  try {
    console.log('Setting up storage buckets...');

    // Create avatars bucket
    const { data: avatarsBucket, error: avatarsError } = await supabase.storage.createBucket('avatars', {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      fileSizeLimit: 5242880, // 5MB
    });

    if (avatarsError) {
      if (avatarsError.message.includes('already exists')) {
        console.log('✅ Avatars bucket already exists');
      } else {
        console.error('❌ Error creating avatars bucket:', avatarsError);
      }
    } else {
      console.log('✅ Created avatars bucket');
    }

    console.log('✅ Storage bucket created successfully');

    console.log('✅ Storage setup complete!');
  } catch (error) {
    console.error('❌ Error setting up storage:', error);
  }
}

setupStorage(); 
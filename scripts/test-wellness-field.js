const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function testWellnessField() {
  try {
    console.log('Testing wellness_visible field...');

    // Test with Ashish Agarwal's ID
    const userId = 'c8357bf1-417c-4a6a-ae94-eaa01413bf47';
    
    // Try to select the user with all fields
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('❌ Error fetching user:', error);
      return;
    }

    console.log('✅ User found:', user.username);
    console.log('All fields:', Object.keys(user));
    console.log('wellness_visible value:', user.wellness_visible);
    console.log('wellness_visible type:', typeof user.wellness_visible);

    // Check if the field exists
    if ('wellness_visible' in user) {
      console.log('✅ wellness_visible field exists in database');
    } else {
      console.log('❌ wellness_visible field does NOT exist in database');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testWellnessField(); 
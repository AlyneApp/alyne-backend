const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function checkWellnessField() {
  try {
    console.log('Checking if wellness_visible field exists...');

    // Try to select the wellness_visible field from a user
    const { data: users, error } = await supabase
      .from('users')
      .select('id, username, wellness_visible')
      .limit(5);

    if (error) {
      console.error('❌ Error checking wellness_visible field:', error);
      return;
    }

    console.log('✅ wellness_visible field exists!');
    console.log('Sample users with wellness_visible field:');
    users.forEach(user => {
      console.log(`- ${user.username}: wellness_visible = ${user.wellness_visible}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkWellnessField(); 
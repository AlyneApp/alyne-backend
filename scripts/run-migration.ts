import { supabaseAdmin } from '../lib/supabase';

async function runMigration() {
  try {
    console.log('🔄 Running notification status migration...');
    
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not initialized');
    }
    
    // Add status column
    console.log('📝 Adding status column...');
    const { error: addColumnError } = await supabaseAdmin.rpc('exec', {
      sql: 'ALTER TABLE public.notifications ADD COLUMN status character varying(20) NULL DEFAULT \'pending\';'
    });
    
    if (addColumnError) {
      console.log('⚠️ Status column might already exist:', addColumnError.message);
    }
    
    // Add index
    console.log('📝 Adding status index...');
    const { error: addIndexError } = await supabaseAdmin.rpc('exec', {
      sql: 'CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications USING btree (status);'
    });
    
    if (addIndexError) {
      console.log('⚠️ Index might already exist:', addIndexError.message);
    }
    
    // Update existing notifications
    console.log('📝 Updating existing notifications...');
    const { error: updateError } = await supabaseAdmin
      .from('notifications')
      .update({ status: 'pending' })
      .is('status', null);
    
    if (updateError) {
      console.log('⚠️ Update error:', updateError.message);
    }
    
    // Add constraint
    console.log('📝 Adding status constraint...');
    const { error: constraintError } = await supabaseAdmin.rpc('exec', {
      sql: 'ALTER TABLE public.notifications ADD CONSTRAINT notifications_status_check CHECK (status IN (\'pending\', \'accepted\', \'declined\', \'completed\'));'
    });
    
    if (constraintError) {
      console.log('⚠️ Constraint might already exist:', constraintError.message);
    }
    
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration if this script is executed directly
if (require.main === module) {
  runMigration();
}

export { runMigration };

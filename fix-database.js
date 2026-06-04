const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const SUPABASE_URL = 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixDatabase() {
    console.log('🔧 Starting database fix...\n');

    try {
        // Check if business_config table exists
        console.log('1️⃣ Checking business_config table...');
        const { data: tableCheck, error: tableError } = await supabase
            .from('business_config')
            .select('id')
            .limit(1);

        if (tableError) {
            console.error('❌ Error: business_config table does not exist or is not accessible');
            console.error('   Please run setup_database.sql first');
            process.exit(1);
        }

        console.log('✓ business_config table exists\n');

        // Try to check if is_active column exists
        console.log('2️⃣ Checking for is_active column...');
        const { data: columnCheck, error: columnError } = await supabase
            .from('business_config')
            .select('is_active')
            .limit(1);

        if (columnError && columnError.code === '42703') {
            console.log('⚠️  is_active column is missing\n');
            console.log('3️⃣ Adding is_active column...');
            console.log('   Note: This requires running SQL directly in Supabase dashboard\n');
            console.log('═══════════════════════════════════════════════════════════');
            console.log('Please follow these steps:');
            console.log('1. Go to: https://supabase.com/dashboard/project/xrphyjkrzolqyowkkvzf/editor');
            console.log('2. Click on "SQL Editor" in the left sidebar');
            console.log('3. Click "New Query"');
            console.log('4. Copy and paste this SQL:\n');
            console.log('   ALTER TABLE public.business_config');
            console.log('   ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;\n');
            console.log('   UPDATE public.business_config');
            console.log('   SET is_active = false');
            console.log('   WHERE id = 1 AND is_active IS NULL;\n');
            console.log('5. Click "Run" to execute');
            console.log('6. Run this script again to verify');
            console.log('═══════════════════════════════════════════════════════════\n');
            process.exit(0);
        } else if (columnError) {
            console.error('❌ Unexpected error:', columnError.message);
            process.exit(1);
        }

        console.log('✓ is_active column exists\n');

        // Verify the column has proper data
        console.log('3️⃣ Verifying data...');
        const { data: configData, error: dataError } = await supabase
            .from('business_config')
            .select('id, is_active')
            .eq('id', 1)
            .single();

        if (dataError) {
            console.error('❌ Error reading config:', dataError.message);
            process.exit(1);
        }

        if (!configData) {
            console.log('⚠️  No config record found, creating default...');
            const { error: insertError } = await supabase
                .from('business_config')
                .insert({ id: 1, is_active: false });

            if (insertError) {
                console.error('❌ Error creating config:', insertError.message);
                process.exit(1);
            }
            console.log('✓ Default config created');
        } else {
            console.log(`✓ Config found: id=${configData.id}, is_active=${configData.is_active}`);
        }

        console.log('\n✅ Database is properly configured!');
        console.log('   You can now start your servers without errors.\n');

    } catch (error) {
        console.error('❌ Unexpected error:', error.message);
        process.exit(1);
    }
}

// Run the fix
fixDatabase();

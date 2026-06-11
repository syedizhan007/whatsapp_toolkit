const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CLEAN SLATE - User will write their own business instructions in dashboard
const CLEAN_PROMPT = `You are a helpful WhatsApp business assistant. Follow the business instructions provided below and respond naturally to customers.`;

async function cleanPrompt() {
    console.log('🧹 Cleaning business prompt - removing hardcoded content...\n');
    
    const { data, error } = await supabase
        .from('business_config')
        .update({
            prompt_text: CLEAN_PROMPT,
            updated_at: new Date().toISOString()
        })
        .eq('id', 1)
        .select();
    
    if (error) {
        console.error('❌ Error:', error.message);
    } else {
        console.log('✅ Business config cleaned!');
        console.log('📝 Users can now write their own instructions in the dashboard');
        console.log('\n💡 New clean prompt:');
        console.log('═══════════════════════════════════════');
        console.log(CLEAN_PROMPT);
        console.log('═══════════════════════════════════════');
    }
}

cleanPrompt();

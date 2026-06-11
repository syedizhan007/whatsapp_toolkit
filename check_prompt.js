const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkPrompt() {
    const { data, error } = await supabase
        .from('business_config')
        .select('prompt_text')
        .eq('id', 1)
        .single();
    
    if (error) {
        console.error('Error:', error.message);
    } else {
        console.log('Current Business Prompt:');
        console.log('═══════════════════════════════════════');
        console.log(data.prompt_text);
        console.log('═══════════════════════════════════════');
    }
}

checkPrompt();

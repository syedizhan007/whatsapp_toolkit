// Update AI Agent System Prompt in Supabase
// Run this script to update the business_config table with the new prompt

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Supabase credentials
const SUPABASE_URL = 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function updateAIPrompt() {
    try {
        console.log('📖 Reading new AI prompt from file...');

        // Read the new prompt from file
        const promptPath = path.join(__dirname, 'ai_agent_system_prompt.txt');
        const newPrompt = fs.readFileSync(promptPath, 'utf8');

        console.log('✓ Prompt loaded from file');
        console.log(`📝 Prompt length: ${newPrompt.length} characters`);
        console.log('');

        // Update the business_config table
        console.log('🔄 Updating business_config in Supabase...');

        const { data, error } = await supabase
            .from('business_config')
            .update({
                prompt_text: newPrompt,
                updated_at: new Date().toISOString()
            })
            .eq('id', 1)
            .select();

        if (error) {
            console.error('❌ Error updating prompt:', error.message);
            process.exit(1);
        }

        if (!data || data.length === 0) {
            console.log('⚠️ No existing config found. Creating new entry...');

            const { data: insertData, error: insertError } = await supabase
                .from('business_config')
                .insert({
                    id: 1,
                    prompt_text: newPrompt,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .select();

            if (insertError) {
                console.error('❌ Error creating config:', insertError.message);
                process.exit(1);
            }

            console.log('✅ New config created successfully!');
        } else {
            console.log('✅ AI prompt updated successfully!');
        }

        console.log('');
        console.log('═══════════════════════════════════════════════════════');
        console.log('✓ AI Agent will now use the new prompt');
        console.log('✓ Changes are effective immediately (no restart needed)');
        console.log('✓ Test by sending a WhatsApp message');
        console.log('═══════════════════════════════════════════════════════');

    } catch (error) {
        console.error('❌ Exception:', error.message);
        process.exit(1);
    }
}

// Run the update
updateAIPrompt();

const fs = require('fs');
const path = require('path');

console.log('╔════════════════════════════════════════════════════════╗');
console.log('║     Supabase URL & Key Update Script                  ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');

// Get new credentials from command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
    console.log('❌ Error: Missing arguments');
    console.log('');
    console.log('Usage:');
    console.log('  node update-supabase-config.js <NEW_URL> <NEW_KEY>');
    console.log('');
    console.log('Example:');
    console.log('  node update-supabase-config.js https://abc123.supabase.co eyJhbGc...');
    console.log('');
    console.log('To get your Supabase credentials:');
    console.log('  1. Go to: https://supabase.com/dashboard');
    console.log('  2. Select your project');
    console.log('  3. Go to: Project Settings → API');
    console.log('  4. Copy "Project URL" and "anon public" key');
    console.log('');
    process.exit(1);
}

const NEW_SUPABASE_URL = args[0];
const NEW_SUPABASE_KEY = args[1];

// Validate URL format
if (!NEW_SUPABASE_URL.startsWith('https://') || !NEW_SUPABASE_URL.includes('.supabase.co')) {
    console.log('❌ Error: Invalid Supabase URL format');
    console.log('   URL should be like: https://yourproject.supabase.co');
    process.exit(1);
}

console.log('New Supabase URL:', NEW_SUPABASE_URL);
console.log('New Supabase Key:', NEW_SUPABASE_KEY.substring(0, 20) + '...');
console.log('');

// Old credentials to replace
const OLD_URL = 'https://xrphyjkrzolqyowkkvzf.supabase.co';
const OLD_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhycGh5amtyem9scXlvd2trdnpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjM5NTIsImV4cCI6MjA5MzUzOTk1Mn0.Tk-ESBR82crBvISHFJAP2JE_zmkUc4YRgB7VgQtRBFE';

// Files to update
const filesToUpdate = [
    '.env',
    'server.js',
    'backend/services/agentService.js',
    'fix-database.js',
    'COMPLETE_DATABASE_SETUP.sql'
];

let updatedCount = 0;
let errorCount = 0;

console.log('🔄 Updating files...\n');

filesToUpdate.forEach(filePath => {
    try {
        const fullPath = path.join(__dirname, filePath);

        if (!fs.existsSync(fullPath)) {
            console.log(`⚠️  Skipped: ${filePath} (file not found)`);
            return;
        }

        let content = fs.readFileSync(fullPath, 'utf8');
        let modified = false;

        // Replace URL
        if (content.includes(OLD_URL)) {
            content = content.replace(new RegExp(OLD_URL, 'g'), NEW_SUPABASE_URL);
            modified = true;
        }

        // Replace Key
        if (content.includes(OLD_KEY)) {
            content = content.replace(new RegExp(OLD_KEY, 'g'), NEW_SUPABASE_KEY);
            modified = true;
        }

        if (modified) {
            // Create backup
            fs.writeFileSync(fullPath + '.backup', fs.readFileSync(fullPath));

            // Write updated content
            fs.writeFileSync(fullPath, content, 'utf8');
            console.log(`✅ Updated: ${filePath}`);
            updatedCount++;
        } else {
            console.log(`ℹ️  No changes: ${filePath}`);
        }

    } catch (error) {
        console.log(`❌ Error updating ${filePath}: ${error.message}`);
        errorCount++;
    }
});

console.log('');
console.log('╔════════════════════════════════════════════════════════╗');
console.log('║                    Update Complete                     ║');
console.log('╚════════════════════════════════════════════════════════╝');
console.log('');
console.log(`✅ Files updated: ${updatedCount}`);
console.log(`❌ Errors: ${errorCount}`);
console.log('');

if (updatedCount > 0) {
    console.log('📝 Backup files created with .backup extension');
    console.log('');
    console.log('Next steps:');
    console.log('  1. Run: node fix-database.js');
    console.log('  2. Follow instructions to set up database');
    console.log('  3. Start servers: start-all.bat (or start-all.sh)');
    console.log('');
}

console.log('⚠️  Note: You may need to manually update dashboard.html');
console.log('   Search for "createClient" and update the Supabase URL there.');
console.log('');

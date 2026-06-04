const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

async function migrateDatabase() {
  const dbPath = path.join(__dirname, '..', '..', 'bulk-sender', 'campaigns.db');

  console.log('🔧 Starting database migration...');
  console.log('📁 Database path:', dbPath);

  try {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);

    // Check current schema
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📊 Existing tables:', tables);

    // Get campaigns table info
    try {
      const tableInfo = db.exec("PRAGMA table_info(campaigns)");
      if (tableInfo.length > 0) {
        console.log('\n📋 Current campaigns table columns:');
        tableInfo[0].values.forEach(col => {
          console.log(`  - ${col[1]} (${col[2]})`);
        });
      }
    } catch (e) {
      console.log('⚠️  campaigns table does not exist, will create it');
    }

    // Add missing columns to campaigns table
    console.log('\n🔨 Adding missing columns...');

    const alterCommands = [
      "ALTER TABLE campaigns ADD COLUMN delay_min INTEGER DEFAULT 8",
      "ALTER TABLE campaigns ADD COLUMN delay_max INTEGER DEFAULT 20",
      "ALTER TABLE campaigns ADD COLUMN batch_size INTEGER DEFAULT 50",
      "ALTER TABLE campaigns ADD COLUMN batch_delay INTEGER DEFAULT 10"
    ];

    for (const cmd of alterCommands) {
      try {
        db.run(cmd);
        console.log(`✓ ${cmd}`);
      } catch (error) {
        if (error.message.includes('duplicate column name')) {
          console.log(`⏭️  Column already exists, skipping`);
        } else {
          console.log(`⚠️  ${error.message}`);
        }
      }
    }

    // Save the database
    const data = db.export();
    const newBuffer = Buffer.from(data);
    fs.writeFileSync(dbPath, newBuffer);

    console.log('\n✅ Database migration completed successfully!');

    // Verify the changes
    const updatedTableInfo = db.exec("PRAGMA table_info(campaigns)");
    if (updatedTableInfo.length > 0) {
      console.log('\n📋 Updated campaigns table columns:');
      updatedTableInfo[0].values.forEach(col => {
        console.log(`  - ${col[1]} (${col[2]})`);
      });
    }

    db.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateDatabase();

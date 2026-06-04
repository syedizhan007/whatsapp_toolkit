const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class DatabaseService {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.dbPath = null;
  }

  async connect() {
    if (this.db) {
      return this.db;
    }

    this.dbPath = path.join(__dirname, '..', '..', process.env.CAMPAIGNS_DB_PATH || './bulk-sender/campaigns.db');
    this.SQL = await initSqlJs();

    try {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
      console.log('✓ Connected to SQLite database:', this.dbPath);
    } catch (error) {
      console.log('Creating new database...');
      this.db = new this.SQL.Database();
    }

    return this.db;
  }

  async getDb() {
    if (!this.db) {
      await this.connect();
    }
    return this.db;
  }

  async query(sql, params = []) {
    const db = await this.getDb();
    const result = db.exec(sql, params);
    if (result.length === 0) return [];

    const columns = result[0].columns;
    const values = result[0].values;

    return values.map(row => {
      const obj = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });
  }

  async get(sql, params = []) {
    const results = await this.query(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  async run(sql, params = []) {
    const db = await this.getDb();
    db.run(sql, params);
    this.save();
    return { lastInsertRowid: db.exec("SELECT last_insert_rowid()")[0].values[0][0] };
  }

  save() {
    if (this.db && this.dbPath) {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }
  }

  close() {
    if (this.db) {
      this.save();
      this.db.close();
      this.db = null;
    }
  }
}

// Singleton instance
const databaseService = new DatabaseService();

module.exports = databaseService;

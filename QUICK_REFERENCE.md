# Quick Reference - Main Files

## PROJECT 1: WhatsApp Bulk Sender
**Path**: `bulk-sender/`

### Core Files:
1. **index.js** - Main CLI with interactive menu
2. **campaign-manager.js** - Campaign logic + auto-blacklist
3. **whatsapp-client.js** - WhatsApp connection + message listener
4. **database.js** - SQLite operations
5. **utils.js** - Random delay, DND check, personalization
6. **config.js** - All settings (delays, DND, blacklist keywords)
7. **scheduler.js** - Cron job scheduler
8. **csv-handler.js** - CSV import/export
9. **dashboard.js** - Live terminal UI

### Run:
```bash
cd bulk-sender
npm start
```

---

## PROJECT 2: WhatsApp MCP Server
**Path**: `whatsapp-mcp/`

### Core Files:
1. **index.js** - MCP server with 10 AI tools
2. **whatsapp-client.js** - WhatsApp wrapper

### Setup:
```bash
# See whatsapp-mcp/SETUP.md
# Configure Claude Desktop config file
# Restart Claude Desktop
```

---

## PROJECT 3: WhatsApp Number Validator
**Path**: `./` (root)

### Core Files:
1. **index.js** - Entry point
2. **validator.js** - 2-step validation
3. **dashboard.js** - Progress UI
4. **config.js** - Settings

### Run:
```bash
npm start
```

---

## Security Features (Project 1)

### ✅ Random Delay (8-20s)
- **File**: `bulk-sender/utils.js` line 8
- **Usage**: `campaign-manager.js` line 107

### ✅ Session Save
- **File**: `bulk-sender/config.js` line 3
- **File**: `bulk-sender/whatsapp-client.js` line 17

### ✅ DND Hours (11PM-8AM)
- **File**: `bulk-sender/config.js` lines 19-20
- **File**: `bulk-sender/utils.js` line 44
- **Usage**: `campaign-manager.js` line 83

### ✅ Auto-Blacklist on "Stop"
- **File**: `bulk-sender/config.js` line 23 (keywords)
- **File**: `bulk-sender/whatsapp-client.js` line 42 (listener)
- **File**: `bulk-sender/campaign-manager.js` line 24 (handler)

---

## Configuration Quick Edit

### Change Delays:
Edit `bulk-sender/config.js`:
```javascript
minDelay: 8000,   // Change to 10000 for 10 seconds
maxDelay: 20000,  // Change to 30000 for 30 seconds
```

### Change DND Hours:
Edit `bulk-sender/config.js`:
```javascript
dndStart: 23,  // Change to 22 for 10 PM
dndEnd: 8,     // Change to 9 for 9 AM
```

### Add Blacklist Keywords:
Edit `bulk-sender/config.js`:
```javascript
blacklistKeywords: ['stop', 'unsubscribe', 'remove', 'block', 'cancel'],
```

### Change Batch Size:
Edit `bulk-sender/config.js`:
```javascript
batchSize: 50,      // Change to 30 for smaller batches
batchBreak: 600000, // Change to 900000 for 15 min break
```

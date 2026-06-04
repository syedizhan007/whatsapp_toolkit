# WhatsApp Toolkit v2.0

Complete WhatsApp automation toolkit with 3 powerful projects.

## Projects Overview

### 1. WhatsApp Bulk Sender
**Location**: `bulk-sender/`

Professional bulk messaging system with campaign management.

**Features**:
- Campaign management (create, pause, resume, delete)
- CSV import with custom fields
- Message personalization ({name}, {city}, {date}, {time})
- Per-contact media files
- Smart delays (8-20 seconds)
- Batch system (50 messages + 10 min break)
- Auto retry (3 times, 1 hour later)
- Blacklist management
- Scheduler (cron jobs)
- DND hours (11 PM - 8 AM)
- Group member extraction
- Duplicate remover
- Live dashboard
- SQLite database
- Results export

**Quick Start**:
```bash
cd bulk-sender
npm install
npm start
```

---

### 2. WhatsApp AI Agent (MCP Server)
**Location**: `whatsapp-mcp/`

Model Context Protocol server for WhatsApp integration with Claude AI.

**Features**:
- Send messages via Claude
- Send media files
- Get chats and messages
- Contact information
- Number validation
- Group management
- Profile pictures
- Natural language interface

**Quick Start**:
```bash
cd whatsapp-mcp
npm install
```

Then configure in Claude Desktop (see SETUP.md)

---

### 3. WhatsApp Number Validator
**Location**: `./` (root)

Validate phone numbers against WhatsApp with 2-step verification.

**Features**:
- Format validation (libphonenumber-js)
- Real WhatsApp check (whatsapp-web.js)
- CSV import/export
- Live dashboard
- Session persistence
- Duplicate remover

**Quick Start**:
```bash
npm install
npm start
```

---

## Installation

### Prerequisites
- Node.js 16+ installed
- WhatsApp account
- Phone with WhatsApp

### Install All Projects

```bash
# Project 3 - Number Validator
npm install

# Project 1 - Bulk Sender
cd bulk-sender
npm install
cd ..

# Project 2 - MCP Server
cd whatsapp-mcp
npm install
cd ..
```

## Usage

### Project 1: Bulk Sender

```bash
cd bulk-sender
npm start
```

1. Create campaign
2. Import contacts from CSV
3. Write message template
4. Start sending!

**CSV Format**:
```csv
name,phone,tag,city,custom_image,custom_doc
John Doe,+1234567890,customer,New York,,
```

---

### Project 2: MCP Server

1. Install dependencies
2. Configure Claude Desktop
3. Restart Claude
4. Use natural language!

**Example**:
```
"Send a WhatsApp message to +1234567890 saying 'Hello!'"
```

See `whatsapp-mcp/SETUP.md` for detailed configuration.

---

### Project 3: Number Validator

```bash
npm start
```

1. Prepare `numbers.csv` with phone numbers
2. Run validator
3. Scan QR code (first time only)
4. Check results in `valid.csv` and `invalid.csv`

**CSV Format**:
```csv
phone
+1234567890
+919876543210
```

---

## Project Comparison

| Feature | Bulk Sender | MCP Server | Validator |
|---------|-------------|------------|-----------|
| Send Messages | ✅ Bulk | ✅ Individual | ❌ |
| Campaign Management | ✅ | ❌ | ❌ |
| AI Integration | ❌ | ✅ | ❌ |
| Number Validation | ❌ | ✅ | ✅ |
| Scheduling | ✅ | ❌ | ❌ |
| Media Support | ✅ | ✅ | ❌ |
| Group Support | ✅ | ✅ | ❌ |
| Database | ✅ SQLite | ❌ | ❌ |
| Dashboard | ✅ | ❌ | ✅ |

---

## Common Features

All projects share:
- **Session Persistence**: QR scan only once
- **whatsapp-web.js**: Real WhatsApp connection
- **No API Key**: Direct WhatsApp Web connection
- **Cross-Platform**: Windows, macOS, Linux

---

## Directory Structure

```
whatsapptool/
├── bulk-sender/              # Project 1
│   ├── index.js
│   ├── campaign-manager.js
│   ├── database.js
│   ├── scheduler.js
│   ├── dashboard.js
│   ├── whatsapp-client.js
│   ├── csv-handler.js
│   ├── utils.js
│   ├── config.js
│   ├── package.json
│   ├── README.md
│   ├── QUICKSTART.md
│   ├── MESSAGE_TEMPLATES.md
│   ├── uploads/
│   └── results/
│
├── whatsapp-mcp/             # Project 2
│   ├── index.js
│   ├── whatsapp-client.js
│   ├── package.json
│   ├── README.md
│   └── SETUP.md
│
└── (root)                    # Project 3
    ├── index.js
    ├── validator.js
    ├── dashboard.js
    ├── config.js
    ├── package.json
    ├── README.md
    └── numbers.csv
```

---

## Phone Number Format

Always use international format:
- ✅ +1234567890
- ✅ +919876543210
- ❌ 1234567890 (missing +)
- ❌ 01234567890 (leading zero)

---

## Troubleshooting

### QR Code Not Appearing
1. Delete `.wwebjs_auth/` folder
2. Restart application
3. Scan new QR code

### Authentication Failed
1. Ensure WhatsApp is connected to internet
2. Close WhatsApp Web on other devices
3. Try scanning QR code again

### Messages Not Sending
1. Check phone number format
2. Verify number is on WhatsApp
3. Check internet connection
4. Ensure not in DND hours (Bulk Sender)

### Installation Errors
1. Update Node.js to latest version
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and reinstall

---

## Best Practices

1. **Test First**: Always test with small batches
2. **Respect Limits**: Don't spam, use delays
3. **DND Hours**: Respect quiet hours (11 PM - 8 AM)
4. **Blacklist**: Honor opt-out requests
5. **Backup**: Keep backups of important data
6. **Legal**: Comply with local regulations

---

## Security

- Session files stored locally
- Never share `.wwebjs_auth/` folder
- No data sent to external servers
- Direct WhatsApp Web connection
- No API keys required

---

## Support

For issues or questions:
1. Check project-specific README
2. Review troubleshooting section
3. Check WhatsApp Web status
4. Verify Node.js version

---

## License

MIT License - Free to use and modify

---

## Disclaimer

Use responsibly and comply with WhatsApp Terms of Service. These tools are for legitimate business communication only. Spamming is prohibited and may result in WhatsApp account ban.

---

## Version

**v2.0** - April 2026

All three projects complete and ready to use!

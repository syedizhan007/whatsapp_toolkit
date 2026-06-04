# WhatsApp Bulk Sender

Professional WhatsApp bulk messaging system with campaign management, scheduling, and advanced features.

## Features

### Core Features
- **Campaign Management**: Create, pause, resume, and delete campaigns
- **CSV Import**: Import contacts with custom fields (name, phone, tag, city, custom_image, custom_doc)
- **Message Personalization**: Use variables like {name}, {city}, {date}, {time}, {day}
- **Per-Contact Media**: Send different images/documents to each contact
- **Smart Delays**: Random delays (8-20 seconds) between messages
- **Batch System**: Send 50 messages, then 10-minute break
- **Auto Retry**: Retry failed messages up to 3 times, 1 hour later
- **Blacklist Management**: Auto-add contacts who say "stop"
- **DND Hours**: Respect Do Not Disturb hours (11 PM - 8 AM)
- **Live Dashboard**: Real-time progress bar with statistics
- **SQLite Database**: Complete message history tracking
- **Results Export**: Export campaign results to CSV

### Advanced Features
- **Scheduler**: Schedule campaigns with cron expressions
- **Group Extractor**: Extract group members to CSV
- **Duplicate Remover**: Automatically removes duplicate numbers
- **Session Persistence**: QR code scan only once

## Installation

```bash
cd bulk-sender
npm install
```

## Quick Start

1. **Start the application:**
   ```bash
   npm start
   ```

2. **First run:**
   - Scan QR code with WhatsApp
   - Session will be saved for future runs

3. **Create a campaign:**
   - Select "Create New Campaign"
   - Provide campaign name
   - Specify CSV file path
   - Write message template

4. **Start campaign:**
   - Select "Start Campaign"
   - Choose campaign from list
   - Watch live progress

## CSV Format

Create a CSV file with these columns:

```csv
name,phone,tag,city,custom_image,custom_doc
John Doe,+1234567890,customer,New York,uploads/john.jpg,
Jane Smith,+9876543210,lead,London,,uploads/jane.pdf
Bob Wilson,923001234567,vip,Karachi,uploads/bob.png,uploads/bob.pdf
```

### Column Descriptions:
- **name**: Contact name (used in {name} variable)
- **phone**: Phone number with country code
- **tag**: Custom tag/category
- **city**: City name (used in {city} variable)
- **custom_image**: Path to image file (optional)
- **custom_doc**: Path to document file (optional)

## Message Templates

Use these variables in your messages:

- `{name}` - Contact's name
- `{city}` - Contact's city
- `{tag}` - Contact's tag
- `{date}` - Current date (e.g., "April 25th 2026")
- `{time}` - Current time (e.g., "10:30 AM")
- `{day}` - Current day (e.g., "Friday")

### Example Template:

```
Hello {name}!

We have a special offer for customers in {city}.

This offer is valid until {date} at {time}.

Reply STOP to unsubscribe.
```

## Menu Options

### 📤 Create New Campaign
Create a new messaging campaign with contacts from CSV.

### ▶️ Start Campaign
Start sending messages for a campaign.

### ⏸️ Pause Campaign
Pause the currently running campaign.

### ▶️ Resume Campaign
Resume a paused campaign.

### 📋 View All Campaigns
View list of all campaigns with statistics.

### 🗑️ Delete Campaign
Delete a campaign and all its data.

### ⏰ Schedule Campaign
Schedule a campaign to run at specific times using cron expressions.

**Cron Examples:**
- `0 9 * * *` - Every day at 9 AM
- `0 9 * * 1-5` - Weekdays at 9 AM
- `0 */2 * * *` - Every 2 hours
- `30 14 * * 0` - Sundays at 2:30 PM

### 👥 Extract Group Members
Extract all members from a WhatsApp group to CSV.

### 🚫 Manage Blacklist
View, add, or remove numbers from blacklist.

### 📊 Export Results
Export campaign results and message history to CSV.

### 📝 Create CSV Template
Generate a sample CSV template file.

## Configuration

Edit `config.js` to customize:

```javascript
{
  minDelay: 8000,        // Minimum delay (8 seconds)
  maxDelay: 20000,       // Maximum delay (20 seconds)
  batchSize: 50,         // Messages per batch
  batchBreak: 600000,    // Break duration (10 minutes)
  maxRetries: 3,         // Retry attempts
  retryDelay: 3600000,   // Retry delay (1 hour)
  dndStart: 23,          // DND start hour (11 PM)
  dndEnd: 8,             // DND end hour (8 AM)
  blacklistKeywords: ['stop', 'unsubscribe', 'remove', 'block']
}
```

## Directory Structure

```
bulk-sender/
├── index.js                 # Main CLI interface
├── campaign-manager.js      # Campaign logic
├── whatsapp-client.js       # WhatsApp wrapper
├── database.js              # SQLite database
├── csv-handler.js           # CSV operations
├── scheduler.js             # Cron scheduler
├── dashboard.js             # Terminal UI
├── utils.js                 # Utilities
├── config.js                # Configuration
├── package.json             # Dependencies
├── uploads/                 # Media files
├── results/                 # Export files
└── campaigns.db             # SQLite database
```

## Database Schema

### Tables:
- **campaigns**: Campaign information
- **contacts**: Contact details and status
- **blacklist**: Blacklisted numbers
- **message_history**: Complete message log
- **scheduled_jobs**: Scheduled campaigns

## Best Practices

1. **Phone Numbers**: Always include country code (e.g., +1234567890)
2. **Media Files**: Place in `uploads/` folder before starting campaign
3. **Batch Size**: Keep at 50 messages to avoid WhatsApp limits
4. **Delays**: Use 8-20 seconds to appear natural
5. **DND Hours**: Respect 11 PM - 8 AM quiet hours
6. **Blacklist**: Always include "stop" keyword handling
7. **Testing**: Test with small campaigns first

## Troubleshooting

**QR code not appearing:**
- Delete `.wwebjs_auth/` folder
- Restart application

**Messages not sending:**
- Check phone number format
- Verify WhatsApp is connected
- Check if number is blacklisted

**Campaign stuck:**
- Use "Pause Campaign" option
- Check if in DND hours
- Verify internet connection

**Database errors:**
- Delete `campaigns.db` to reset
- Backup data before deleting

## Safety Features

- **Rate Limiting**: Smart delays prevent spam detection
- **Batch Breaks**: Automatic breaks after 50 messages
- **DND Hours**: No messages during night hours
- **Blacklist**: Automatic opt-out handling
- **Retry Logic**: Failed messages retry automatically
- **Session Persistence**: No repeated QR scans

## Export Formats

### Campaign Results CSV:
```csv
Name,Phone,Status,Sent At,Error Message
John Doe,+1234567890,sent,2026-04-25 10:30:00,
Jane Smith,+9876543210,failed,2026-04-25 10:31:00,Number not on WhatsApp
```

### Group Members CSV:
```csv
Phone,Is Admin,Is Super Admin
1234567890,false,false
9876543210,true,false
```

## License

MIT

## Disclaimer

Use responsibly and comply with WhatsApp Terms of Service. This tool is for legitimate business communication only. Spamming is prohibited and may result in WhatsApp account ban.

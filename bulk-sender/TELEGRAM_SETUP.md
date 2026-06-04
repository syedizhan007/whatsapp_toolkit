# Telegram Alert System Setup Guide

## 📱 Overview

The Telegram Alert System sends real-time notifications to your Telegram account for:
- Campaign start/completion
- Batch updates
- Failed messages
- Errors and alerts
- Blacklist notifications

## 🚀 Setup Instructions

### Step 1: Create a Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` command
3. Follow the prompts:
   - Choose a name for your bot (e.g., "WhatsApp Campaign Bot")
   - Choose a username (must end with 'bot', e.g., "whatsapp_campaign_bot")
4. **Save the bot token** - you'll need this later
   - Example: `1234567890:ABCdefGHIjklMNOpqrsTUVwxyz`

### Step 2: Get Your Chat ID

**Method 1: Using @userinfobot**
1. Search for **@userinfobot** on Telegram
2. Start a chat with it
3. It will send you your Chat ID
4. **Save this number** (e.g., `123456789`)

**Method 2: Using the bot**
1. Start a chat with your newly created bot
2. Send any message to it
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Look for `"chat":{"id":123456789}` in the response
5. **Save this Chat ID**

### Step 3: Configure the Bot

Edit `bulk-sender/config.js`:

```javascript
// Telegram notifications
telegramEnabled: true,                                    // Change to true
telegramBotToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz', // Your bot token
telegramChatId: '123456789',                              // Your chat ID
```

### Step 4: Install Dependencies

```bash
cd bulk-sender
npm install node-telegram-bot-api
```

### Step 5: Test the Connection

Run the bulk sender and select "Test Telegram Connection" from the menu (if available), or start a campaign to receive your first notification.

## 📬 Notification Types

### 1. Campaign Started
```
🚀 Campaign Started

📋 Campaign: Eid Sale 2025
👥 Total Contacts: 500
⏰ Started: 2026-04-27 10:30:00
```

### 2. Campaign Completed
```
✅ Campaign Completed

📋 Campaign: Eid Sale 2025
👥 Total: 500
✅ Sent: 485
❌ Failed: 15
📊 Success Rate: 97.0%
⏱️ Duration: 2h 15m
⏰ Completed: 2026-04-27 12:45:00
```

### 3. Batch Completed
```
📦 Batch #5 Completed

📋 Campaign: Eid Sale 2025
✅ Sent: 50
❌ Failed: 0
⏳ Next batch in: 10 minutes
```

### 4. Failed Messages Alert
```
⚠️ Failed Messages Alert

📋 Campaign: Eid Sale 2025
❌ Failed Count: 15

Failed Numbers:
923001234567
923011234567
923021234567
923031234567
923041234567
... and 10 more

⏰ Time: 2026-04-27 12:45:00
```

### 5. Campaign Paused
```
⏸️ Campaign Paused

📋 Campaign: Eid Sale 2025
📊 Progress: 250/500 (50.0%)
⏰ Paused: 2026-04-27 11:30:00
```

### 6. Campaign Resumed
```
▶️ Campaign Resumed

📋 Campaign: Eid Sale 2025
📊 Remaining: 250 contacts
⏰ Resumed: 2026-04-27 11:45:00
```

### 7. Number Blacklisted
```
🚫 Number Blacklisted

📱 Phone: 923001234567
📝 Reason: Auto-blacklisted: replied with "stop"
⏰ Time: 2026-04-27 11:00:00
```

### 8. Error Alert
```
🚨 Campaign Error

📋 Campaign: Eid Sale 2025
❌ Error: WhatsApp connection lost
⏰ Time: 2026-04-27 11:30:00
```

## 🔧 Troubleshooting

### Bot not sending messages?

1. **Check bot token**: Make sure it's correct and complete
2. **Check chat ID**: Must be a number, not a username
3. **Start the bot**: Send `/start` to your bot on Telegram
4. **Check config**: Ensure `telegramEnabled: true`

### Getting "Forbidden" error?

- You haven't started a chat with the bot yet
- Send any message to your bot on Telegram first

### Getting "Invalid token" error?

- Double-check the bot token from @BotFather
- Make sure there are no extra spaces or quotes

## 🎯 Best Practices

1. **Keep bot token secret** - Don't share it publicly
2. **Test first** - Send a test notification before running campaigns
3. **Monitor regularly** - Check Telegram for real-time updates
4. **Disable if not needed** - Set `telegramEnabled: false` to disable

## 📝 Example Configuration

```javascript
module.exports = {
  // ... other settings ...

  // Telegram notifications
  telegramEnabled: true,
  telegramBotToken: '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz',
  telegramChatId: '123456789',
};
```

## ✅ Verification

After setup, you should receive a connection test message:

```
✅ Telegram Bot Connected

WhatsApp Bulk Sender is now connected to Telegram!
You will receive notifications for:
• Campaign start/completion
• Batch updates
• Failed messages
• Errors and alerts

⏰ Connected: 2026-04-27 10:00:00
```

## 🚀 Ready!

Your Telegram Alert System is now configured and ready to use!

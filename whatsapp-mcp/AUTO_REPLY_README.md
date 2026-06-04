# WhatsApp Auto-Reply Bot

Automatic reply system for WhatsApp messages with deal detection.

## Features

✅ **Auto-Reply**: Automatically responds to incoming messages
✅ **Smart Responses**: Context-aware replies in Urdu/English mix
✅ **Deal Detection**: Alerts when deal keywords are detected
✅ **Natural Delays**: Random delays (1-3 seconds) for human-like responses
✅ **Group Filter**: Only replies to individual chats, ignores groups

## Quick Start

### Option 1: Using npm script
```bash
npm run auto-reply
```

### Option 2: Direct command
```bash
node index.js --standalone
```

## How It Works

1. **Incoming Message Detection**: Listens for all incoming messages
2. **Message Analysis**: Checks message content for keywords
3. **Deal Alert**: If deal keywords found, prints alert to console
4. **Auto Response**: Generates contextual reply based on message content
5. **Send Reply**: Sends reply after 1-3 second delay

## Deal Keywords

The bot detects these keywords and triggers **DEAL ALERT**:
- deal, order, confirm
- le leta, le leti, le lunga, le lungi
- theek hai, thek hai, ok hai
- purchase, buy, khareed
- mangwana, chahiye
- book kar, final, done

## Response Categories

### Greetings
- Detects: salam, hello, hi, assalam, hey
- Replies: Friendly Urdu/English greetings

### Thanks
- Detects: thanks, thank, shukriya
- Replies: Welcome messages

### Price Inquiries
- Detects: price, rate, kitne, kya rate, kitna
- Replies: "Checking price" messages

### Availability
- Detects: available, mil, stock, موجود
- Replies: "Checking stock" messages

### Default
- Generic acknowledgment messages

## Example Console Output

```
📨 Message from Ali: Salam bhai, product available hai?
✅ Replied: Stock check kar raha hoon, thora wait karein.

📨 Message from Sara: Theek hai le leti hoon
🔔 DEAL ALERT 🔔
Contact: Sara
Message: Theek hai le leti hoon

✅ Replied: Ji bilkul, thora wait karein main check kar ke batata hoon.
```

## Configuration

### Modify Response Messages
Edit `whatsapp-client.js` → `generateReply()` method

### Add More Deal Keywords
Edit `whatsapp-client.js` → `checkDealKeywords()` method

### Change Delay Timing
Edit `whatsapp-client.js` → `setupAutoReply()` method
```javascript
await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
// Change 1000 (min) and 2000 (max) values
```

## Stop the Bot

Press `Ctrl+C` to gracefully shutdown

## Notes

- Bot only replies to individual chats (not groups)
- Bot ignores messages sent by you
- Session is saved in `.wwebjs_auth` folder
- First run requires QR code scan
- Subsequent runs auto-login

## Troubleshooting

**Bot not responding?**
- Check if WhatsApp client is ready (look for "WhatsApp client is ready!" message)
- Verify you're sending from a different number (bot ignores own messages)

**QR code not showing?**
- Delete `.wwebjs_auth` and `.wwebjs_cache` folders
- Run again

**Session expired?**
- Delete `.wwebjs_auth` folder
- Scan QR code again

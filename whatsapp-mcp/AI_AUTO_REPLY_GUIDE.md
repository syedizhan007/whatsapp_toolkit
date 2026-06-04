# WhatsApp AI Auto-Reply Bot with Groq Integration

Professional AI-powered auto-reply system for WhatsApp using Groq's free LLaMA 3.3 70B model.

## 🚀 Features

✅ **AI-Powered Responses**: Uses Groq's LLaMA 3.3 70B for intelligent, context-aware replies
✅ **Conversation Memory**: Maintains chat history per contact (last 10 messages)
✅ **Multi-Language Support**: Automatically replies in customer's language (Urdu/English/Roman Urdu)
✅ **Deal Detection**: Alerts when deal keywords are detected
✅ **Fallback System**: Works without API key using rule-based responses
✅ **Natural Delays**: Random 1-3 second delays for human-like behavior
✅ **Professional Tone**: AI trained to be helpful, friendly, and professional

## 📋 Prerequisites

1. Node.js installed
2. WhatsApp account
3. Free Groq API key (get from https://console.groq.com)

## 🔧 Setup Instructions

### Step 1: Get Groq API Key (FREE)

1. Visit https://console.groq.com
2. Sign up for free account
3. Go to API Keys section
4. Create new API key
5. Copy the key

### Step 2: Configure API Key

**Option A: Environment Variable (Recommended)**
```bash
export GROQ_API_KEY="your-api-key-here"
```

**Option B: Edit config.js**
```javascript
GROQ_API_KEY: 'your-api-key-here'
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Run the Bot

```bash
npm run auto-reply
```

Or:
```bash
node index.js --standalone
```

### Step 5: Scan QR Code

- QR code will appear in terminal
- Scan with WhatsApp on your phone
- Wait for "WhatsApp client is ready!" message

## 💬 How It Works

### Message Flow

```
Customer Message
    ↓
Deal Detection Check
    ↓
Add to Conversation History
    ↓
Send to Groq AI (with history)
    ↓
AI Generates Smart Reply
    ↓
Add Reply to History
    ↓
Random Delay (1-3 sec)
    ↓
Send Reply to Customer
```

### Conversation History

- Stores last 10 messages per contact
- Provides context to AI for better responses
- Automatically manages memory per contact
- Clears old messages to prevent overflow

### AI System Prompt

The AI is instructed to:
- Reply in customer's language (Urdu/English/Roman Urdu)
- Be helpful, friendly, and professional
- Keep replies short (1-3 sentences)
- Never reveal it's an AI
- Acknowledge product/price queries appropriately
- Use natural conversational tone

## 🔔 Deal Detection

Automatically detects these keywords and prints **DEAL ALERT**:

**English**: deal, order, confirm, purchase, buy, final, done
**Urdu/Roman**: le leta, le leti, le lunga, theek hai, thek hai, ok hai, khareed, mangwana, chahiye, book kar, pakka

### Alert Format
```
🔔 DEAL ALERT 🔔
Contact: Ali Khan
Phone: 923001234567@c.us
Message: Theek hai le leta hoon
```

## 📊 Console Output Examples

### Normal Conversation
```
📨 Message from Sara: Salam, product available hai?
✅ Replied: Walaikum salam! Ji bilkul available hai. Kaunsa product chahiye aapko?

📨 Message from Sara: Blue wala
✅ Replied: Blue color available hai. Price 2500 hai. Order confirm karun?
```

### Deal Alert
```
📨 Message from Ahmed: Theek hai confirm kar do

🔔 DEAL ALERT 🔔
Contact: Ahmed
Phone: 923009876543@c.us
Message: Theek hai confirm kar do

✅ Replied: Perfect! Order confirm ho gaya. Delivery details share kar raha hoon.
```

## ⚙️ Configuration

Edit `config.js` to customize:

### API Settings
```javascript
GROQ_API_KEY: 'your-key',
GROQ_MODEL: 'llama-3.3-70b-versatile',
```

### Timing
```javascript
MIN_DELAY: 1000,  // 1 second
MAX_DELAY: 3000,  // 3 seconds
```

### Memory
```javascript
MAX_HISTORY_PER_CONTACT: 10,  // Messages to remember
```

### Deal Keywords
```javascript
DEAL_KEYWORDS: [
  'deal', 'order', 'confirm',
  // Add your custom keywords
]
```

### System Prompt
```javascript
SYSTEM_PROMPT: `Your custom instructions here`
```

## 🔄 Fallback Mode

If Groq API fails or key not configured:
- Automatically switches to rule-based responses
- Uses pattern matching for common queries
- Still maintains conversation flow
- No interruption to service

## 🛑 Stop the Bot

Press `Ctrl+C` to gracefully shutdown

## 🧪 Testing

Test the AI response generator:
```bash
node test-groq.js
```

Test without WhatsApp connection:
```bash
node test-auto-reply.js
```

## 📝 Important Notes

### What Bot Ignores
- ✅ Own messages (sent by you)
- ✅ Group messages
- ✅ Status updates

### What Bot Replies To
- ✅ Individual customer messages
- ✅ Any language (Urdu/English/Roman Urdu)
- ✅ All types of queries

### Session Management
- Session saved in `.wwebjs_auth` folder
- First run requires QR scan
- Subsequent runs auto-login
- Delete folder to reset session

## 🚨 Troubleshooting

### API Key Error
```
⚠️ Groq API key not configured, using fallback responses
```
**Solution**: Set GROQ_API_KEY in config.js or environment

### API Rate Limit
```
❌ Groq API error: 429 - Rate limit exceeded
```
**Solution**: Wait a moment, free tier has limits. Bot will use fallback.

### Empty Response
```
❌ Empty response from Groq API
```
**Solution**: Bot automatically uses fallback response

### QR Code Not Showing
**Solution**: Delete `.wwebjs_auth` and `.wwebjs_cache` folders, run again

### Bot Not Responding
**Solution**: Check console for "WhatsApp client is ready!" message

## 🎯 Best Practices

1. **Monitor Console**: Watch for deal alerts and errors
2. **Test First**: Send test messages before going live
3. **Backup Session**: Keep `.wwebjs_auth` folder backed up
4. **API Limits**: Free tier has rate limits, monitor usage
5. **Custom Prompts**: Adjust system prompt for your business needs

## 🔐 Security

- Never commit API keys to git
- Use environment variables for production
- Keep `.wwebjs_auth` folder private
- Don't share session data

## 📈 Groq API Limits (Free Tier)

- **Requests**: 30 requests/minute
- **Tokens**: 6,000 tokens/minute
- **Daily**: 14,400 requests/day

More than enough for small-medium business use!

## 🆘 Support

- Groq Documentation: https://console.groq.com/docs
- WhatsApp Web.js: https://wwebjs.dev
- Issues: Check console logs for detailed errors

## 🎉 Ready to Go!

Your AI-powered WhatsApp auto-reply bot is ready. Start it with:
```bash
npm run auto-reply
```

Happy automating! 🤖

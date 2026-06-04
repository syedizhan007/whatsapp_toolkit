# WhatsApp AI Auto-Reply - Quick Start

## 🚀 Get Started in 3 Steps

### 1️⃣ Get Free Groq API Key
```
Visit: https://console.groq.com
Sign up → API Keys → Create Key → Copy
```

### 2️⃣ Set API Key
```bash
export GROQ_API_KEY="your-key-here"
```

### 3️⃣ Run Bot
```bash
npm run auto-reply
```

## ✅ What You Get

- **AI-Powered Replies**: Smart responses using LLaMA 3.3 70B
- **Multi-Language**: Auto-detects Urdu/English/Roman Urdu
- **Deal Alerts**: Console alerts for deal keywords
- **Conversation Memory**: Remembers last 10 messages per contact
- **Fallback Mode**: Works even without API key

## 📱 Test Commands

```bash
# Test Groq API connection
npm run test-groq

# Test response generator
npm run test-responses

# Run auto-reply bot
npm run auto-reply
```

## 🔔 Deal Keywords

Bot alerts when customer says:
- deal, order, confirm, purchase, buy
- le leta, le leti, theek hai, ok hai
- khareed, mangwana, chahiye, book kar

## 📊 Example Output

```
📨 Message from Ali: Salam, price kitna hai?
✅ Replied: Walaikum salam! Price check kar ke batata hoon...

📨 Message from Sara: Theek hai le leti hoon
🔔 DEAL ALERT 🔔
✅ Replied: Perfect! Order confirm ho gaya...
```

## 🛑 Stop Bot

Press `Ctrl+C`

## 📖 Full Documentation

See `AI_AUTO_REPLY_GUIDE.md` for complete guide.

---

**Free Forever** | **No Credit Card** | **Unlimited Messages**

---
title: WhatsApp Business Assistant
emoji: 💬
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
license: mit
startup_duration_timeout: 60
---

# 💬 WhatsApp Business Assistant

A professional business communication platform for legitimate customer service automation and business operations.

## ✅ Compliance & Responsible Use

This tool is designed for **legitimate business use only** in accordance with WhatsApp's Business Policy.

### Anti-Spam Measures
- ✅ Rate limiting enforced
- ✅ User authentication required
- ✅ Activity logging for compliance
- ✅ Customer consent validation

### Data Privacy
- ✅ Encrypted storage (Supabase)
- ✅ GDPR-compliant
- ✅ No third-party data sharing

**⚠️ Disclaimer:** Users must obtain customer consent, respect opt-outs, and comply with local telecommunications regulations. Misuse for spam or harassment is prohibited.

## 🎯 Legitimate Use Cases

- **Customer Service:** Automated FAQ responses
- **Appointment Scheduling:** Booking confirmations
- **Order Tracking:** Status updates
- **Business Analytics:** Customer insights
- **Deal Management:** Sales pipeline

## 🛠️ Tech Stack

- **Backend:** Node.js + Express
- **WhatsApp:** Baileys (official library)
- **Database:** Supabase (PostgreSQL)
- **AI:** Groq API (customer service)
- **Frontend:** HTML/CSS/JS

## 📦 Environment Variables

Set these in Space settings:

```bash
PORT=7860
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key
NODE_ENV=production
HEADLESS=true
```

## 🚀 Quick Start

1. **Login:** admin/admin123 (change immediately)
2. **Connect WhatsApp:** Scan QR code
3. **Configure:** Set business info
4. **Start:** Manage communications

## 🔒 Security Features

- JWT authentication
- Rate limiting (100 req/min)
- Helmet security headers
- Input sanitization
- Multi-tenant isolation

## 📊 Features

### 1. Number Validator
Verify phone numbers before messaging

### 2. Campaign Manager
- Targeted campaigns
- Delivery tracking
- Engagement metrics

### 3. AI Agent
- Customer service responses
- Context-aware conversations
- Deal detection

### 4. Analytics
- Message statistics
- Customer insights
- Performance metrics

## 📝 API Endpoints

- `GET /health` - Health check
- `GET /api/whatsapp/status` - Connection status
- `POST /api/whatsapp/send-message` - Send message
- `GET /api/deals/tracked` - Get deals

## 📄 License

MIT - See LICENSE file

## 🔗 Support

For issues: GitHub repository

---

**Important:** This Space requires WhatsApp QR scanning on first use. Use responsibly and ethically.

---
title: WhatsApp Toolkit
emoji: 📱
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
app_port: 7860
---

# WhatsApp Toolkit 📱

A comprehensive multi-tenant WhatsApp automation platform with AI-powered responses, bulk messaging, and contact management.

## 🚀 Features

- **Multi-Tenant Architecture** - Isolated WhatsApp sessions per user
- **AI Agent** - Groq-powered auto-responses with deal tracking
- **Bulk Sender** - Campaign management with template rotation
- **Number Validator** - Live WhatsApp number verification
- **Deal Tracker** - Automatic buying intent detection
- **Group Extractor** - Export WhatsApp group members to Excel
- **Blacklist Management** - Filter contacts across campaigns

## 🛠️ Tech Stack

- **Backend**: Node.js + Express
- **WhatsApp**: Baileys (WhatsApp Web API)
- **Database**: Supabase (PostgreSQL)
- **Real-time**: Socket.IO
- **AI**: Groq API (llama-3.3-70b-versatile)
- **Frontend**: Vanilla HTML/CSS/JS

## 📦 Environment Variables

Set these in your Hugging Face Space settings:

```bash
PORT=7860
GROQ_API_KEY=your_groq_api_key
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
NODE_ENV=production
```

## 🚀 Quick Start

### Docker Deployment

```bash
docker build -t whatsapp-toolkit .
docker run -p 7860:7860 \
  -e GROQ_API_KEY=your_key \
  -e SUPABASE_URL=your_url \
  -e SUPABASE_ANON_KEY=your_key \
  whatsapp-toolkit
```

### Local Development

```bash
npm install
cp .env.example .env
# Add your credentials to .env
npm start
```

Access dashboard at: http://localhost:7860/dashboard.html

## 📊 Architecture

```
whatsapptool/
├── server.js              # Main entry point
├── dashboard.html         # Main UI
├── backend/
│   ├── routes/           # API endpoints
│   ├── services/         # Business logic
│   ├── utils/            # Helper functions
│   ├── middleware/       # Express middleware
│   └── config/           # Configuration
└── package.json
```

## 🔐 Security Features

- JWT authentication
- Rate limiting (100 req/min API, 5 req/min auth)
- Helmet security headers
- Input sanitization
- XSS protection
- Multi-tenant data isolation

## 📝 API Endpoints

- `GET /api/whatsapp/status` - Check connection status
- `POST /api/whatsapp/send-message` - Send WhatsApp message
- `GET /api/deals/tracked` - Get tracked deals
- `POST /api/bulk/campaigns` - Create bulk campaign
- `GET /api/products` - Get product catalog
- `GET /api/media` - Get media gallery

## 🎯 Use Cases

1. **E-commerce Automation** - Auto-reply to product inquiries
2. **Lead Generation** - Track buying intent automatically
3. **Bulk Marketing** - Send campaigns with smart templates
4. **Contact Verification** - Validate phone numbers before outreach
5. **Group Management** - Extract member lists from WhatsApp groups

## 📄 License

MIT

## 🤝 Contributing

This is a production deployment. For development, clone and create a feature branch.

## 🔗 Links

- [Documentation](https://huggingface.co/spaces/izhan5/whatsapp-toolkit)

---

**⚠️ Important:** This Space requires WhatsApp QR code scanning on first use. The session persists across restarts.

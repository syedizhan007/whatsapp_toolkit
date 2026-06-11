---
title: WhatsApp Toolkit
emoji: 📱
colorFrom: green
colorTo: blue
sdk: docker
pinned: false
license: mit
app_port: 7860
---

# WhatsApp Toolkit 📱

A comprehensive multi-tenant WhatsApp automation platform with AI-powered responses, bulk messaging, and contact management.

⚠️ **Important Setup Required:**
1. Set environment variables in Space settings:
   - `GROQ_API_KEY` - Your Groq API key
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anonymous key
2. After starting, scan the WhatsApp QR code from the dashboard
3. Session persists across restarts

## 🚀 Features

- **Multi-Tenant Architecture** - Isolated WhatsApp sessions per user
- **AI Agent** - Groq-powered auto-responses with deal tracking
- **Bulk Sender** - Campaign management with template rotation
- **Number Validator** - Live WhatsApp number verification
- **Deal Tracker** - Automatic buying intent detection
- **Group Extractor** - Export WhatsApp group members to Excel
- **Blacklist Management** - Filter contacts across campaigns

## 🛠️ Tech Stack

- Backend: Node.js + Express
- WhatsApp: Baileys (WhatsApp Web API)
- Database: Supabase (PostgreSQL)
- Real-time: Socket.IO
- AI: Groq API (llama-3.3-70b-versatile)

## 🎯 Quick Start

1. Access the dashboard at `/dashboard.html`
2. Login with your Supabase credentials
3. Scan the WhatsApp QR code
4. Start using the features!

## 📝 Documentation

- [API Endpoints](https://huggingface.co/spaces/izhan5/whatsapp-toolkit)
- [GitHub Repository](https://github.com/syedizhan007/whatsapptool)

---

Built with ❤️ for WhatsApp automation

# WhatsApp Toolkit Backend

A Node.js + Express backend server that integrates three WhatsApp automation tools with a unified web dashboard.

## Features

- **Number Validator** - Validate phone numbers against WhatsApp
- **Bulk Sender** - Campaign-based bulk messaging with SQLite database
- **AI Agent** - Auto-reply bot with Groq AI and deal tracking
- **Real-time Updates** - WebSocket support for live progress tracking
- **Authentication** - JWT-based authentication system
- **REST API** - Complete API for all features

## Quick Start

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

The `.env` file is already configured with default values. Update if needed:

```env
PORT=3000
JWT_SECRET=your-secret-key
GROQ_API_KEY=your-groq-api-key
```

### 3. Start the Server

```bash
cd backend
node server.js
```

The server will start on http://localhost:3000

### 4. Access the Dashboard

Open your browser and go to:
- **Login Page**: http://localhost:3000/login.html
- **Dashboard**: http://localhost:3000/dashboard.html (after login)

**Default Credentials:**
- Username: `admin`
- Password: `admin123`

## API Endpoints

### Authentication
- `POST /api/auth/login` - Login with username/password
- `POST /api/auth/signup` - Create new user account
- `GET /api/auth/status` - Check authentication status
- `POST /api/auth/logout` - Logout

### Number Validator
- `POST /api/validator/validate` - Upload CSV and start validation
- `GET /api/validator/status/:jobId` - Get validation progress
- `GET /api/validator/results/:jobId` - Get validation results
- `GET /api/validator/download/:jobId/:type` - Download results CSV

### Campaigns (Bulk Sender)
- `GET /api/campaigns` - List all campaigns
- `POST /api/campaigns` - Create new campaign
- `GET /api/campaigns/:id` - Get campaign details
- `POST /api/campaigns/:id/contacts` - Upload contacts CSV
- `PUT /api/campaigns/:id/start` - Start campaign
- `PUT /api/campaigns/:id/pause` - Pause campaign
- `PUT /api/campaigns/:id/resume` - Resume campaign
- `DELETE /api/campaigns/:id` - Delete campaign
- `GET /api/campaigns/:id/stats` - Get campaign statistics

### AI Agent
- `GET /api/agent/status` - Get agent status
- `POST /api/agent/start` - Start AI agent
- `POST /api/agent/stop` - Stop AI agent
- `GET /api/agent/config` - Get business instructions
- `PUT /api/agent/config` - Update business instructions

### Deals
- `GET /api/deals` - Get all deals
- `GET /api/deals/:id` - Get specific deal
- `PUT /api/deals/:id` - Update deal
- `DELETE /api/deals/:id` - Delete deal

## WebSocket

Connect to `ws://localhost:3000/ws` for real-time updates.

## Testing the API

### Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'
```

### Health Check
```bash
curl http://localhost:3000/api/health
```

## Security Notes

- The Groq API key has been moved from hardcoded values to the `.env` file
- JWT tokens expire after 7 days (configurable)
- All API endpoints except `/auth/login` and `/auth/signup` require authentication
- File uploads are limited to 10MB

## License

ISC

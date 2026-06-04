# 🚀 Quick Start Guide - WhatsApp Tool

## ⚡ Fast Setup (3 Steps)

### Step 1: Fix Database (REQUIRED - Do This First!)
The database is missing a required column. You have 2 options:

#### Option A: Add Missing Column to Existing Database (Recommended)
1. Go to: https://supabase.com/dashboard/project/xrphyjkrzolqyowkkvzf/editor
2. Click **"SQL Editor"** → **"New Query"**
3. Copy and paste this SQL:
```sql
ALTER TABLE public.business_config
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;

UPDATE public.business_config
SET is_active = false
WHERE id = 1;
```
4. Click **"Run"**
5. Done! ✅

#### Option B: Complete Fresh Setup
1. Go to: https://supabase.com/dashboard/project/xrphyjkrzolqyowkkvzf/editor
2. Click **"SQL Editor"** → **"New Query"**
3. Copy the entire contents of `COMPLETE_DATABASE_SETUP.sql`
4. Click **"Run"**
5. Done! ✅

### Step 2: Start All Servers

#### Windows:
Double-click: `start-all.bat`

#### Linux/Mac:
```bash
chmod +x start-all.sh
./start-all.sh
```

### Step 3: Access Your Dashboard
Open your browser:
- **Main Dashboard:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **Standalone Dashboard:** http://localhost:3002

---

## 🛑 Stop All Servers

#### Windows:
Double-click: `stop-all.bat`

#### Linux/Mac:
Press `Ctrl+C` in the terminal where servers are running

---

## 📋 What Was Fixed?

### ✅ Fixed Errors:
1. **Database Error:** Missing `is_active` column → Fixed with SQL script
2. **Port Conflicts:** All servers used port 3000 → Now using 3000, 3001, 3002
3. **Configuration:** Added proper port environment variables

### ✅ Created Files:
- `COMPLETE_DATABASE_SETUP.sql` - Complete database setup with all columns
- `fix-database.js` - Automated database checker
- `start-all.bat` - Windows startup script
- `start-all.sh` - Linux/Mac startup script
- `stop-all.bat` - Windows stop script
- `ERRORS_FIXED.md` - Detailed error documentation
- `QUICK_START.md` - This file

---

## 🔧 Troubleshooting

### Error: "column business_config.is_active does not exist"
**Solution:** Run Step 1 above to add the missing column

### Error: "Port already in use"
**Solution:** Stop all servers first:
```bash
# Windows
stop-all.bat

# Linux/Mac
killall node
```

### Servers won't start
**Solution:** Check if dependencies are installed:
```bash
npm install
cd backend && npm install
cd ../dashboard && npm install
cd ../bulk-sender && npm install
```

---

## 📊 Server Ports

| Server | Port | Purpose |
|--------|------|---------|
| Root | 3000 | Main dashboard + WhatsApp |
| Backend | 3001 | API backend |
| Dashboard | 3002 | Standalone dashboard |

---

## ✅ Verification Checklist

Before starting servers, verify:
- [ ] Database column added (run SQL from Step 1)
- [ ] All dependencies installed (`npm install` in all folders)
- [ ] No other services using ports 3000, 3001, 3002
- [ ] `.env` file exists in root directory

---

## 🎉 You're Ready!

All errors have been fixed. Your WhatsApp Tool is ready to use!

**Need help?** Check `ERRORS_FIXED.md` for detailed documentation.

# WhatsApp Toolkit - Database Setup Instructions

## Step-by-Step Guide to Fix the Errors

### Problem
Your dashboard is showing these errors:
- `GET http://localhost:3000/api/products 500 (Internal Server Error)`
- `GET http://localhost:3000/api/media 500 (Internal Server Error)`

**Root Cause:** The Supabase database tables don't exist yet.

---

## Solution: Set Up Supabase Database

### Step 1: Create Database Tables

1. **Open Supabase Dashboard**
   - Go to: https://supabase.com/dashboard
   - Select your project: `xrphyjkrzolqyowkkvzf`

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run the Setup Script**
   - Open the file: `setup_database.sql` (in this folder)
   - Copy ALL the SQL code
   - Paste it into the Supabase SQL Editor
   - Click **"Run"** button (or press Ctrl+Enter)

4. **Verify Tables Created**
   - Go to "Table Editor" in the left sidebar
   - You should see 3 new tables:
     - ✅ `products`
     - ✅ `product_media`
     - ✅ `business_config`

---

### Step 2: Create Storage Bucket for Images

1. **Open Storage Section**
   - Click on "Storage" in the left sidebar
   - Click "Create a new bucket"

2. **Create Bucket**
   - Bucket name: `product-images`
   - Public bucket: **YES** (toggle ON)
   - Click "Create bucket"

---

### Step 3: Restart Your Server

1. **Stop the current server** (if running)
   - Press `Ctrl+C` in the terminal

2. **Start the server again**
   ```bash
   node server.js
   ```

3. **Open your dashboard**
   - Go to: http://localhost:3000/dashboard.html
   - The errors should be gone! ✅

---

## Verify Everything Works

### Test API Endpoints
Open these URLs in your browser:
- http://localhost:3000/api/products → Should return: `{"success":true,"products":[]}`
- http://localhost:3000/api/media → Should return: `{"success":true,"media":[]}`

---

**That's it! Your database is now ready to use.** 🎉

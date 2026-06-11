# 🚀 Hugging Face Deployment Setup Guide

## ✅ Your Space is Live!

**Space URL:** https://huggingface.co/spaces/izhan5/whatsapp-toolkit

**App URL:** https://izhan5-whatsapp-toolkit.hf.space

**Dashboard:** https://izhan5-whatsapp-toolkit.hf.space/dashboard.html

---

## 🔐 CRITICAL: Set Environment Variables (Required!)

⚠️ **The app WILL NOT START without these variables!**

### Step 1: Go to Space Settings
Open: https://huggingface.co/spaces/izhan5/whatsapp-toolkit/settings

### Step 2: Click on "Repository secrets" tab

### Step 3: Add these 4 secrets:

| Secret Name | Description | Where to get it |
|------------|-------------|-----------------|
| **GROQ_API_KEY** | Your Groq AI API key for chat responses | https://console.groq.com/keys |
| **SUPABASE_URL** | Your Supabase project URL | https://supabase.com/dashboard/project/[your-project]/settings/api |
| **SUPABASE_ANON_KEY** | Your Supabase anonymous key | Same page as URL (under "Project API keys") |
| **NODE_ENV** | Set to: `production` | Just type: `production` |

### Step 4: Click "Add Secret" for each one

**Important Notes:**
- Secret names are CASE-SENSITIVE - use exactly as shown above
- After adding secrets, the Space will automatically rebuild
- You can check build status at: https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs

---

## 📊 How to Get Your Credentials

### 1. Groq API Key (Free!)
1. Go to: https://console.groq.com
2. Sign up or login
3. Click "Create API Key"
4. Copy the key (starts with `gsk_...`)
5. Paste in Hugging Face Secret: `GROQ_API_KEY`

### 2. Supabase URL and Key
1. Go to: https://supabase.com/dashboard
2. Select your project (or create new one)
3. Go to: Settings → API
4. Copy **"Project URL"** → Paste in `SUPABASE_URL`
5. Copy **"anon/public key"** → Paste in `SUPABASE_ANON_KEY`

**Example values:**
- SUPABASE_URL: `https://xrphyjkrzolqyowkkvzf.supabase.co`
- SUPABASE_ANON_KEY: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` (long token)

---

## 🏗️ Database Setup (Supabase)

Your Supabase database needs these tables. Run this SQL in Supabase SQL Editor:

```sql
-- Create business_config table
CREATE TABLE IF NOT EXISTS business_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL UNIQUE,
    business_prompt TEXT,
    payment_details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create deal_tracker table
CREATE TABLE IF NOT EXISTS deal_tracker (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_name TEXT,
    deal_details TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create campaign_contacts table
CREATE TABLE IF NOT EXISTS campaign_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    phone TEXT NOT NULL,
    name TEXT,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create product_media table for gallery
CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_deals_user_id ON deal_tracker(user_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);
```

---

## 🎯 After Adding Secrets

### 1. Wait for Build (5-10 minutes)
- Green dot 🟢 = Running successfully
- Blue dot 🔵 = Building
- Red dot 🔴 = Build failed (check logs)

### 2. Check Build Logs
https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs

**Look for these success messages:**
```
✓ Supabase client initialized
🚀 Dashboard running on: http://0.0.0.0:7860
🔌 Socket.IO ready for real-time updates
```

**If you see errors about missing env vars:**
- Double-check secret names (case-sensitive!)
- Make sure all 4 secrets are added
- Try restarting the Space (click ⋮ → Restart)

### 3. Access Your Dashboard
Once build succeeds (green dot), open:
https://izhan5-whatsapp-toolkit.hf.space/dashboard.html

**Default Login:**
- Username: `admin`
- Password: `admin123`

---

## 📱 First-Time WhatsApp Setup

1. Login to dashboard
2. Go to "WhatsApp Connection" section
3. Click "Connect WhatsApp"
4. Scan QR code with your WhatsApp
5. Wait for "Connected ✓" status

**Your WhatsApp session will persist across Space restarts!**

---

## 🔍 Troubleshooting

### Build Failed / Red Dot
1. Check logs: https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs
2. Verify all 4 secrets are added correctly
3. Make sure secret names match exactly (case-sensitive)
4. Try restarting the Space

### App Shows Blank Page
1. Check browser console (F12) for errors
2. Verify Supabase credentials are correct
3. Make sure Supabase database tables exist (run SQL above)

### WhatsApp Not Connecting
1. Make sure QR code appears
2. Try refreshing the page
3. Check if WhatsApp Web works on your phone
4. Clear browser cache and try again

### Socket.IO Connection Failed
- This is normal during build - wait for green dot
- If persists after build: check CSP headers in browser console
- Try using different browser (Chrome recommended)

---

## 🔄 Future Updates

To deploy code changes:

```bash
# Make your changes
git add .
git commit -m "Your change description"

# Push to both repos
git push origin main
git push hf main
```

Hugging Face automatically rebuilds on every push!

---

## 📊 Monitoring Your Space

**Usage Stats:** https://huggingface.co/spaces/izhan5/whatsapp-toolkit/settings

**Build Logs:** https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs

**Space Settings:** https://huggingface.co/spaces/izhan5/whatsapp-toolkit/settings

---

## ⚙️ Optional: Upgrade Space Hardware

Free tier limitations:
- CPU only (no GPU)
- 16GB RAM
- Sleeps after 48h inactivity

To upgrade (paid):
1. Go to Settings → Hardware
2. Choose better tier for more resources
3. Prevents sleep mode

---

## 🎉 You're All Set!

Your WhatsApp Toolkit is now live at:
**https://izhan5-whatsapp-toolkit.hf.space/dashboard.html**

### Next Steps:
1. ✅ Add environment secrets (if not done)
2. ✅ Setup Supabase database tables
3. ✅ Login and connect WhatsApp
4. ✅ Start using AI Agent, Bulk Sender, and Validator!

---

## 📞 Need Help?

If you encounter issues:
1. Check build logs first
2. Verify all secrets are correct
3. Ensure database tables exist
4. Try in incognito mode (clear cache)

**Remember:** Without the 4 environment secrets, the app WILL NOT START! Add them first.

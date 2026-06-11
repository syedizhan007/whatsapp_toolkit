# 🚀 Hugging Face Deployment Guide

## Prerequisites Completed ✅

- [x] Dockerfile created (optimized for HF Spaces port 7860)
- [x] .dockerignore created
- [x] README.md updated
- [x] server.js updated to use PORT 7860
- [x] Git commit created
- [x] Project structure verified

## 🔐 Step 1: Login to Hugging Face CLI

You need to authenticate with Hugging Face first:

```bash
hf auth login
```

When prompted, paste your Hugging Face token. Get it from:
https://huggingface.co/settings/tokens

**Create a token with `write` access.**

## 📦 Step 2: Create the Space

### Option A: Using HF CLI (Recommended)

```bash
cd C:/Users/kk/Desktop/whatsapptool

# Create a new Space
hf repos create izhan5/whatsapp-toolkit --type space --sdk docker

# Add HF remote
git remote add hf https://huggingface.co/spaces/izhan5/whatsapp-toolkit

# Push to HF
git push hf main
```

### Option B: Manual Upload

1. Go to https://huggingface.co/new-space
2. Fill in:
   - Space name: `whatsapp-toolkit`
   - Owner: `izhan5`
   - SDK: `Docker`
   - Hardware: `CPU basic` (can upgrade later)
3. Clone the created Space:
   ```bash
   git clone https://huggingface.co/spaces/izhan5/whatsapp-toolkit
   cd whatsapp-toolkit
   ```
4. Copy all files from your project:
   ```bash
   cp -r C:/Users/kk/Desktop/whatsapptool/* .
   ```
5. Commit and push:
   ```bash
   git add .
   git commit -m "Initial deployment"
   git push
   ```

## ⚙️ Step 3: Configure Environment Variables

After creating the Space, add these secrets in the Space settings:

1. Go to: https://huggingface.co/spaces/izhan5/whatsapp-toolkit/settings
2. Click "Repository secrets"
3. Add:
   - `GROQ_API_KEY` = your_groq_api_key
   - `SUPABASE_URL` = your_supabase_url
   - `SUPABASE_ANON_KEY` = your_supabase_key
   - `NODE_ENV` = production

## 🔧 Step 4: Wait for Build

HF Spaces will automatically:
1. Build the Docker image (takes 5-10 minutes)
2. Start the container
3. Expose it on port 7860

Monitor the build logs at:
https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs

## ✅ Step 5: Verify Deployment

Once built, access your Space at:
https://huggingface.co/spaces/izhan5/whatsapp-toolkit

You should see the WhatsApp Toolkit dashboard!

## 🎯 Post-Deployment Steps

1. **Access Dashboard**: `https://izhan5-whatsapp-toolkit.hf.space/dashboard.html`
2. **Login**: Use your Supabase credentials
3. **Scan QR Code**: Connect your WhatsApp account
4. **Test Features**: Try the AI agent, bulk sender, etc.

## 🐛 Troubleshooting

### Build Fails
- Check build logs: `hf spaces logs izhan5/whatsapp-toolkit`
- Verify Dockerfile syntax: `docker build -t test .`

### App Crashes
- Check environment variables are set
- View runtime logs in HF Space settings
- Verify Supabase connection

### Port Issues
- Ensure Dockerfile exposes port 7860
- Server.js should use PORT env variable (already updated)

## 🔄 Updating Your Space

To deploy updates:

```bash
cd C:/Users/kk/Desktop/whatsapptool
git add .
git commit -m "Update: description of changes"
git push hf main
```

HF will automatically rebuild and redeploy.

## 📊 Current Status

- ✅ Code ready for deployment
- ⏳ Waiting for HF CLI authentication
- ⏳ Waiting for Space creation
- ⏳ Waiting for environment variables
- ⏳ Waiting for build completion

## 🆘 Need Help?

If you encounter errors:
1. Share the build logs with me
2. Check HF Spaces documentation: https://huggingface.co/docs/hub/spaces
3. Verify all environment variables are set

---

**Next Command to Run:**

```bash
hf auth login
```

Then follow the prompts!

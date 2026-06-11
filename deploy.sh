#!/bin/bash
# WhatsApp Toolkit - Hugging Face Deployment Script
# Run this script after logging in with: hf auth login

set -e  # Exit on error

echo "════════════════════════════════════════════════════════════"
echo "  WhatsApp Toolkit - Hugging Face Spaces Deployment"
echo "════════════════════════════════════════════════════════════"
echo ""

# Check if logged in
echo "🔍 Checking HF CLI authentication..."
if ! hf auth whoami &>/dev/null; then
    echo "❌ ERROR: Not logged into Hugging Face CLI"
    echo ""
    echo "Please run: hf auth login"
    echo "Get your token from: https://huggingface.co/settings/tokens"
    exit 1
fi

echo "✅ Authenticated as: $(hf auth whoami 2>&1 | grep -oP 'username: \K.*')"
echo ""

# Navigate to project directory
cd "$(dirname "$0")"

# Check if Space already exists
echo "🔍 Checking if Space exists..."
SPACE_EXISTS=$(hf repos ls --type space 2>&1 | grep -c "izhan5/whatsapp-toolkit" || true)

if [ "$SPACE_EXISTS" -eq "0" ]; then
    echo "📦 Creating new Space: izhan5/whatsapp-toolkit"
    hf repos create izhan5/whatsapp-toolkit --type space --sdk docker
    echo "✅ Space created successfully!"
else
    echo "ℹ️  Space already exists: izhan5/whatsapp-toolkit"
fi
echo ""

# Add HF remote if not exists
echo "🔗 Setting up git remote..."
if ! git remote | grep -q "^hf$"; then
    git remote add hf https://huggingface.co/spaces/izhan5/whatsapp-toolkit
    echo "✅ Added HF remote"
else
    echo "ℹ️  HF remote already exists"
fi
echo ""

# Push to Hugging Face
echo "🚀 Deploying to Hugging Face Spaces..."
git push hf main --force
echo ""

echo "════════════════════════════════════════════════════════════"
echo "✅ Deployment Complete!"
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Configure Environment Variables:"
echo "   Go to: https://huggingface.co/spaces/izhan5/whatsapp-toolkit/settings"
echo "   Add these secrets:"
echo "   - GROQ_API_KEY"
echo "   - SUPABASE_URL"
echo "   - SUPABASE_ANON_KEY"
echo ""
echo "2. Monitor Build:"
echo "   https://huggingface.co/spaces/izhan5/whatsapp-toolkit/logs"
echo ""
echo "3. Access Your App:"
echo "   https://izhan5-whatsapp-toolkit.hf.space"
echo ""
echo "Build time: ~5-10 minutes"
echo ""

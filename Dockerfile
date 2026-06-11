# WhatsApp Toolkit - Optimized for Hugging Face Spaces
# Fast build with minimal layers

FROM node:18-alpine

WORKDIR /app

# Install system dependencies in one layer (optimized)
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev

# Copy and install dependencies (with timeout protection)
COPY package*.json ./
RUN npm ci --omit=dev --prefer-offline --no-audit --progress=false || \
    npm install --production --no-audit --progress=false

# Copy application code
COPY . .

# Create directories
RUN mkdir -p .baileys_auth uploads backend/uploads

# Environment
ENV NODE_ENV=production \
    PORT=7860 \
    NODE_OPTIONS="--max-old-space-size=2048"

EXPOSE 7860

# Simplified startup (no health check to avoid startup delays)
CMD ["node", "server.js"]

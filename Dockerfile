# WhatsApp Toolkit - Production Dockerfile
# Optimized for Hugging Face Spaces deployment

FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for Baileys (WhatsApp library)
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    cairo-dev \
    jpeg-dev \
    pango-dev \
    giflib-dev

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p .baileys_auth uploads backend/uploads

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=7860

# Expose Hugging Face Spaces default port
EXPOSE 7860

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7860/api/test', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "server.js"]

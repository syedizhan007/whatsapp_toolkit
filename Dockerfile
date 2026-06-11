# Lightweight Node.js image for fast Hugging Face deployment
FROM node:20-slim

# Working directory
WORKDIR /app

# Install only essential system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies (production only for smaller size)
RUN npm ci --omit=dev || npm install --production

# Copy application code
COPY . .

# Create required directories
RUN mkdir -p .baileys_auth uploads backend/uploads

# Environment variables
ENV NODE_ENV=production \
    PORT=7860

# Expose port
EXPOSE 7860

# Health check for Hugging Face
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:7860/api/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Start application
CMD ["node", "server.js"]

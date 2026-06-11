# Simple lightweight Node.js image
FROM node:20-slim

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Create directories
RUN mkdir -p .baileys_auth uploads backend/uploads

# Environment
ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

# Start server
CMD ["node", "server.js"]

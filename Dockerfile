FROM node:20-slim
WORKDIR /app

# Skip Puppeteer/Chromium download (we use Baileys, not whatsapp-web.js)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Set port for Hugging Face Spaces (default is 7860)
ENV PORT=7860

COPY package*.json ./
RUN npm install --production
COPY . .

# Health check for container monitoring
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "require('http').get('http://localhost:7860/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

EXPOSE 7860
CMD ["node", "server.js"]

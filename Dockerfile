FROM node:20-slim
WORKDIR /app

# Skip Puppeteer/Chromium download (we use Baileys, not whatsapp-web.js)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_SKIP_DOWNLOAD=true

COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 7860
CMD ["node", "server.js"]

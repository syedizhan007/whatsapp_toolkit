# Node.js ka latest version use karo
FROM node:20

# System dependencies install karo (Puppeteer ke liye)
RUN apt-get update && apt-get install -y \
    chromium \
    libnss3 \
    libxss1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    && rm -rf /var/lib/apt/lists/*

# Working directory set karo
WORKDIR /app

# Dependencies copy aur install karo
COPY package*.json ./
RUN npm install

# Baaki files copy karo
COPY . .

# Environment variables
ENV PORT=7860
ENV NODE_ENV=production

# Port expose karo
EXPOSE 7860

# App run karo
CMD ["node", "server.js"]

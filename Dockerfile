FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    PUPPETEER_SKIP_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/chromium \
    LESLIE_DATA_DIR=/data

RUN apt-get update \
    && apt-get install -y --no-install-recommends chromium ca-certificates dumb-init fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./
COPY src ./src
COPY public ./public

RUN mkdir -p /data

EXPOSE 8787

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]

FROM node:22-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install tsx

# Source and server wrapper
COPY tsconfig.json ./
COPY src/ ./src/
COPY server.ts ./

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["npx", "tsx", "server.ts"]

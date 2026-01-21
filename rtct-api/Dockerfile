# Multi-arch base (works on Apple Silicon & Intel)
FROM node:22-alpine

WORKDIR /app

# Install deps first to leverage Docker layer cache
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

ENV NODE_ENV=production \
    PORT=4000

EXPOSE 4000
CMD ["node", "server.js"]
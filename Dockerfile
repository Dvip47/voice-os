# VoiceOS Distributed Runtime Dockerfile
# Optimized for high-concurrency Node.js microservices.

FROM node:23-slim

# Install system dependencies for audio rendering
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependency Caching Layer
COPY package*.json ./
RUN npm install --production

# Application Layer
COPY . .

# Environment Configuration
ENV NODE_ENV=production
ENV PORT=4000
ENV MAX_CONCURRENT_CALLS=50
ENV MAX_REQUESTS_PER_MINUTE=100

EXPOSE 4000

# High-Concurrency Command: Optimize Node process for Event Loop performance
CMD ["node", "--max-old-space-size=2048", "index.js"]

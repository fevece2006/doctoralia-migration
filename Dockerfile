FROM node:20-slim

# Install dependencies for Playwright
RUN apt-get update && apt-get install -y \
    dumb-init \
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --silent

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build TypeScript
RUN npm run build

# Install Playwright browsers with dependencies as root
RUN npx playwright install --with-deps chromium

# Set production environment
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/root/.cache/ms-playwright

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]

# Run the application
CMD ["sh", "-c", "npx prisma db push --accept-data-loss && node dist/pipeline/index.js"]
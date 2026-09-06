# ============================================
# Stage 1: Install ALL dependencies + Build
# ============================================
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# Copy package files first (Docker caches this layer if unchanged)
COPY package.json package-lock.json ./

# Single npm ci: install everything using pre-built binaries for Debian
RUN npm ci

# Copy source code (only invalidates cache when code changes)
COPY . .

ENV NODE_ENV=production
RUN npm run build

# ============================================
# Stage 2: Production image (lean)
# ============================================
FROM node:20-bookworm-slim AS production

WORKDIR /app

# Copy only production node_modules (prune dev deps from builder)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/favicon.png ./

# Remove dev dependencies from the copied node_modules
RUN npm prune --omit=dev 2>/dev/null || true

# Create uploads directory and set ownership to built-in 'node' user
RUN mkdir -p public/uploads && \
    chown -R node:node /app

USER node

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1338

EXPOSE 1338

CMD ["npm", "run", "start"]

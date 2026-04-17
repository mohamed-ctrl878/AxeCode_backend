# ============================================
# Stage 1: Install ALL dependencies + Build
# ============================================
FROM node:20-alpine AS builder

RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev python3

WORKDIR /app

# Copy package files first (Docker caches this layer if unchanged)
COPY package.json package-lock.json ./

# Single npm ci: install everything, rebuild native modules once
RUN npm ci --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

# Copy source code (only invalidates cache when code changes)
COPY . .

ENV NODE_ENV=production
RUN npm run build

# ============================================
# Stage 2: Production image (lean)
# ============================================
FROM node:20-alpine AS production

RUN apk add --no-cache vips-dev

# Create a non-root user for security
RUN addgroup -g 1001 -S strapi && \
    adduser -S strapi -u 1001

WORKDIR /app

# Copy only production node_modules (prune dev deps from builder)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/build ./build
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/favicon.png ./
COPY --from=builder /app/mediamtx.yml ./

# Remove dev dependencies from the copied node_modules
RUN npm prune --omit=dev 2>/dev/null || true

# Create uploads directory and set ownership
RUN mkdir -p public/uploads && \
    chown -R strapi:strapi /app

USER strapi

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1338

EXPOSE 1338

CMD ["npm", "run", "start"]

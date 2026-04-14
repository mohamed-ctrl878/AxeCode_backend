# ============================================
# Stage 1: Install production dependencies
# ============================================
FROM node:20-alpine AS deps

RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev python3

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

# ============================================
# Stage 2: Build Strapi admin panel
# ============================================
FROM node:20-alpine AS builder

RUN apk add --no-cache build-base gcc autoconf automake zlib-dev libpng-dev vips-dev python3

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts && \
    npm rebuild bcrypt --build-from-source

COPY . .

ENV NODE_ENV=production
RUN npm run build

# ============================================
# Stage 3: Production image
# ============================================
FROM node:20-alpine AS production

RUN apk add --no-cache vips-dev

# Create a non-root user for security
RUN addgroup -g 1001 -S strapi && \
    adduser -S strapi -u 1001

WORKDIR /app

# Copy production node_modules from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy built admin panel from builder stage
COPY --from=builder /app/build ./build
COPY --from=builder /app/config ./config
COPY --from=builder /app/src ./src
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
COPY --from=builder /app/favicon.png ./
COPY --from=builder /app/mediamtx.yml ./

# Create uploads directory and set ownership
RUN mkdir -p public/uploads && \
    chown -R strapi:strapi /app

USER strapi

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=1338

EXPOSE 1338

CMD ["npm", "run", "start"]

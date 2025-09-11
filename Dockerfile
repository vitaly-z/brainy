# Multi-stage Dockerfile for Brainy
# Optimized for production deployment with minimal image size

# Stage 1: Build stage
FROM node:22-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY . .

# Build the TypeScript code
RUN npm run build

# Remove dev dependencies and only keep production ones
RUN npm prune --production

# Stage 2: Production stage
FROM node:22-alpine

# Install production dependencies only
RUN apk add --no-cache tini

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Copy built application from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy necessary static files
COPY --chown=nodejs:nodejs README.md LICENSE ./

# Create data directory for file-based storage
RUN mkdir -p /app/data && chown -R nodejs:nodejs /app/data

# Switch to non-root user
USER nodejs

# Expose default port (can be overridden)
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV BRAINY_STORAGE_PATH=/app/data

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

# Use tini to handle signals properly
ENTRYPOINT ["/sbin/tini", "--"]

# Default command (can be overridden)
CMD ["node", "dist/index.js"]
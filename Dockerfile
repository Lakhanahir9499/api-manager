# Root Dockerfile for Render - builds backend
# This satisfies Render's Docker detection while we use buildpacks via render.yaml

FROM node:22-alpine AS base
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm ci

# Copy backend source
COPY backend/ ./backend/

# Build backend
RUN cd backend && npm run build

# Expose port (Render injects PORT env)
EXPOSE 10000

# Start backend
CMD ["node", "backend/dist/index.js"]
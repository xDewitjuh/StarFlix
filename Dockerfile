FROM node:22 as builder

WORKDIR /usr/src/starflix

# Copy package files
COPY backend/package*.json ./backend/

# Install dependencies
RUN cd backend && npm ci
# RUN cd backend && npm rebuild esbuild

# Development image
FROM node:22

WORKDIR /usr/src/starflix

# Copy node_modules from builder
COPY --from=builder /usr/src/starflix/backend/node_modules ./backend/node_modules

# Add start script
CMD ["npm", "run", "internal:dev"]

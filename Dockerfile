# Use python:3.10-slim as requested to keep the base image small and secure
FROM python:3.10-slim

# Set timezone and install non-interactive system dependencies (Node.js, build-essential, curl)
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production

WORKDIR /app

# Install system utilities, OpenCV requirements, and Node.js
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    ca-certificates \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    # Clean apt caches to keep image lightweight
    && rm -rf /var/lib/apt/lists/*

# Install python headless OpenCV and dependencies inside RAM environments
RUN pip install --no-cache-dir opencv-python-headless numpy tenacity

# Copy package descriptors first to maximize layer caching
COPY package*.json ./

# Install npm dependencies (including esbuild and typescript compiler)
RUN npm ci --include=dev

# Copy the rest of the application codebase
COPY . .

# Build Node.js full-stack bundled distribution package
RUN npm run build \
    && npm prune --omit=dev

# Expose ONLY platform route standard port (3000)
EXPOSE 3000

# Start Express Production Server
CMD ["npm", "run", "start"]

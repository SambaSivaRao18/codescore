# -----------------------------------------------------------------------------
# CodeScore Backend — Docker Image
#
# This Dockerfile installs everything the executor.js needs to compile and run
# student code in all three supported languages:
#   • Java  ? openjdk-21 (javac + java)
#   • Python ? python3
#   • C      ? gcc
#
# The Node.js backend (server.js + database.js) runs on top.
# The SQLite database file (competition.db) is created inside the container at
# runtime. It does NOT touch any external database or change the backend logic.
# -----------------------------------------------------------------------------

# Use Debian-based Node 20 slim image (matches engines in package.json)
FROM node:20-slim

# -- System dependencies -------------------------------------------------------
# Install:
#   default-jdk      ? provides javac + java (OpenJDK)
#   python3          ? python3 interpreter
#   gcc              ? C compiler (gcc)
#   ca-certificates  ? needed by apt and Java SSL
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        default-jdk \
        python3 \
        gcc \
        ca-certificates && \
    # Create a "python" alias so executor.js fallback (python ? python3) works
    ln -sf /usr/bin/python3 /usr/bin/python && \
    # Clean up apt cache to keep the image lean
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# -- Working directory ---------------------------------------------------------
WORKDIR /app

# -- Install Node dependencies -------------------------------------------------
# Copy package files first for better Docker layer caching
COPY package.json package-lock.json ./

# Rebuild sqlite3 native bindings for Linux inside the container
RUN npm ci && npm rebuild sqlite3

# -- Copy application source ---------------------------------------------------
# Copies: server.js, executor.js, database.js, .env (if present)
# Does NOT copy node_modules (already installed above)
COPY . .

# -- Runtime configuration -----------------------------------------------------
# Expose the port the Express server listens on
EXPOSE 3000

# Set NODE_ENV to production
ENV NODE_ENV=production

# -- Health check --------------------------------------------------------------
# Render will mark the service healthy once this passes
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/runtimes', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

# -- Start the server ----------------------------------------------------------
CMD ["node", "server.js"]

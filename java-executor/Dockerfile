# -----------------------------------------------------------------------------
# Java Executor Microservice — Docker Image
# Only job: compile Java code and run it, return output via HTTP
# Does NOT touch the database, teams, or any backend logic
# -----------------------------------------------------------------------------

FROM node:20-slim

# Install ONLY Java JDK (javac + java) — nothing else needed
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        default-jdk \
        ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./

EXPOSE 4000

ENV NODE_ENV=production

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:4000/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server.js"]

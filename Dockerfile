# Node 22 LTS — matches modern deps (mongoose 9, express 5)
# Cloud Run requires linux/amd64; scripts/cloud-run.sh builds with --platform linux/amd64 (see GCP_DOCKER_PLATFORM).
FROM node:22-alpine

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production

# Cloud Run injects PORT (often 8080); app falls back to 3000 locally
EXPOSE 8080

CMD ["node", "server.js"]

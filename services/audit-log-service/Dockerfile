FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production PORT=8080

COPY package*.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && adduser -S auditlog -u 1001 && mkdir -p logs && chown -R auditlog:nodejs logs

USER auditlog

EXPOSE 8080

CMD ["node","dist/server.js"]

FROM node:18-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

RUN npm run build && npm prune --omit=dev && npm cache clean --force

FROM node:18-alpine
WORKDIR /app

ENV NODE_ENV=production PORT=8080

COPY package.json package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/templates/email ./dist/templates/email

RUN addgroup -g 1001 -S nodejs && adduser -S notifier -u 1001 && mkdir -p logs && chown -R notifier:nodejs /app

USER notifier

EXPOSE 8080

CMD ["node", "dist/server.js"]

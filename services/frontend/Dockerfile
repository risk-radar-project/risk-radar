FROM node:20-alpine

WORKDIR /app

# Environment for Next.js dev
ENV NEXT_TELEMETRY_DISABLED=1 \
	PORT=3000 \
	HOSTNAME=0.0.0.0 \
	NODE_ENV=development

# Install deps once at build time for faster container start
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund

# Copy source (keeps dev server behavior)
COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev"]


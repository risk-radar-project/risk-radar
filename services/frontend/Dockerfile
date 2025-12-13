FROM node:20-alpine

WORKDIR /app

# Set environment variables
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Expose port
EXPOSE 3000

# Install dependencies and run dev server
# Dependencies will be installed from mounted volume on first run
CMD ["sh", "-c", "npm install --legacy-peer-deps && npm run dev"]


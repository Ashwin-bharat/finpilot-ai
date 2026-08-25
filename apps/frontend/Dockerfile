FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace definition and lockfile
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/frontend ./apps/frontend

# Install dependencies and build frontend
RUN npm ci
RUN npx turbo run build --filter=frontend

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/frontend ./apps/frontend
COPY --from=builder /app/packages ./packages

EXPOSE 3000
CMD ["npm", "--prefix", "apps/frontend", "run", "start"]

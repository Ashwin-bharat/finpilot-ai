FROM node:20-alpine AS builder
WORKDIR /app

# Copy root workspace definition and lockfile
COPY package.json package-lock.json turbo.json ./
COPY packages ./packages
COPY apps/backend ./apps/backend

# Install dependencies and build shared packages & backend
RUN npm ci
RUN npx prisma generate --schema=apps/backend/prisma/schema.prisma
RUN npx turbo run build --filter=backend

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend ./apps/backend
COPY --from=builder /app/packages ./packages

EXPOSE 4000
CMD ["npm", "--prefix", "apps/backend", "run", "start"]

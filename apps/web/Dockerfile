# Next.js 應用（apps/web）
# 建置請在儲存庫根目錄執行（build context 需含根目錄 package.json，以符合 outputFileTracingRoot）：
#   docker build -f apps/Dockerfile -t mealvote-web .
# 執行：
#   docker run -p 3001:3001 mealvote-web

FROM node:20-alpine AS deps
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json ./apps/web/
WORKDIR /app/apps/web
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/web ./apps/web
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
WORKDIR /app/apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
CMD ["node", "apps/web/server.js"]

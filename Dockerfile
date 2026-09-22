# syntax=docker/dockerfile:1
# Многостадийная сборка Project Visor (требуется BuildKit, включён по умолчанию
# в Docker 23+ и `docker compose` v2/v5).
#
# Стадии:
#   base    — Node 24 Alpine + libc6-compat, общие ENV/WORKDIR
#   deps    — `npm ci` с BuildKit-кэшем npm (перекачка пакетов только при
#             изменении package.json/package-lock.json)
#   builder — `next build` с BuildKit-кэшем .next/cache (инкрементальная
#             компиляция: повторная сборка при правках только в src/ — быстрая)
#   runner  — минимальный прод-образ: только standalone-вывод Next.js,
#             запуск от non-root пользователя nextjs
#
# Быстрая пересборка: основная причина долгой сборки раньше — широкий контекст
# (`COPY . .` тащил data/*.db-wal, docs/, scripts/ и инвалидировал кэш при
# любом чихе). См. .dockerignore — в контекст идёт только то, что нужно сборке.

FROM node:24-alpine AS base
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---- deps: установка зависимостей (кэшируется по package*.json) ----
FROM base AS deps
COPY package.json package-lock.json ./
# Кэш npm переживает пересборки: повторный `npm ci` докачивает только дельту
RUN --mount=type=cache,target=/root/.npm \
    npm ci --prefer-offline --no-audit --no-fund

# ---- builder: сборка Next.js (кэшируется .next/cache) ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Кэш компилятора Next.js переживает пересборки: меняется только src/ —
# пересобирается только изменённое, node_modules и прочее берётся из кэша
RUN --mount=type=cache,target=/app/.next/cache \
    npm run build

# ---- runner: минимальный прод-образ ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs \
 && mkdir -p /app/data /app/.next \
 && chown -R nextjs:nodejs /app

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||'3000')+'/api/version').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "server.js"]

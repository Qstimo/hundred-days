# Сборка веб-приложения.
#
# Три стадии: зависимости, сборка, запуск. Разделены, чтобы установка
# зависимостей не повторялась при правке исходников — слой остаётся в кэше,
# пока не изменился lock-файл.
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY web/package.json web/pnpm-lock.yaml ./
# --frozen-lockfile: сборка обязана ставить ровно то, что зафиксировано.
# Иначе образ однажды соберётся с другой версией, чем проверял CI.
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY web/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Отдельный вывод Next: только нужные файлы, без всего node_modules.
# Статика и public копируются отдельно — в отдельный вывод они не входят.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

USER node
EXPOSE 3000
CMD ["node", "server.js"]

FROM node:22.12.0-alpine AS base

FROM base AS builder

RUN apk add --no-cache gcompat
WORKDIR /app

COPY package.json yarn.lock tsconfig.json src ./

RUN yarn install --frozen-lockfile && \
    yarn build && \
    yarn install --production --frozen-lockfile

FROM base AS runner
WORKDIR /app

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json

USER hono
EXPOSE 3333

CMD ["node", "/app/dist/index.js"]

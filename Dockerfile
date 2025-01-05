# ============================================================
# 1. Builder Stage
# ============================================================
FROM node:22 AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN npm install -g pnpm
RUN pnpm install

COPY tsconfig.json ./
COPY src ./src

RUN pnpm run build

# ============================================================
# 2. Production Stage
# ============================================================
FROM node:22 AS production

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod

COPY --from=builder /app/dist ./dist

EXPOSE 3333

CMD ["node", "./dist/index.js"]

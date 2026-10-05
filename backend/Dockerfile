# 第一階段建置
FROM node:24-alpine AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY backend/package.json ./backend/
COPY packages/contracts/package.json ./packages/contracts/
# 安裝依賴
RUN npm install -g pnpm@11.25.0
RUN pnpm install --frozen-lockfile
# 複製Source code
COPY backend/ ./backend/
COPY packages/contracts/ ./packages/contracts/
# 打包
RUN pnpm run prisma:generate
RUN pnpm run build:backend

# 第二階段建置
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend/node_modules ./backend/node_modules
COPY --from=builder /app/backend/package.json ./backend/package.json
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma
COPY --from=builder /app/backend/prisma.config.ts ./backend/prisma.config.ts
COPY --from=builder /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=builder /app/packages/contracts/dist ./packages/contracts/dist
# 安裝啟動 script 所需的 pnpm
RUN npm install -g pnpm@11.25.0
CMD ["sh", "-c", "cd backend && npx --no prisma migrate deploy && exec node dist/src/main.js"]
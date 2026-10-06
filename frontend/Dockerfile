FROM node:24-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY frontend/package.json ./frontend/
COPY packages/contracts/package.json ./packages/contracts/
# 安裝依賴
RUN npm install -g pnpm@11.25.0
RUN pnpm install --frozen-lockfile
ARG VITE_API_URL=/v1/api
ARG VITE_SOCKET_URL=/
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_SOCKET_URL=${VITE_SOCKET_URL}
# 複製Source code
COPY frontend/ ./frontend/
COPY packages/contracts/ ./packages/contracts/
# 打包
RUN pnpm run build:frontend

# 第二階段建置
FROM nginx:1.31.6-alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html/
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
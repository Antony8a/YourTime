# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/mobile/package.json apps/mobile/
COPY packages/*/package.json packages/*/

RUN pnpm install --frozen-lockfile

COPY apps/mobile/ apps/mobile/
COPY packages/ packages/

WORKDIR /app/apps/mobile
RUN pnpm run build

# Run stage (for web preview)
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/mobile/dist /usr/share/nginx/html
COPY infra/docker/nginx.mobile.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
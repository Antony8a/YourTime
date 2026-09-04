# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/*/package.json packages/*/

RUN pnpm install --frozen-lockfile

COPY apps/web/ apps/web/
COPY packages/ packages/

WORKDIR /app/apps/web
RUN pnpm run build

# Run stage
FROM nginx:alpine AS runner

COPY --from=builder /app/apps/web/dist/yourtime/browser /usr/share/nginx/html
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
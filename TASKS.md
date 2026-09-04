# YourTime - Task Breakdown (FASE 0: Foundation)

> **Formato:** `[ID] Descripción` → genera `archivo(s)`  
> **Orden:** Ejecutar secuencialmente. Marcar `[x]` al completar y commitear.

---

## FASE 0: Foundation (Semana 1)

### 0.1 Inicializar Monorepo Base
- [x] **0.1.1** `package.json` raíz con workspaces, scripts, devDeps (turbo, typescript, eslint, prettier, husky, lint-staged, pnpm)
- [x] **0.1.2** `pnpm-workspace.yaml` → `apps/*`, `packages/*`
- [x] **0.1.3** `turbo.json` pipeline (build, test, lint, typecheck, dev, generate, db:migrate, clean)
- [x] **0.1.4** `tsconfig.base.json` (composite, references, strict)
- [x] **0.1.5** `.gitignore` raíz (node_modules, dist, build, .turbo, coverage, .env*, *.log, IDE)
- [x] **0.1.6** `.editorconfig` (indent, eol, charset, final newline)
- [x] **0.1.7** `.prettierrc` + `prettier-plugin-organize-imports` + `prettier-plugin-packagejson`
- [x] **0.1.8** `.eslintrc.js` raíz (extends recomendados, parserOptions.project)
- [x] **0.1.9** `Makefile` raíz (dev, build, test, lint, db:up/down/migrate/seed, generate, clean, ci)
- [x] **0.1.10** `README.md` raíz (descripción, quick start, scripts, estructura)
- [x] **0.1.11** `CONTRIBUTING.md` (branch strategy, conventional commits, PR checklist)
- [x] **0.1.12** `LICENSE` (MIT)
- [x] **0.1.13** `git init` + commit inicial "chore: bootstrap monorepo"

### 0.2 Paquetes Compartidos
- [x] **0.2.1** `packages/shared-types/package.json` (name: `@yourtime/shared-types`, main: `dist/index.js`, types: `dist/index.d.ts`)
- [x] **0.2.2** `packages/shared-types/tsconfig.json` (composite, declaration, declarationMap)
- [x] **0.2.3** `packages/shared-types/src/index.ts` (barrel export vacío inicial)
- [x] **0.2.4** `packages/shared-types/src/api/` (auth.ts, tasks.ts, tokens.ts, users.ts, messages.ts, notifications.ts - interfaces vacías)
- [x] **0.2.5** `packages/shared-types/src/models/` (user.ts, task.ts, token.ts, common.ts - tipos vacíos)
- [x] **0.2.6** `packages/shared-types/src/enums/` (task-status.ts, transaction-type.ts, application-status.ts)
- [x] **0.2.7** `packages/shared-utils/package.json` (name: `@yourtime/shared-utils`)
- [x] **0.2.8** `packages/shared-utils/tsconfig.json`
- [x] **0.2.9** `packages/shared-utils/src/index.ts` (barrel)
- [x] **0.2.10** `packages/shared-utils/src/date/` (format.ts, parse.ts, relative.ts - stubs)
- [x] **0.2.11** `packages/shared-utils/src/currency/` (format.ts, convert.ts, tokens.ts - stubs)
- [x] **0.2.12** `packages/shared-utils/src/validation/` (email.ts, phone.ts, password.ts, schemas.ts - Zod stubs)
- [x] **0.2.13** `packages/shared-utils/src/string/` (slugify.ts, truncate.ts, mask.ts - stubs)
- [x] **0.2.14** Build test: `pnpm --filter @yourtime/shared-types build` y `@yourtime/shared-utils`

### 0.3 Scaffold Backend (Go)
- [ ] **0.3.1** `apps/backend/go.mod` (module: `github.com/yourtime/backend`, go 1.23)
- [ ] **0.3.2** `apps/backend/go.work` (workspace root)
- [ ] **0.3.3** `apps/backend/.golangci.yml` (copiar del plan)
- [ ] **0.3.4** `apps/backend/Makefile` (copiar del plan: run, dev, test, lint, generate, migrate, build, clean)
- [ ] **0.3.5** `apps/backend/.air.toml` (hot reload config)
- [ ] **0.3.6** `apps/backend/tools/sqlc.yaml` (config SQLC)
- [ ] **0.3.7** `apps/backend/cmd/server/main.go` (entry point minimal: config, logger, server start)
- [ ] **0.3.8** `apps/backend/cmd/server/wire.go` (Wire DI skeleton)
- [ ] **0.3.9** `apps/backend/internal/config/config.go` (Viper: env, yaml, defaults)
- [ ] **0.3.10** `apps/backend/internal/platform/logger/zerolog.go` (zerolog setup)
- [ ] **0.3.11** `apps/backend/internal/domain/common/` (valueobjects: email.go, phone.go, password.go, money.go, tokens.go, coordinates.go + errors.go)
- [ ] **0.3.12** `apps/backend/internal/domain/user/` (entity.go, repository.go interface, service.go, errors.go)
- [ ] **0.3.13** `apps/backend/internal/infrastructure/persistence/postgres/` (db.go, tx.go, migrations/.gitkeep, queries/.gitkeep, sqlc/.gitkeep, repository/.gitkeep)
- [ ] **0.3.14** `apps/backend/internal/infrastructure/auth/jwt.go` (JWT generate/parse/validate)
- [ ] **0.3.15** `apps/backend/internal/infrastructure/http/router.go` (Chi router + middleware chain)
- [ ] **0.3.16** `apps/backend/internal/infrastructure/http/middleware/` (auth.go, cors.go, logging.go, rate_limit.go, recovery.go)
- [ ] **0.3.17** `apps/backend/internal/infrastructure/http/response.go` (API response helpers: OK, Created, Error, ProblemDetails)
- [ ] **0.3.18** `apps/backend/internal/application/common/` (handler.go base, validator.go, pagination.go)
- [ ] **0.3.19** `apps/backend/scripts/migrate.go` (Goose runner: up, down, status, create)
- [ ] **0.3.20** `apps/backend/scripts/seed.go` (seed data runner)
- [ ] **0.3.21** `apps/backend/scripts/generate.go` (sqlc generate, wire, mocks, swagger)
- [ ] **0.3.22** `apps/backend/Dockerfile` (multi-stage: builder → alpine runtime)
- [ ] **0.3.23** `apps/backend/.dockerignore`
- [ ] **0.3.24** `go mod tidy` + `go mod verify` + `make generate` (wire, sqlc) compila sin errores

### 0.4 Scaffold Frontend Web (Angular)
- [x] **0.4.1** `apps/web/package.json` (Angular 19, Material, Signals, Vitest, ESLint, Prettier)
- [x] **0.4.2** `apps/web/tsconfig.json` + `tsconfig.app.json` + `tsconfig.spec.json` (strict, path aliases @yourtime/*)
- [x] **0.4.3** `apps/web/angular.json` (standalone, esbuild/vite builder, outputPath: `dist/apps/web`)
- [x] **0.4.4** `apps/web/vite.config.ts` (plugins: angular, tailwindcss opcional)
- [x] **0.4.5** `apps/web/.eslintrc.json` (extends root + angular-specific)
- [x] **0.4.6** `apps/web/.prettierrc` (extends root)
- [x] **0.4.7** `apps/web/src/styles/` (_variables.scss, _mixins.scss, _reset.scss, _typography.scss, _theme.scss, globals.scss, material-theme.scss)
- [x] **0.4.8** `apps/web/src/main.ts` (bootstrapApplication con providers: HttpClient, Router, Animations, Interceptors)
- [x] **0.4.9** `apps/web/src/app/app.config.ts` (provideHttpClient con interceptors, provideRouter, provideAnimations)
- [x] **0.4.10** `apps/web/src/app/app.routes.ts` (rutas raíz: redirect '', loadChildren features)
- [x] **0.4.11** `apps/web/src/app/app.component.ts` (minimal: `<router-outlet>`)
- [x] **0.4.12** `apps/web/src/app/core/` (auth: service, guards, interceptors; http: api-client, interceptors; config: environment; utils)
- [x] **0.4.13** `apps/web/src/app/shared/` (components/ui: button, input, card, modal, avatar, badge, spinner; pipes: tokens, currency, relative-time; directives: click-outside, focus-trap)
- [x] **0.4.14** `apps/web/src/app/features/` (auth: login, register pages; layout: main-layout, auth-layout)
- [x] **0.4.15** `apps/web/src/environments/` (environment.ts, development.ts, production.ts)
- [x] **0.4.16** `apps/web/Dockerfile` (multi-stage: builder node → nginx alpine)
- [x] **0.4.17** `apps/web/nginx.conf` (SPA fallback, gzip, cache static, proxy /api)
- [x] **0.4.18** `ng build` compila sin errores

### 0.5 Scaffold Mobile (React Native + Expo)
- [x] **0.5.1** `apps/mobile/package.json` (Expo SDK 51, React Native 0.76, Expo Router v4, NativeWind v4, Zustand, React Query, React Hook Form, Zod)
- [x] **0.5.2** `apps/mobile/tsconfig.json` (strict, path aliases @yourtime/*, jsx: react-jsx)
- [x] **0.5.3** `apps/mobile/tailwind.config.js` (NativeWind config, content paths)
- [x] **0.5.4** `apps/mobile/metro.config.js` (withTamagui/NativeWind, resolver alias)
- [x] **0.5.5** `apps/mobile/babel.config.js` (NativeWind, Reanimated)
- [x] **0.5.6** `apps/mobile/app.json` (Expo config: name, slug, scheme, platforms, plugins)
- [x] **0.5.7** `apps/mobile/eas.json` (build profiles: development, preview, production)
- [x] **0.5.8** `apps/mobile/.eslintrc.js` (extends root + react-native, prettier)
- [x] **0.5.9** `apps/mobile/.prettierrc` (extends root)
- [x] **0.5.10** `apps/mobile/app/_layout.tsx` (root layout: providers, SafeAreaProvider)
- [x] **0.5.11** `apps/mobile/app/(auth)/_layout.tsx` (stack navigator, no header)
- [x] **0.5.12** `apps/mobile/app/(auth)/login.tsx` (screen skeleton)
- [x] **0.5.13** `apps/mobile/app/(auth)/register.tsx` (screen skeleton)
- [x] **0.5.14** `apps/mobile/app/(app)/_layout.tsx` (tabs navigator: Home, Tasks, Tokens, Messages, Profile)
- [x] **0.5.15** `apps/mobile/app/(app)/index.tsx` (Home screen skeleton)
- [x] **0.5.16** `apps/mobile/src/components/ui/` (Button, Input, Card, Modal, Avatar, Badge, Spinner, Rating - NativeWind)
- [x] **0.5.17** `apps/mobile/src/hooks/` (useAuth.ts, useTasks.ts, useTokens.ts, useMessages.ts, useNotifications.ts, useWebSocket.ts, useImagePicker.ts, useLocation.ts)
- [x] **0.5.18** `apps/mobile/src/services/api/client.ts` (Ky/Axios instance con baseURL, interceptors)
- [x] **0.5.19** `apps/mobile/src/store/` (authStore.ts, taskStore.ts - Zustand persist)
- [x] **0.5.20** `apps/mobile/src/utils/` (date.ts, currency.ts, validation.ts, format.ts)
- [x] **0.5.21** `apps/mobile/src/constants/` (colors.ts, spacing.ts, config.ts)
- [x] **0.5.22** `apps/mobile/src/styles/global.css` (@tailwind base/components/utilities)
- [x] **0.5.23** `npx expo-doctor` pasa sin warnings críticos

### 0.6 Infraestructura Local (Docker Compose)
- [ ] **0.6.1** `infra/docker/docker-compose.yml` (postgres, redis, minio, mailpit, caddy, backend, web)
- [ ] **0.6.2** `infra/docker/Dockerfile.backend` (multi-stage, non-root user, healthcheck)
- [ ] **0.6.3** `infra/docker/Dockerfile.web` (multi-stage builder → nginx)
- [ ] **0.6.4** `infra/docker/.env.example` (todas las vars necesarias)
- [ ] **0.6.5** `infra/docker/postgres/init/01-extensions.sql` (uuid-ossp, pg_trgm, postgis opcional)
- [ ] **0.6.6** `infra/docker/postgres/init/02-schema.sql` (CREATE TABLEs del DATA_MODEL.md)
- [ ] **0.6.7** `infra/docker/postgres/init/03-seed.sql` (categories, platform_config)
- [ ] **0.6.8** `infra/docker/postgres/postgresql.conf` (tuning básico: shared_buffers, work_mem, max_connections)
- [ ] **0.6.9** `infra/docker/redis/redis.conf` (maxmemory, policy, appendonly)
- [ ] **0.6.10** `infra/docker/minio/buckets.json` (bucket: yourtime, policy: public-read para avatars)
- [ ] **0.6.11** `infra/docker/caddy/Caddyfile` (local HTTPS: api.yourtime.local, yourtime.local, minio, mail)
- [ ] **0.6.12** `make db:up` → todos los contenedores healthy
- [ ] **0.6.13** `make db:migrate` → migraciones aplicadas (goose)
- [ ] **0.6.14** `make db:seed` → datos semilla insertados
- [ ] **0.6.15** Verificar conectividad: `psql -h localhost -U yourtime -d yourtime -c "SELECT count(*) FROM categories;"`

### 0.7 CI/CD GitHub Actions
- [ ] **0.7.1** `.github/workflows/ci.yml` (jobs: lint-format, typecheck, go-checks, angular-checks, mobile-checks, docker-build)
- [ ] **0.7.2** `.github/dependabot.yml` (weekly updates para npm, go, docker, github-actions)
- [ ] **0.7.3** `.github/pull_request_template.md` (checklist: tests, lint, typecheck, docs, breaking changes)
- [ ] **0.7.4** Configurar secrets en GitHub (DOCKERHUB_TOKEN, GCP_SA_KEY, etc. - documentar en README)

### 0.8 Git Hooks & Quality Gates
- [ ] **0.8.1** `husky install` → `.husky/pre-commit` (lint-staged)
- [ ] **0.8.2** `.lintstagedrc.json` (prettier --write, eslint --fix, gofmt/goimports)
- [ ] **0.8.3** `commitlint.config.js` (conventional commits config)
- [ ] **0.8.4** `.husky/commit-msg` (commitlint)
- [ ] **0.8.5** Test: `git commit -m "test: mensaje"` falla; `git commit -m "feat: add login"` pasa

### 0.9 Verificación End-to-End Local
- [ ] **0.9.1** `make dev-backend` → backend en `http://localhost:8080/health` retorna 200
- [ ] **0.9.2** `make dev-web` → Angular en `http://localhost:4200` carga
- [ ] **0.9.3** `make dev-mobile` → Expo abre en `http://localhost:8081` / QR
- [ ] **0.9.4** `make test` → todos los tests pasan (backend + web + mobile + shared)
- [ ] **0.9.5** `make lint` → 0 errores
- [ ] **0.9.6** `make typecheck` → 0 errores TypeScript / Go
- [ ] **0.9.7** `make build` → binarios/artefactos generados
- [ ] **0.9.8** `docker compose -f infra/docker/docker-compose.yml up -d` → stack completo levanta
- [ ] **0.9.9** Commit final: "chore: complete FASE 0 - monorepo ready for development"

---

## Próximas Fases (Referencia - NO implementar aún)

### FASE 1: Auth & Users
- 1.1 Domain User + Repository Interface
- 1.2 Postgres User Repository (SQLC)
- 1.3 Auth Commands (Register, Login, Refresh, Logout, Forgot/Reset)
- 1.4 Auth Queries (GetMe)
- 1.5 HTTP Handlers + Middleware Auth
- 1.6 Tests Unit + Integration
- 1.7 Angular Auth Store + Interceptors + Guards
- 1.8 Angular Pages (Login, Register, Forgot/Reset)
- 1.9 Mobile Auth Store + SecureStore + Biometric
- 1.10 Mobile Screens (Login, Register, Forgot/Reset)

### FASE 2: Tasks & Applications
- 2.1 Domain Task/Application/Category/Skill
- 2.2 Task Status Machine
- 2.3 Commands (Create, Update, Cancel, Apply, Accept/Reject, Start, Complete, Dispute)
- 2.4 Queries (List con filtros geo/presupuesto, Get, GetApplications)
- 2.5 Domain Events + Notifications
- 2.6 Web: TaskList, TaskDetail, CreateTask, MyTasks
- 2.7 Mobile: TaskList, TaskDetail, CreateTask, MyTasks
- 2.8 Image Upload + Location Picker

### FASE 3: Token Economy
- 3.1 Domain TokenBalance/Transaction/Purchase/Withdrawal
- 3.2 TokenService (exchange, fees, validation)
- 3.3 Ledger Inmutable + Balance Atómico
- 3.4 Stripe Integration (PaymentIntent, Webhooks)
- 3.5 MercadoPago Integration
- 3.6 Withdrawal Flow (Request → Admin → Payout)
- 3.7 Platform Config (DB, Admin-editable)
- 3.8 Web/Mobile: Balance, Buy, History, Withdraw

### FASE 4: Chat & Notifications
- 4.1 Domain Conversation/Message/Notification
- 4.2 WebSocket Server (Gorilla)
- 4.3 Real-time Events
- 4.4 Push (Expo) + Service Worker (Web)
- 4.5 Email Templates
- 4.6 UI Chat Component

### FASE 5: Reviews, Admin & Polish
- 5.1 Review Domain + Flow
- 5.2 Admin Panel (Users, Tasks, Withdrawals, Disputes, Config)
- 5.3 Dispute Resolution
- 5.4 Referral System
- 5.5 PWA + Mobile Build Config

### FASE 6: Production Hardening
- 6.1 Load Testing (k6)
- 6.2 Security Audit
- 6.3 Chaos Engineering
- 6.4 Runbooks
- 6.5 Docs + ADRs
- 6.6 Backup/Restore Drill
- 6.7 Cost Optimization
- 6.8 Launch Sign-off

---

## Cómo Usar Este Archivo

```bash
# 1. Ver tarea actual
grep -n "^\- \[ \]" TASKS.md | head -1

# 2. Ejecutar tarea (ej. 0.1.1)
# Yo genero los archivos → Tú revisas → make test → git add → commit

# 3. Marcar completada
sed -i 's/^- \[ \] 0.1.1/- [x] 0.1.1/' TASKS.md

# 4. Commit convencional
git commit -m "chore(monorepo): add root package.json with workspaces and tooling"
```

---

**Estado actual:** Listo para **Tarea 0.1.1** → `package.json` raíz.
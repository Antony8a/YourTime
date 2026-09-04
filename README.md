# YourTime

Marketplace de servicios locales donde usuarios solicitan y ofrecen tiempo/habilidades, usando un sistema de tokens internos convertibles a dinero real.

## Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| **Backend** | Go 1.23 + Chi + SQLC + PostgreSQL |
| **Web** | Angular 19 + Signals + Material + Vite |
| **Mobile** | React Native 0.76 + Expo Router + NativeWind |
| **Infra** | Docker Compose (local) → Cloud Run / GCP (prod) |
| **Monorepo** | pnpm + Turborepo |

## Arquitectura

- **Clean Architecture + DDD** en backend
- **Modular Monolith** listo para extraer microservicios
- **Shared packages** para tipos y utilidades cross-platform

## Inicio Rápido

### Prerrequisitos
- Node.js 20+ y pnpm 9+
- Go 1.23+
- Docker Desktop

### Instalación

```bash
# 1. Clonar e instalar dependencias
git clone <repo>
cd yourtime
pnpm install

# 2. Levantar infraestructura local (Postgres, Redis, MinIO, Mailpit, Caddy)
make db:up

# 3. Configurar variables de entorno
cp infra/docker/.env.example infra/docker/.env.local
# Editar .env.local con tus keys (Stripe, MercadoPago, etc.)

# 4. Generar código (SQLC, Wire, mocks, types)
make generate

# 5. Migrar y seed database
make db:migrate
make db:seed

# 6. Desarrollo (3 terminales separadas)
make dev-backend    # Puerto 8080 - API en https://api.yourtime.local
make dev-web        # Puerto 4200 - Web en https://yourtime.local
make dev-mobile     # Expo en 8081 - Mobile via Expo Go
```

### Verificación

```bash
# Health checks
curl https://api.yourtime.local/health
# {"status":"ok"}

# Tests
make test

# Lint + Typecheck
make lint
make typecheck
```

## Estructura del Proyecto

```
yourtime/
├── apps/
│   ├── backend/     # Go API Server
│   ├── web/         # Angular Web App
│   └── mobile/      # React Native (Expo) App
├── packages/
│   ├── shared-types/    # TypeScript types compartidos
│   └── shared-utils/    # Utilidades puras (dates, currency, validation)
├── infra/
│   └── docker/          # Docker Compose, Dockerfiles, Caddy
├── docs/                # Documentación arquitectural
└── TASKS.md             # Plan de implementación detallado
```

## Scripts Principales

```bash
# Desarrollo
make dev              # Todo en paralelo
make dev-backend      # Solo backend
make dev-web          # Solo web
make dev-mobile       # Solo mobile

# Base de datos
make db:up            # Levantar Docker Compose
make db:down          # Bajar stack
make db:migrate       # Ejecutar migraciones
make db:seed          # Datos semilla
make db:reset         # Reset completo

# Calidad
make lint             # Lint todo
make typecheck        # Types todo
make test             # Tests todo
make format           # Formatear código

# Build
make build            # Build todo
make build-backend    # Build Go binary
make build-web        # Build Angular prod
make build-mobile     # Build Expo web

# CI
make ci               # Pipeline completo (format, lint, typecheck, test, build)
```

## Documentación

| Documento | Descripción |
|-----------|-------------|
| `TECH_STACK.md` | Stack detallado con versiones |
| `DATA_MODEL.md` | Modelo SQL, ERD, migraciones |
| `API_CONTRACTS.md` | REST API + WebSocket endpoints |
| `PROJECT_STRUCTURE.md` | Scaffolding completo |
| `CLEAN_CODE_STANDARDS.md` | Estándares, arquitectura, code review |
| `TOKEN_ECONOMY.md` | Sistema tokens, flujos, fees |
| `INFRASTRUCTURE_PLAN.md` | Local + Cloud-ready, CI/CD, observabilidad |
| `IMPLEMENTATION_PLAN.md` | Plan 6 fases × 12 semanas |
| `TASKS.md` | Breakdown atómico FASE 0 |

## Variables de Entorno

Copiar `infra/docker/.env.example` a `infra/docker/.env.local` y completar:

```bash
# Database
DB_PASSWORD=yourtime_dev

# JWT (mínimo 32 chars)
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars-long

# Payments (obtener de dashboards)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
MERCADOPAGO_ACCESS_TOKEN=TEST-...
MERCADOPAGO_WEBHOOK_SECRET=...

# Caddy (local HTTPS)
CADDY_EMAIL=admin@yourtime.local
```

## Convenciones de Commit

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Scopes:** `auth`, `task`, `token`, `user`, `message`, `api`, `web`, `mobile`, `infra`

**Ejemplo:**
```
feat(task): add task creation endpoint

- Add CreateTask command handler
- Add POST /tasks endpoint
- Add validation for budget ranges

Closes #123
```

## CI/CD

GitHub Actions ejecuta en cada PR:
1. **Lint & Format** (ESLint, Prettier, golangci-lint)
2. **TypeCheck** (TypeScript, Go vet)
3. **Tests** (Unit + Integration + Coverage)
4. **Build** (Go, Angular, Expo)
5. **Docker Build** (en merge a main)

## Licencia

MIT
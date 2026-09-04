# YourTime - Tech Stack Definido

## Backend (Go)
| Componente | Tecnología | Versión | Justificación |
|------------|------------|---------|---------------|
| Runtime | Go | 1.23+ | LTS, performance, simplicidad |
| Framework HTTP | Chi | v5 | Ligero, middleware compatible, stdlib-friendly |
| ORM | SQLC + pgx | Latest | Type-safe SQL, performance, sin magic |
| Migraciones | Goose | v3 | SQL puro, versionado, CLI simple |
| Auth | JWT (golang-jwt) + bcrypt | Latest | Stateless, estándar, seguro |
| Validación | Validator (go-playground) | v10 | Tags en structs, extensible |
| Config | Viper | v1 | Multi-source (env, yaml, flags) |
| Logs | Zerolog | v1 | Zero-allocation, JSON, structured |
| Tests | Testify + Go built-in | Latest | Assertions, mocks, benchmarks |
| Docs API | Swaggo | v1 | OpenAPI 3.0 auto-generado |

## Frontend Web (Angular)
| Componente | Tecnología | Versión | Justificación |
|------------|------------|---------|---------------|
| Framework | Angular | 19+ | Signals, standalone, zoneless |
| Language | TypeScript | 5.6+ | Type safety, DX |
| UI Library | Angular Material | 19+ | Accesible, theming, componentes completos |
| State | Signals + RxJS | Built-in | Reactividad fina, sin librería extra |
| Forms | Reactive Forms | Built-in | Validación robusta, tipado |
| HTTP | HttpClient (interceptors) | Built-in | Interceptors, typing, testing |
| Testing | Vitest + Testing Library | Latest | Fast, Jest-compatible, component testing |
| Build | Vite (angular-builder) | Latest | Fast HMR, optimized builds |
| Lint/Format | ESLint + Prettier | Latest | Estándar industria |

## Mobile (React Native)
| Componente | Tecnología | Versión | Justificación |
|------------|------------|---------|---------------|
| Framework | React Native | 0.76+ | Nuevo architecture, performance |
| Language | TypeScript | 5.6+ | Shared types con Angular |
| Navigation | Expo Router | v4 | File-based, deep linking, type-safe |
| UI | NativeWind (Tailwind) | v4 | Shared styles web/mobile, utility-first |
| State | Zustand + React Query | Latest | Simple global + server state |
| Forms | React Hook Forms + Zod | Latest | Performant, schema validation |
| Auth | Expo SecureStore + JWT | Latest | Secure storage, biometrics |
| Build | EAS Build | Latest | Cloud builds, OTA updates |
| Testing | Vitest + React Native Testing Library | Latest | Consistent con web |

## Shared (Monorepo)
| Herramienta | Uso |
|-------------|-----|
| Nx / Turborepo | Monorepo management, caching, affected |
| TypeScript Project References | Shared types, API contracts |
| pnpm | Workspaces, fast installs, disk efficient |

## Infraestructura Local (MVP)
| Servicio | Tecnología | Config |
|----------|------------|--------|
| DB | PostgreSQL | Docker Compose |
| Cache/Queue | Redis | Docker Compose |
| Object Storage | MinIO | Docker Compose (S3-compatible) |
| Mail | Mailpit | Docker Compose (testing) |
| Reverse Proxy | Caddy | Local HTTPS auto |

## Cloud-Ready (Futuro)
| Proveedor | Servicios Recomendados |
|-----------|------------------------|
| **GCP** (Recomendado Go) | Cloud Run, Cloud SQL, Cloud Storage, Secret Manager, Artifact Registry |
| **AWS** | ECS Fargate, RDS, S3, Parameter Store, ECR |
| **Fly.io** | Simplicidad, Postgres incluido, edge global |
| **Railway/Render** | Más simple, buen DX para startups |

## CI/CD
| Stage | Herramienta |
|-------|-------------|
| CI | GitHub Actions (matrix: Go, Angular, RN) |
| CD Local | Docker Compose + Make/Taskfile |
| CD Cloud | GitHub Actions -> Cloud Provider |
| Quality Gates | golangci-lint, ESLint, TypeScript, Tests, Coverage |
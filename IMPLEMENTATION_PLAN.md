# YourTime - Plan de Implementación Completo

> **Versión:** 1.0  
> **Fecha:** 2026-01-15  
> **Estado:** Planificación - Listo para iniciar desarrollo

---

## Resumen Ejecutivo

YourTime es un marketplace de servicios locales donde usuarios solicitan y ofrecen tiempo/habilidades, usando un sistema de tokens internos que se pueden convertir a dinero real. Este documento consolida toda la arquitectura, decisiones técnicas y plan de ejecución para llevar el MVP a producción.

**Stack Principal:**
- **Backend:** Go 1.23 + Chi + SQLC + PostgreSQL
- **Web:** Angular 19 + Signals + Material + Vite
- **Mobile:** React Native 0.76 + Expo Router + NativeWind
- **Infra:** Docker Compose (local) → Cloud Run / GCP (prod)

**Arquitectura:** Clean Architecture + DDD + Monorepo (pnpm + Turborepo)

---

## Documentos de Referencia

| Documento | Descripción |
|-----------|-------------|
| `TECH_STACK.md` | Stack tecnológico detallado con versiones y justificaciones |
| `DATA_MODEL.md` | Modelo de datos completo (SQL, ERD, migraciones) |
| `API_CONTRACTS.md` | Contratos REST completos (endpoints, schemas, WS) |
| `PROJECT_STRUCTURE.md` | Estructura de carpetas, scaffolding, Docker, Makefile |
| `CLEAN_CODE_STANDARDS.md` | Estándares de código, arquitectura, code review |
| `TOKEN_ECONOMY.md` | Sistema de tokens, flujos, comisiones, seguridad |
| `INFRASTRUCTURE_PLAN.md` | Infra local + cloud-ready, CI/CD, observabilidad |

---

## Fases de Implementación

### FASE 0: Foundation (Semana 1)
**Objetivo:** Monorepo funcionando, infra local, CI/CD básico

| Tarea | Detalle | Done |
|-------|---------|------|
| 0.1 | Inicializar monorepo con pnpm + Turborepo | ☐ |
| 0.2 | Configurar `packages/shared-types` + `shared-utils` | ☐ |
| 0.3 | Scaffold Go backend (Clean Architecture structure) | ☐ |
| 0.4 | Scaffold Angular web (standalone, signals, Material) | ☐ |
| 0.5 | Scaffold React Native mobile (Expo Router, NativeWind) | ☐ |
| 0.6 | Docker Compose completo (Postgres, Redis, MinIO, Mailpit, Caddy) | ☐ |
| 0.7 | Makefile raíz + Makefile backend | ☐ |
| 0.8 | GitHub Actions CI (lint, typecheck, test, build) | ☐ |
| 0.9 | Pre-commit hooks (husky + lint-staged) | ☐ |
| 0.10 | Documentación de onboarding (README, CONTRIBUTING) | ☐ |

**Entregable:** `make dev` levanta todo el stack local con hot reload.

---

### FASE 1: Core Domain - Auth & Users (Semana 2-3)
**Objetivo:** Registro, login, JWT, perfiles, roles

#### Backend
| Tarea | Detalle |
|-------|---------|
| 1.1 | Domain: `User` entity, `UserRepository` interface, value objects (Email, Phone, Password) |
| 1.2 | Infrastructure: Postgres repository (SQLC), migrations, bcrypt, JWT |
| 1.3 | Application: Commands (Register, Login, Refresh, Logout, Forgot/Reset Password) |
| 1.4 | Application: Queries (GetMe, GetProfile) |
| 1.5 | HTTP: Handlers, middleware auth, validation, rate limiting |
| 1.6 | Tests: Unit (domain services), Integration (handlers + DB) |

#### Frontend Web
| Tarea | Detalle |
|-------|---------|
| 1.7 | Auth store (signals), interceptors (token, refresh, error) |
| 1.8 | Pages: Login, Register, Forgot/Reset Password |
| 1.9 | Guards: AuthGuard, GuestGuard, RoleGuard |
| 1.10 | Profile page (view/edit), avatar upload |

#### Mobile
| Tarea | Detalle |
|-------|---------|
| 1.11 | Auth store (Zustand + SecureStore), biometric auth |
| 1.12 | Screens: Login, Register, Forgot/Reset Password |
| 1.13 | Persistent session, auto-refresh token |

**Entregable:** Usuario puede registrarse, logearse, ver/editar perfil en web y mobile.

---

### FASE 2: Core Domain - Tasks & Applications (Semana 4-6)
**Objetivo:** CRUD tasks, búsqueda, postulaciones, matching

#### Backend
| Tarea | Detalle |
|-------|---------|
| 2.1 | Domain: `Task`, `TaskApplication`, `Category`, `Skill` entities + repositories |
| 2.2 | Domain: Task status machine (open → in_progress → completed/cancelled/disputed) |
| 2.3 | Application: Commands (CreateTask, UpdateTask, CancelTask, Apply, Accept/Reject, Start, Complete, Dispute) |
| 2.4 | Application: Queries (ListTasks con filtros geo/presupuesto/fecha, GetTask, GetApplications) |
| 2.4 | Events: Domain events (TaskCreated, ApplicationAccepted, TaskCompleted) para notificaciones |
| 2.5 | Search: Postgres con índices geoespaciales (lat/lng), full-text search básico |
| 2.6 | Tests: Unit (domain logic), Integration (flujos completos) |

#### Frontend Web
| Tarea | Detalle |
|-------|---------|
| 2.7 | Task store (signals), filters reactivos |
| 2.8 | Pages: TaskList (mapa + lista + filtros), TaskDetail, CreateTask, EditTask, MyTasks |
| 2.9 | Components: TaskCard, TaskFilter, TaskMap, ApplicationForm, ApplicationCard |
| 2.10 | Image upload (drag-drop, preview, compresión client-side) |

#### Mobile
| Tarea | Detalle |
|-------|---------|
| 2.11 | Task store (Zustand), hooks useTasks, useApplications |
| 2.12 | Screens: TaskList (infinite scroll + pull-to-refresh), TaskDetail, CreateTask, MyTasks |
| 2.13 | Camera/Gallery picker para imágenes, location picker (mapa) |
| 2.14 | Push notifications (Expo) para nuevas postulaciones, task updates |

**Entregable:** Flujo completo: Cliente crea task → Workers aplican → Cliente acepta → Worker completa.

---

### FASE 3: Token Economy (Semana 7-8)
**Objetivo:** Compra, hold/escrow, pago a worker, retiro a dinero real

#### Backend
| Tarea | Detalle |
|-------|---------|
| 3.1 | Domain: `TokenBalance`, `TokenTransaction`, `TokenPurchase`, `TokenWithdrawal` entities |
| 3.2 | Domain: `TokenService` (exchange rates, fees, validation rules) |
| 3.3 | Infrastructure: Ledger inmutable (TokenTransaction append-only), balance updates atómicos |
| 3.4 | Payments: Stripe integration (PaymentIntent, webhooks, refunds) |
| 3.5 | Payments: MercadoPago integration (preference, webhooks) |
| 3.6 | Withdrawal: Request → Admin approval → Payout (bank transfer / PayPal / MP) |
| 3.7 | Platform config: Exchange rates, fees, packages, limits (en DB, admin-editable) |
| 3.8 | Webhooks: Idempotency, signature verification, retry logic |
| 3.9 | Reconciliación: cron diario que valida `sum(available)+sum(pending) == total emitido - total quemado` y alerta ante drift |
| 3.10 | Tests: Unit (cálculos, edge cases), Integration (flujos compra/pago/retiro) |

#### Frontend Web + Mobile
| Tarea | Detalle |
|-------|---------|
| 3.11 | Token store (balance, transactions, packages) |
| 3.12 | Pages: Balance, BuyTokens (paquetes + Stripe/MP checkout), TransactionHistory |
| 3.13 | Withdrawal flow: Form (bank details encrypted), status tracking |
| 3.14 | Task flow integration: Show hold on accept, payment on complete |

**Entregable:** Usuario compra tokens → Crea task (hold) → Worker completa → Recibe tokens → Retira a banco.

---

### FASE 4: Communication & Notifications (Semana 9)
**Objetivo:** Chat en tasks, notificaciones push/email

| Tarea | Detalle |
|-------|---------|
| 4.1 | Domain: `Conversation`, `Message`, `Notification` entities |
| 4.2 | WebSocket: Gorilla/WS en backend, conexión autenticada, rooms por conversation |
| 4.3 | Real-time: New message, typing indicators, read receipts, task status updates |
| 4.4 | Push: Expo push service (mobile), Service Worker (web PWA) |
| 4.5 | Email: Templates (welcome, task updates, payment receipts, withdrawal status) |
| 4.6 | Frontend: Chat component (virtualized list, optimistic sends, images) |
| 4.7 | Notification bell + center (web), push handling (mobile) |

---

### FASE 5: Reviews, Admin & Polish (Semana 10)
**Objetivo:** Sistema de reputación, panel admin, UX final

| Tarea | Detalle |
|-------|---------|
| 5.1 | Domain: `Review` entity, rating criteria (quality, communication, punctuality) |
| 5.2 | Review flow: Post-completion prompt, double-blind hasta ambos reseñan |
| 5.3 | Admin panel: Users, Tasks, Withdrawals (approve/reject), Disputes, Config |
| 5.4 | Dispute flow: Evidencia, mediación, resolución admin |
| 5.5 | Referral system: Invite code, bonus tokens both sides |
| 5.6 | PWA: Service Worker, offline support, install prompt |
| 5.7 | Mobile: EAS Build config, App Store / Play Store preparation |
| 5.8 | Performance: Bundle analysis, lazy loading, image optimization |
| 5.9 | Accessibility: WCAG 2.1 AA, screen readers, keyboard nav |

---

### FASE 6: Production Hardening (Semana 11-12)
**Objetivo:** Producción-ready, monitoring, docs

| Tarea | Detalle |
|-------|---------|
| 6.1 | Load testing (k6): 1000 concurrent users, API p99 < 500ms |
| 6.2 | Security audit: OWASP Top 10, dependency scanning, pen test básico |
| 6.3 | Chaos engineering: DB failover, Redis failover, pod kills |
| 6.4 | Runbooks: Incident response, deployment rollback, data recovery |
| 6.5 | Documentation: API docs (Swagger UI), Architecture decision records (ADRs) |
| 6.6 | Backup/Restore drill: Point-in-time recovery test |
| 6.7 | Cost optimization: Right-sizing, reserved instances, CDN caching |
| 6.8 | Launch checklist sign-off |

---

## Estimación de Esfuerzo

| Fase | Semanas | Complejidad | Riesgo |
|------|---------|-------------|--------|
| 0: Foundation | 1 | Media | Bajo |
| 1: Auth & Users | 2 | Media | Bajo |
| 2: Tasks & Apps | 3 | **Alta** | Medio |
| 3: Token Economy | 2 | **Alta** | **Alto** |
| 4: Chat & Notifs | 1 | Media | Medio |
| 5: Reviews & Admin | 1 | Media | Bajo |
| 6: Prod Hardening | 2 | Media | Medio |
| **TOTAL** | **~12** | | |

**Buffer recomendado:** +30% (≈ 16 semanas / 4 meses)

---

## Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| Complejidad token economy (edge cases, concurrency) | Alta | Alto | Tests exhaustivos, property-based testing, revisión de código en pares |
| Integración pagos (Stripe/MP webhooks, idempotencia) | Media | Alto | Sandbox exhaustivo, webhooks idempotentes, monitoring alertas |
| Performance geo-search en Postgres | Media | Medio | Índices GiST, paginación cursor, caching Redis |
| WebSocket scaling (mobile + web) | Media | Medio | Redis pub/sub, sticky sessions o stateless design |
| App Store / Play Store review | Baja | Alto | Guidelines checklist, TestFlight/Internal testing previo |
| Regulatorio (tokens ↔ dinero, KYC, ¿licencia money transmitter?) | Media | **Alto** | Ver "Marco Legal / Regulatorio" en `TOKEN_ECONOMY.md`: revisión legal antes de FASE 3, usar Stripe Connect/MercadoPago Marketplace como PSP licenciado en vez de mover dinero propio, KYC obligatorio pre-retiro |

---

## Métricas de Éxito (MVP)

| Métrica | Target Lanzamiento | Target 3 Meses |
|---------|-------------------|----------------|
| Usuarios registrados | 100 | 1,000 |
| Tasks creadas | 50 | 500 |
| Tasks completadas | 30 | 300 |
| Transacciones tokens | 100 | 2,000 |
| Retención D7 | > 20% | > 30% |
| NPS | > 30 | > 40 |
| Uptime | 99.5% | 99.9% |
| API p99 latency | < 500ms | < 300ms |

---

## Próximos Pasos Inmediatos

1. **Clonar este plan** y crear issues en GitHub por cada tarea
2. **Ejecutar FASE 0** completo (monorepo + infra + CI)
3. **Daily standups** 15min, sprints de 2 semanas
4. **Code review obligatorio** en todos los PRs
5. **Demo semanal** de funcionalidad integrada

---

## Arquitectura de Decisiones Clave (ADRs)

| ADR | Decisión | Alternativas Consideradas |
|-----|----------|---------------------------|
| ADR-001 | Monorepo (pnpm + Turborepo) | Multi-repo, Nx |
| ADR-002 | Clean Architecture + DDD en Go | Layered, Hexagonal puro |
| ADR-003 | SQLC para DB access (no ORM) | GORM, Ent, raw SQL |
| ADR-004 | Chi router (stdlib-compatible) | Gin, Echo, Fiber |
| ADR-005 | Angular standalone + signals | NgRx, Redux, React |
| ADR-006 | React Native + Expo Router | Flutter, Native, PWA-only |
| ADR-007 | Tokens internos (no crypto) | Stablecoin, direct $ |
| ADR-008 | Escrow/hold pattern para pagos | Direct charge, split payments |
| ADR-009 | Docker Compose local + Cloud Run prod | Kubernetes, VMs, Serverless Framework |

---

## Contactos y Recursos

- **Repo:** `github.com/tuusuario/yourtime`
- **Docs:** `/docs` en repo + Swagger UI en `/api/docs`
- **CI:** GitHub Actions → `Actions` tab
- **Staging:** `https://staging.yourtime.app` (tras FASE 3)
- **Producción:** `https://yourtime.app` (tras FASE 6)

---

*Documento vivo - Actualizar en cada sprint review*
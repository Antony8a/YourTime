# YourTime - Estructura del Proyecto (Monorepo)

## Visión General

```
yourtime/
├── .github/
│   └── workflows/           # CI/CD pipelines
├── .vscode/                 # Config VS Code compartida
├── docs/                    # Documentación arquitectural
│   ├── architecture.md
│   ├── api-contracts.md
│   ├── data-model.md
│   ├── tech-stack.md
│   └── implementation-plan.md
├── tools/                   # Scripts y utilidades de build
│   ├── go-generate.sh
│   ├── sqlc.yaml
│   └── swagger.yaml
├── packages/                # Paquetes compartidos (Nx/Turborepo)
│   ├── shared-types/        # TypeScript types compartidos (API contracts)
│   ├── shared-utils/        # Utilidades puras (validation, formatting, dates)
│   ├── ui-components/       # Componentes Angular compartidos (opcional)
│   └── eslint-config/       # Config ESLint compartida
├── apps/
│   ├── backend/             # Go API Server
│   ├── web/                 # Angular Web App
│   └── mobile/              # React Native (Expo) App
├── infra/                   # Infraestructura as Code
│   ├── docker/
│   │   ├── docker-compose.yml
│   │   ├── docker-compose.prod.yml
│   │   ├── Dockerfile.backend
│   │   ├── Dockerfile.web
│   │   └── .env.example
│   ├── kubernetes/          # Para futuro (Helm charts)
│   └── terraform/           # Para futuro (GCP/AWS)
├── Makefile                 # Comandos unificados
├── pnpm-workspace.yaml      # pnpm workspaces config
├── turbo.json               # Turborepo config (o nx.json)
├── package.json             # Root package.json (scripts, devDeps)
├── go.work                  # Go workspace (multi-module)
├── .golangci.yml            # Go linter config
├── .eslintrc.js             # Root ESLint config
├── .prettierrc              # Prettier config
├── .editorconfig            # Editor config
└── README.md
```

---

## Backend (Go) - `apps/backend/`

```
apps/backend/
├── cmd/
│   └── server/              # Entry point
│       ├── main.go
│       ├── wire.go          # Wire dependency injection
│       └── wire_gen.go
├── internal/                # Private application code
│   ├── config/              # Config loading (Viper)
│   │   ├── config.go
│   │   └── config_test.go
│   ├── domain/              # Domain layer (Clean Architecture)
│   │   ├── user/
│   │   │   ├── entity.go
│   │   │   ├── repository.go      # Interface
│   │   │   ├── service.go         # Domain service
│   │   │   └── errors.go
│   │   ├── task/
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   ├── service.go
│   │   │   ├── events.go          # Domain events
│   │   │   └── errors.go
│   │   ├── token/
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   ├── service.go
│   │   │   ├── exchange.go        # Exchange rate logic
│   │   │   └── errors.go
│   │   ├── application/
│   │   │   ├── entity.go
│   │   │   ├── repository.go
│   │   │   └── service.go
│   │   ├── review/
│   │   ├── message/
│   │   ├── notification/
│   │   ├── category/
│   │   └── common/
│   │       ├── valueobjects/      # Email, Phone, Money, Tokens, Coordinates
│   │       ├── events/            # Event definitions
│   │       └── errors/            # Domain errors
│   ├── application/         # Use cases / Application services
│   │   ├── auth/
│   │   │   ├── command/
│   │   │   │   ├── register.go
│   │   │   │   ├── login.go
│   │   │   │   ├── refresh_token.go
│   │   │   │   ├── logout.go
│   │   │   │   ├── forgot_password.go
│   │   │   │   └── reset_password.go
│   │   │   ├── query/
│   │   │   │   └── get_me.go
│   │   │   ├── dto.go
│   │   │   └── validator.go
│   │   ├── user/
│   │   │   ├── command/
│   │   │   │   ├── update_profile.go
│   │   │   │   └── update_location.go
│   │   │   ├── query/
│   │   │   │   ├── get_profile.go
│   │   │   │   └── get_reviews.go
│   │   │   └── dto.go
│   │   ├── task/
│   │   │   ├── command/
│   │   │   │   ├── create_task.go
│   │   │   │   ├── update_task.go
│   │   │   │   ├── cancel_task.go
│   │   │   │   ├── apply_to_task.go
│   │   │   │   ├── accept_application.go
│   │   │   │   ├── reject_application.go
│   │   │   │   ├── start_task.go
│   │   │   │   ├── complete_task.go
│   │   │   │   └── dispute_task.go
│   │   │   ├── query/
│   │   │   │   ├── list_tasks.go
│   │   │   │   ├── get_task.go
│   │   │   │   └── get_applications.go
│   │   │   └── dto.go
│   │   ├── token/
│   │   │   ├── command/
│   │   │   │   ├── purchase_tokens.go
│   │   │   │   ├── process_payment_webhook.go
│   │   │   │   ├── request_withdrawal.go
│   │   │   │   └── process_withdrawal.go
│   │   │   ├── query/
│   │   │   │   ├── get_balance.go
│   │   │   │   ├── list_transactions.go
│   │   │   │   ├── get_packages.go
│   │   │   │   ├── get_exchange_rate.go
│   │   │   │   └── list_withdrawals.go
│   │   │   └── dto.go
│   │   ├── message/
│   │   │   ├── command/
│   │   │   │   └── send_message.go
│   │   │   ├── query/
│   │   │   │   ├── list_conversations.go
│   │   │   │   └── list_messages.go
│   │   │   └── dto.go
│   │   ├── notification/
│   │   │   ├── query/
│   │   │   │   └── list_notifications.go
│   │   │   └── command/
│   │   │       └── mark_read.go
│   │   └── common/
│   │       ├── handler.go         # Base command/query handler
│   │       ├── validator.go       # Validation helpers
│   │       └── pagination.go
│   ├── infrastructure/      # Infrastructure layer
│   │   ├── persistence/
│   │   │   ├── postgres/
│   │   │   │   ├── repository/
│   │   │   │   │   ├── user_repo.go
│   │   │   │   │   ├── task_repo.go
│   │   │   │   │   ├── token_repo.go
│   │   │   │   │   ├── application_repo.go
│   │   │   │   │   ├── review_repo.go
│   │   │   │   │   ├── message_repo.go
│   │   │   │   │   └── notification_repo.go
│   │   │   │   ├── sqlc/              # Generated by SQLC
│   │   │   │   │   ├── models.go
│   │   │   │   │   ├── querier.go
│   │   │   │   │   └── *.sql.go
│   │   │   │   ├── migrations/        # Goose migrations
│   │   │   │   │   └── *.sql
│   │   │   │   ├── db.go              # Connection pool
│   │   │   │   └── tx.go              # Transaction helper
│   │   │   └── redis/
│   │   │       ├── cache.go
│   │   │       ├── session.go
│   │   │       └── rate_limiter.go
│   │   ├── auth/
│   │   │   ├── jwt.go
│   │   │   ├── password.go
│   │   │   └── middleware.go
│   │   ├── http/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.go
│   │   │   │   ├── cors.go
│   │   │   │   ├── logging.go
│   │   │   │   ├── rate_limit.go
│   │   │   │   ├── recovery.go
│   │   │   │   └── validation.go
│   │   │   ├── handlers/
│   │   │   │   ├── auth_handler.go
│   │   │   │   ├── user_handler.go
│   │   │   │   ├── task_handler.go
│   │   │   │   ├── token_handler.go
│   │   │   │   ├── message_handler.go
│   │   │   │   └── notification_handler.go
│   │   │   ├── router.go
│   │   │   ├── response.go
│   │   │   └── docs/                  # Swagger annotations
│   │   │       └── docs.go
│   │   ├── external/
│   │   │   ├── payments/
│   │   │   │   ├── stripe.go
│   │   │   │   ├── mercadopago.go
│   │   │   │   └── interface.go
│   │   │   ├── email/
│   │   │   │   ├── sendgrid.go
│   │   │   │   └── interface.go
│   │   │   ├── storage/
│   │   │   │   ├── minio.go
│   │   │   │   └── interface.go
│   │   │   └── push/
│   │   │       ├── expo.go
│   │   │       └── interface.go
│   │   └── websocket/
│   │       ├── hub.go
│   │       ├── client.go
│   │       └── handlers.go
│   └── platform/            # Cross-cutting concerns
│       ├── logger/
│       │   └── zerolog.go
│       ├── metrics/
│       │   └── prometheus.go
│       ├── tracing/
│       │   └── otel.go
│       └── validator/
│           └── custom.go
├── pkg/                     # Public packages (reutilizables)
│   ├── errors/              # Error types wrapper
│   ├── pagination/          # Cursor pagination helpers
│   └── sanitzer/            # Input sanitization
├── api/                     # OpenAPI/Swagger specs
│   └── openapi.yaml
├── scripts/
│   ├── migrate.go           # Migration runner
│   ├── seed.go              # Data seeding
│   └── generate.go          # Code generation (sqlc, wire, mocks)
├── test/
│   ├── fixtures/            # Test data
│   ├── helpers/             # Test utilities
│   └── integration/         # Integration tests
├── go.mod
├── go.sum
├── Makefile
├── Dockerfile
├── .air.toml                # Hot reload config
├── .golangci.yml
└── README.md
```

---

## Frontend Web (Angular) - `apps/web/`

```
apps/web/
├── src/
│   ├── app/
│   │   ├── core/                    # Singleton services, guards, interceptors
│   │   │   ├── auth/
│   │   │   │   ├── services/
│   │   │   │   │   ├── auth.service.ts
│   │   │   │   │   ├── token.service.ts
│   │   │   │   │   └── refresh-token.interceptor.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── auth.guard.ts
│   │   │   │   │   ├── guest.guard.ts
│   │   │   │   │   └── role.guard.ts
│   │   │   │   ├── models/
│   │   │   │   │   └── user.model.ts
│   │   │   │   └── auth.routes.ts
│   │   │   ├── http/
│   │   │   │   ├── interceptors/
│   │   │   │   │   ├── api-prefix.interceptor.ts
│   │   │   │   │   ├── error-handler.interceptor.ts
│   │   │   │   │   ├── loading.interceptor.ts
│   │   │   │   │   └── retry.interceptor.ts
│   │   │   │   └── api-client.ts
│   │   │   ├── config/
│   │   │   │   └── environment.ts
│   │   │   ├── utils/
│   │   │   │   ├── date.utils.ts
│   │   │   │   ├── currency.utils.ts
│   │   │   │   ├── validation.utils.ts
│   │   │   │   └── storage.utils.ts
│   │   │   └── core.module.ts
│   │   ├── shared/                  # Shared components, pipes, directives
│   │   │   ├── components/
│   │   │   │   ├── ui/              # Atomic UI components
│   │   │   │   │   ├── button/
│   │   │   │   │   ├── input/
│   │   │   │   │   ├── select/
│   │   │   │   │   ├── card/
│   │   │   │   │   ├── modal/
│   │   │   │   │   ├── avatar/
│   │   │   │   │   ├── badge/
│   │   │   │   │   ├── spinner/
│   │   │   │   │   ├── tooltip/
│   │   │   │   │   └── index.ts
│   │   │   │   ├── layout/
│   │   │   │   │   ├── header/
│   │   │   │   │   ├── footer/
│   │   │   │   │   ├── sidebar/
│   │   │   │   │   └── page-container/
│   │   │   │   ├── feedback/
│   │   │   │   │   ├── toast/
│   │   │   │   │   ├── snackbar/
│   │   │   │   │   ├── alert/
│   │   │   │   │   └── empty-state/
│   │   │   │   └── forms/
│   │   │   │       ├── form-field/
│   │   │   │       ├── file-upload/
│   │   │   │       ├── image-picker/
│   │   │   │       └── rating-input/
│   │   │   ├── pipes/
│   │   │   │   ├── currency.pipe.ts
│   │   │   │   ├── tokens.pipe.ts
│   │   │   │   ├── relative-time.pipe.ts
│   │   │   │   ├── truncate.pipe.ts
│   │   │   │   └── safe-url.pipe.ts
│   │   │   ├── directives/
│   │   │   │   ├── click-outside.directive.ts
│   │   │   │   ├── focus-trap.directive.ts
│   │   │   │   └── auto-focus.directive.ts
│   │   │   ├── validators/
│   │   │   │   ├── custom-validators.ts
│   │   │   │   └── async-validators.ts
│   │   │   └── shared.module.ts
│   │   ├── features/                # Feature modules (lazy loaded)
│   │   │   ├── auth/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── login/
│   │   │   │   │   ├── register/
│   │   │   │   │   ├── forgot-password/
│   │   │   │   │   └── reset-password/
│   │   │   │   ├── components/
│   │   │   │   └── auth.routes.ts
│   │   │   ├── tasks/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── task-list/
│   │   │   │   │   ├── task-detail/
│   │   │   │   │   ├── create-task/
│   │   │   │   │   ├── edit-task/
│   │   │   │   │   ├── my-tasks/
│   │   │   │   │   └── task-applications/
│   │   │   │   ├── components/
│   │   │   │   │   ├── task-card/
│   │   │   │   │   ├── task-filter/
│   │   │   │   │   ├── task-map/
│   │   │   │   │   ├── application-card/
│   │   │   │   │   └── application-form/
│   │   │   │   ├── services/
│   │   │   │   │   ├── task.service.ts
│   │   │   │   │   └── application.service.ts
│   │   │   │   ├── store/           # Signals-based state
│   │   │   │   │   ├── task-store.ts
│   │   │   │   │   └── application-store.ts
│   │   │   │   └── tasks.routes.ts
│   │   │   ├── tokens/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── token-balance/
│   │   │   │   │   ├── buy-tokens/
│   │   │   │   │   ├── transaction-history/
│   │   │   │   │   └── withdraw-tokens/
│   │   │   │   ├── components/
│   │   │   │   │   ├── token-balance-card/
│   │   │   │   │   ├── token-package-card/
│   │   │   │   │   ├── withdrawal-form/
│   │   │   │   │   └── transaction-list/
│   │   │   │   ├── services/
│   │   │   │   │   └── token.service.ts
│   │   │   │   ├── store/
│   │   │   │   │   └── token-store.ts
│   │   │   │   └── tokens.routes.ts
│   │   │   ├── profile/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── view-profile/
│   │   │   │   │   ├── edit-profile/
│   │   │   │   │   └── my-reviews/
│   │   │   │   ├── components/
│   │   │   │   │   ├── profile-header/
│   │   │   │   │   ├── skill-tags/
│   │   │   │   │   ├── rating-display/
│   │   │   │   │   └── portfolio-gallery/
│   │   │   │   ├── services/
│   │   │   │   │   └── profile.service.ts
│   │   │   │   └── profile.routes.ts
│   │   │   ├── messages/
│   │   │   │   ├── pages/
│   │   │   │   │   ├── conversation-list/
│   │   │   │   │   └── conversation-detail/
│   │   │   │   ├── components/
│   │   │   │   │   ├── message-list/
│   │   │   │   │   ├── message-input/
│   │   │   │   │   └── conversation-item/
│   │   │   │   ├── services/
│   │   │   │   │   ├── message.service.ts
│   │   │   │   │   └── websocket.service.ts
│   │   │   │   ├── store/
│   │   │   │   │   └── message-store.ts
│   │   │   │   └── messages.routes.ts
│   │   │   ├── notifications/
│   │   │   │   ├── components/
│   │   │   │   │   ├── notification-bell/
│   │   │   │   │   ├── notification-dropdown/
│   │   │   │   │   └── notification-list/
│   │   │   │   ├── services/
│   │   │   │   │   └── notification.service.ts
│   │   │   │   └── store/
│   │   │   │       └── notification-store.ts
│   │   │   ├── categories/
│   │   │   │   ├── services/
│   │   │   │   │   └── category.service.ts
│   │   │   │   └── store/
│   │   │   │       └── category-store.ts
│   │   │   └── admin/               # Panel de administración
│   │   │       ├── pages/
│   │   │       │   ├── dashboard/
│   │   │       │   ├── users/
│   │   │       │   ├── tasks/
│   │   │       │   ├── withdrawals/
│   │   │       │   └── disputes/
│   │   │       └── admin.routes.ts
│   │   ├── layout/
│   │   │   ├── main-layout/
│   │   │   │   ├── main-layout.component.ts
│   │   │   │   └── main-layout.component.html
│   │   │   ├── auth-layout/
│   │   │   └── empty-layout/
│   │   ├── app.routes.ts
│   │   ├── app.config.ts
│   │   └── app.component.ts
│   ├── environments/
│   │   ├── environment.ts
│   │   ├── environment.development.ts
│   │   └── environment.production.ts
│   ├── styles/
│   │   ├── _variables.scss
│   │   ├── _mixins.scss
│   │   ├── _reset.scss
│   │   ├── _typography.scss
│   │   ├── _theme.scss
│   │   ├── globals.scss
│   │   └── material-theme.scss
│   ├── assets/
│   │   ├── images/
│   │   ├── icons/
│   │   └── fonts/
│   ├── main.ts
│   └── index.html
├── public/
├── angular.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.spec.json
├── vite.config.ts
├── package.json
├── .eslintrc.json
├── .prettierrc
├── karma.conf.ts
├── Dockerfile
├── .dockerignore
└── README.md
```

---

## Mobile (React Native + Expo) - `apps/mobile/`

```
apps/mobile/
├── app/                       # Expo Router (file-based routing)
│   ├── _layout.tsx            # Root layout
│   ├── (auth)/                # Auth group
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   ├── forgot-password.tsx
│   │   └── reset-password.tsx
│   ├── (app)/                 # Main app group (requires auth)
│   │   ├── _layout.tsx        # Tab layout
│   │   ├── index.tsx          # Home / Task feed
│   │   ├── tasks/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx      # Task list with filters
│   │   │   ├── [id].tsx       # Task detail
│   │   │   ├── create.tsx
│   │   │   ├── edit.tsx
│   │   │   ├── my-tasks.tsx
│   │   │   └── applications.tsx
│   │   ├── tokens/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx      # Balance
│   │   │   ├── buy.tsx
│   │   │   ├── history.tsx
│   │   │   └── withdraw.tsx
│   │   ├── messages/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx      # Conversation list
│   │   │   └── [id].tsx       # Chat detail
│   │   ├── profile/
│   │   │   ├── _layout.tsx
│   │   │   ├── index.tsx      # My profile
│   │   │   ├── edit.tsx
│   │   │   ├── [id].tsx       # Other user profile
│   │   │   └── reviews.tsx
│   │   └── notifications/
│   │       └── index.tsx
│   ├── (modal)/               # Modal routes
│   │   ├── _layout.tsx
│   │   ├── task-filter.tsx
│   │   ├── application-form.tsx
│   │   └── image-picker.tsx
│   └── +not-found.tsx
├── src/
│   ├── components/
│   │   ├── ui/                # Atomic components (NativeWind)
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Select.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Badge.tsx
│   │   │   ├── Spinner.tsx
│   │   │   ├── Rating.tsx
│   │   │   └── index.ts
│   │   ├── forms/
│   │   │   ├── FormField.tsx
│   │   │   ├── FileUpload.tsx
│   │   │   └── ImagePicker.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   ├── TabBar.tsx
│   │   │   ├── PageContainer.tsx
│   │   │   └── SafeAreaView.tsx
│   │   ├── feedback/
│   │   │   ├── Toast.tsx
│   │   │   ├── Alert.tsx
│   │   │   └── EmptyState.tsx
│   │   └── task/
│   │       ├── TaskCard.tsx
│   │       ├── TaskFilter.tsx
│   │       ├── ApplicationCard.tsx
│   │       └── TaskMap.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useTasks.ts
│   │   ├── useTokens.ts
│   │   ├── useMessages.ts
│   │   ├── useNotifications.ts
│   │   ├── useWebSocket.ts
│   │   ├── useImagePicker.ts
│   │   └── useLocation.ts
│   ├── services/
│   │   ├── api/
│   │   │   ├── client.ts              # Axios/Ky instance
│   │   │   ├── auth.ts
│   │   │   ├── tasks.ts
│   │   │   ├── tokens.ts
│   │   │   ├── users.ts
│   │   │   ├── messages.ts
│   │   │   └── notifications.ts
│   │   ├── auth/
│   │   │   ├── token-storage.ts       # Expo SecureStore
│   │   │   └── biometric.ts
│   │   ├── storage/
│   │   │   └── mmkv.ts                # React Native MMKV
│   │   └── push/
│   │       └── expo-push.ts
│   ├── store/                     # Zustand stores
│   │   ├── authStore.ts
│   │   ├── taskStore.ts
│   │   ├── tokenStore.ts
│   │   ├── messageStore.ts
│   │   └── notificationStore.ts
│   ├── utils/
│   │   ├── date.ts
│   │   ├── currency.ts
│   │   ├── validation.ts
│   │   ├── format.ts
│   │   └── constants.ts
│   ├── types/
│   │   ├── api.ts                 # Shared with web via packages/shared-types
│   │   ├── navigation.ts
│   │   └── models.ts
│   ├── constants/
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   └── config.ts
│   └── styles/
│       └── global.css             # NativeWind/Tailwind
├── assets/
│   ├── images/
│   ├── fonts/
│   └── icons/
├── .expo/
├── app.json                       # Expo config
├── eas.json                       # EAS Build config
├── package.json
├── tsconfig.json
├── tailwind.config.js             # NativeWind config
├── metro.config.js
├── babel.config.js
├── .eslintrc.js
├── .prettierrc
├── jest.config.js
├── Dockerfile
└── README.md
```

---

## Paquetes Compartidos - `packages/`

### `packages/shared-types/`
```
packages/shared-types/
├── src/
│   ├── api/
│   │   ├── auth.ts
│   │   ├── tasks.ts
│   │   ├── tokens.ts
│   │   ├── users.ts
│   │   ├── messages.ts
│   │   └── notifications.ts
│   ├── models/
│   │   ├── user.ts
│   │   ├── task.ts
│   │   ├── token.ts
│   │   └── common.ts
│   ├── enums/
│   │   ├── task-status.ts
│   │   ├── transaction-type.ts
│   │   └── application-status.ts
│   └── index.ts
├── package.json
├── tsconfig.json
└── README.md
```

### `packages/shared-utils/`
```
packages/shared-utils/
├── src/
│   ├── date/
│   │   ├── format.ts
│   │   ├── parse.ts
│   │   └── relative.ts
│   ├── currency/
│   │   ├── format.ts
│   │   ├── convert.ts
│   │   └── tokens.ts
│   ├── validation/
│   │   ├── email.ts
│   │   ├── phone.ts
│   │   ├── password.ts
│   │   └── schemas.ts          # Zod schemas
│   ├── string/
│   │   ├── slugify.ts
│   │   ├── truncate.ts
│   │   └── mask.ts
│   └── index.ts
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

---

## Infraestructura Local - `infra/docker/`

```
infra/docker/
├── docker-compose.yml         # Desarrollo local
├── docker-compose.prod.yml    # Producción (referencia)
├── Dockerfile.backend
├── Dockerfile.web
├── Dockerfile.mobile          # Para preview web de RN
├── .env.example
├── .env.local                 # Gitignored
├── postgres/
│   ├── init/
│   │   ├── 01-extensions.sql
│   │   ├── 02-schema.sql
│   │   └── 03-seed.sql
│   └── postgresql.conf
├── redis/
│   └── redis.conf
├── minio/
│   └── buckets.json
├── mailpit/
│   └── (sin config extra)
└── caddy/
    ├── Caddyfile
    └── Caddyfile.local
```

### `docker-compose.yml` (Resumen)
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: yourtime
      POSTGRES_USER: yourtime
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./postgres/init:/docker-entrypoint-initdb.d
    ports: ["5432:5432"]
    healthcheck: ...

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis_data:/data]
    healthcheck: ...

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    ports: ["9000:9000", "9001:9001"]
    volumes: [minio_data:/data]

  mailpit:
    image: axllent/mailpit:latest
    ports: ["1025:1025", "8025:8025"]

  caddy:
    image: caddy:2-alpine
    ports: ["80:80", "443:443", "443:443/udp"]
    volumes:
      - ./caddy/Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config

  backend:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.backend
    environment:
      - DATABASE_URL=postgres://yourtime:${DB_PASSWORD}@postgres:5432/yourtime?sslmode=disable
      - REDIS_URL=redis://redis:6379
      - MINIO_ENDPOINT=minio:9000
      - ...
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    ports: ["8080:8080"]

  web:
    build:
      context: ../..
      dockerfile: infra/docker/Dockerfile.web
    ports: ["4200:4200"]
    environment:
      - API_URL=http://localhost:8080/api/v1
    depends_on: [backend]

volumes:
  postgres_data:
  redis_data:
  minio_data:
  caddy_data:
  caddy_config:
```

---

## Root Config Files

### `pnpm-workspace.yaml`
```yaml
packages:
  - apps/*
  - packages/*
```

### `turbo.json` (o `nx.json`)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", "build/**"]
    },
    "test": {
      "outputs": ["coverage/**"],
      "dependsOn": []
    },
    "lint": {},
    "typecheck": {},
    "dev": {
      "cache": false,
      "persistent": true
    },
    "db:migrate": {},
    "db:seed": {},
    "generate": {}
  },
  "globalEnv": ["DATABASE_URL", "JWT_SECRET"]
}
```

### `Makefile` (Raíz)
```makefile
.PHONY: dev build test lint typecheck db:up db:down db:migrate db:seed generate clean

# Desarrollo
dev:
	turbo run dev --parallel

# Backend específico
dev-backend:
	cd apps/backend && air -c .air.toml

dev-web:
	cd apps/web && npm run start

dev-mobile:
	cd apps/mobile && npx expo start

# Base de datos
db:up:
	docker compose -f infra/docker/docker-compose.yml up -d

db:down:
	docker compose -f infra/docker/docker-compose.yml down -v

db:migrate:
	cd apps/backend && go run scripts/migrate.go up

db:seed:
	cd apps/backend && go run scripts/seed.go

# Generación de código
generate:
	cd apps/backend && go run scripts/generate.go
	cd packages/shared-types && npm run build

# Calidad
lint:
	turbo run lint

typecheck:
	turbo run typecheck

test:
	turbo run test

test:coverage:
	turbo run test:coverage

# Build
build:
	turbo run build

# Docker
docker:build:
	docker compose -f infra/docker/docker-compose.yml build

docker:up:
	docker compose -f infra/docker/docker-compose.yml up -d

docker:down:
	docker compose -f infra/docker/docker-compose.yml down

# Limpieza
clean:
	turbo run clean
	rm -rf node_modules apps/*/node_modules packages/*/node_modules
	docker system prune -f
```

---

## Go Workspace - `go.work`
```go
go 1.23

use (
	./apps/backend
	./tools/go-generate
)
```

---

## Variables de Entorno (`.env.example`)

```env
# App
APP_ENV=development
APP_PORT=8080
APP_URL=http://localhost:8080
WEB_URL=http://localhost:4200
MOBILE_URL=exp://localhost:8081

# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=yourtime
DB_PASSWORD=yourtime_dev
DB_NAME=yourtime
DB_SSL_MODE=disable
DATABASE_URL=postgres://yourtime:yourtime_dev@localhost:5432/yourtime?sslmode=disable

# Redis
REDIS_URL=redis://localhost:6379

# MinIO (S3-compatible)
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=yourtime
MINIO_SECRET_KEY=yourtime_dev
MINIO_BUCKET=yourtime
MINIO_USE_SSL=false

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production-min-32-chars
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=7d

# Email (Mailpit local)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=noreply@yourtime.local

# Payments (Stripe)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Payments (MercadoPago)
MERCADOPAGO_ACCESS_TOKEN=TEST-...
MERCADOPAGO_PUBLIC_KEY=TEST-...
MERCADOPAGO_WEBHOOK_SECRET=...

# Push Notifications (Expo)
EXPO_ACCESS_TOKEN=...

# Caddy (Local HTTPS)
CADDY_EMAIL=admin@yourtime.local

# Feature Flags
FEATURE_WEBSOCKETS=true
FEATURE_PUSH_NOTIFICATIONS=true
```

---

## Comandos de Inicio Rápido

```bash
# 1. Clonar e instalar
git clone <repo>
cd yourtime
pnpm install

# 2. Levantar infraestructura local
make db:up

# 3. Configurar variables de entorno
cp infra/docker/.env.example infra/docker/.env.local
# Editar .env.local con tus keys

# 4. Generar código (SQLC, Wire, mocks)
make generate

# 5. Migrar y seed DB
make db:migrate
make db:seed

# 6. Desarrollo (terminales separadas)
make dev-backend    # Puerto 8080
make dev-web        # Puerto 4200
make dev-mobile     # Expo en 8081

# 7. Ver logs
docker compose -f infra/docker/docker-compose.yml logs -f backend
```
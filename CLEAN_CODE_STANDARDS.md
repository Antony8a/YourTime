# YourTime - Clean Code Standards & Architecture Guidelines

## Arquitectura: Clean Architecture + DDD

```
┌─────────────────────────────────────────────────────────────┐
│                     INTERFACE LAYER                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │  HTTP API   │ │  WebSocket  │ │   GraphQL   │ (futuro)    │
│  │  (Chi)      │ │  (Gorilla)  │ │             │             │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼──────────────────┘
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │  Commands   │ │   Queries   │ │   Events    │             │
│  │  (Write)    │ │   (Read)    │ │  (Domain)   │             │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼──────────────────┘
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │  Entities   │ │ Value Objs  │ │Domain Events│             │
│  │  Aggregates │ │             │ │Domain Svcs  │             │
│  └──────┬──────┘ └──────┬──────┘ └──────┬──────┘             │
└─────────┼────────────────┼────────────────┼──────────────────┘
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────┐
│                 INFRASTRUCTURE LAYER                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐             │
│  │  Postgres   │ │   Redis     │ │  External   │             │
│  │  (SQLC)     │ │  (Cache)    │ │  Services   │             │
│  └─────────────┘ └─────────────┘ └─────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

### Reglas de Dependencia

| Desde | Puede depender de |
|-------|-------------------|
| Interface | Application |
| Application | Domain |
| Domain | **Nada** (solo stdlib) |
| Infrastructure | Domain (interfaces), Application (interfaces) |

---

## Estándares Go (Backend)

### 1. Nomenclatura

```go
// ✅ BUENO
type UserService interface { ... }
type userService struct { ... }          // private implementation
func NewUserService(repo UserRepository) UserService { ... }

// ❌ MALO
type UserSvc interface { ... }
type UserServiceImpl struct { ... }
func NewUserService(repo UserRepository) *UserServiceImpl { ... }
```

**Reglas:**
- Interfaces en `domain/` (público), implementaciones en `internal/`
- Sufijos: `Repository`, `Service`, `Handler`, `UseCase`, `DTO`
- Sin sufijos `Impl`, `Manager`, `Helper`, `Util`
- Paquetes: singular, minúscula (`user`, `task`, `token`)

### 2. Estructura de Archivos (por feature)

```
internal/domain/user/
├── entity.go          // User struct, métodos de dominio
├── repository.go      // interface UserRepository
├── service.go         // Domain service (lógica compleja)
├── events.go          // Domain events
├── errors.go          // Errores de dominio
├── valueobjects/
│   ├── email.go
│   ├── phone.go
│   └── password.go
└── user_test.go
```

### 3. Error Handling

```go
// Domain errors (exportados para application layer)
var (
    ErrUserNotFound     = errors.New("user not found")
    ErrEmailTaken       = errors.New("email already registered")
    ErrInvalidCredentials = errors.New("invalid credentials")
)

// Wrapping con contexto (pkg/errors)
func (s *userService) GetByID(ctx context.Context, id UUID) (*User, error) {
    user, err := s.repo.GetByID(ctx, id)
    if err != nil {
        if errors.Is(err, sql.ErrNoRows) {
            return nil, fmt.Errorf("%w: %w", ErrUserNotFound, err)
        }
        return nil, fmt.Errorf("get user: %w", err)
    }
    return user, nil
}
```

### 4. Context & Cancellation

```go
// ✅ Siempre pasar context como primer parámetro
func (s *UserService) Create(ctx context.Context, cmd CreateUserCommand) (*User, error) {
    // Usar ctx en todas las llamadas DB, HTTP, etc.
    return s.repo.Create(ctx, user)
}

// ❌ Nunca usar context.Background() en código de producción
// ❌ Nunca ignorar context cancellation
```

### 5. Dependency Injection (Wire)

```go
// cmd/server/wire.go
//go:build wireinject
// +build wireinject

func InitializeServer(cfg *config.Config) (*Server, error) {
    wire.Build(
        // Infrastructure
        postgres.NewDB,
        redis.NewClient,
        minio.NewClient,
        
        // Repositories
        user.NewRepository,
        task.NewRepository,
        token.NewRepository,
        
        // Domain Services
        user.NewService,
        task.NewService,
        token.NewService,
        
        // Application Services (Commands/Queries)
        auth.NewCommandHandlers,
        auth.NewQueryHandlers,
        user.NewCommandHandlers,
        task.NewCommandHandlers,
        token.NewCommandHandlers,
        
        // HTTP
        middleware.NewAuthMiddleware,
        handlers.NewAuthHandler,
        handlers.NewTaskHandler,
        router.NewRouter,
        
        // Server
        NewServer,
    )
    return nil, nil
}
```

### 6. Testing Patterns

```go
// Table-driven tests
func TestUserService_Create(t *testing.T) {
    tests := []struct {
        name       string
        input      CreateUserCommand
        setup      func(*mockRepository)
        wantErr    error
        validate   func(*testing.T, *User)
    }{
        {
            name: "success",
            input: CreateUserCommand{Email: "test@test.com", ...},
            setup: func(m *mockRepository) {
                m.On("EmailExists", mock.Anything, "test@test.com").Return(false, nil)
                m.On("Create", mock.Anything, mock.Anything).Return(nil).Run(func(args mock.Arguments) {
                    user := args.Get(1).(*User)
                    user.ID = uuid.New()
                })
            },
            validate: func(t *testing.T, u *User) {
                assert.NotNil(t, u.ID)
                assert.Equal(t, "test@test.com", u.Email)
            },
        },
        // ...
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            repo := newMockRepository(t)
            if tt.setup != nil {
                tt.setup(repo)
            }
            svc := NewUserService(repo)
            
            got, err := svc.Create(context.Background(), tt.input)
            
            if tt.wantErr != nil {
                assert.ErrorIs(t, err, tt.wantErr)
            } else {
                assert.NoError(t, err)
                tt.validate(t, got)
            }
            repo.AssertExpectations(t)
        })
    }
}
```

### 6.1 Principios SOLID en Go

```go
// S - Single Responsibility: Un struct, una responsabilidad
// Cada handler maneja UN caso de uso
type CreateTaskHandler struct {
    useCase CreateTaskUseCase
}

// O - Open/Closed: Extender sin modificar
// Usar interfaces para repositorios, servicios externos
type PaymentProcessor interface {
    CreatePaymentIntent(ctx context.Context, params PaymentParams) (*PaymentIntent, error)
}

// L - Liskov: Implementaciones intercambiables
// StripeProcessor, MercadoPagoProcessor implementan PaymentProcessor

// I - Interface Segregation: Interfaces pequeñas
type UserReader interface {
    GetByID(ctx context.Context, id UUID) (*User, error)
    GetByEmail(ctx context.Context, email string) (*User, error)
}
type UserWriter interface {
    Create(ctx context.Context, user *User) error
    Update(ctx context.Context, user *User) error
}
// En lugar de UserRepository con 20 métodos

// D - Dependency Inversion: Depender de abstracciones
// Application layer define interfaces, Infrastructure las implementa
```

---

## Estándares TypeScript/Angular (Frontend Web)

### 1. Arquitectura de Componentes (Standalone + Signals)

```typescript
// ✅ BUENO: Standalone component con signals
@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatButtonModule],
  template: `
    <mat-card>
      <mat-card-title>{{ task().title }}</mat-card-title>
      <mat-card-content>
        <p>{{ task().description }}</p>
        <div class="budget">{{ tokensPipe.transform(task().budgetMin) }}</div>
      </mat-card-content>
      <mat-card-actions>
        <button mat-button (click)="onApply.emit(task().id)">Aplicar</button>
      </mat-card-actions>
    </mat-card>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskCardComponent {
  // Input signals (Angular 17+)
  task = input.required<TaskDTO>();
  
  // Output signals
  onApply = output<string>();
  
  // Computed signals
  isUrgent = computed(() => this.task().urgency === 'high');
  
  // Injected services (inject function)
  private tokensPipe = inject(TokensPipe);
}
```

### 2. State Management (Signals + RxJS)

```typescript
// Store pattern con signals
@Injectable({ providedIn: 'root' })
export class TaskStore {
  private _tasks = signal<TaskDTO[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  
  // Selectors públicos (readonly)
  tasks = this._tasks.asReadonly();
  loading = this._loading.asReadonly();
  error = this._error.asReadonly();
  
  // Computed selectors
  openTasks = computed(() => this._tasks().filter(t => t.status === 'open'));
  myTasks = computed(() => this._tasks().filter(t => t.clientId === this.auth.userId()));
  
  constructor(
    private api: TaskApiService,
    private auth: AuthStore
  ) {}
  
  // Commands
  async loadTasks(filters: TaskFilters) {
    this._loading.set(true);
    this._error.set(null);
    
    try {
      const result = await this.api.listTasks(filters);
      this._tasks.set(result.data);
    } catch (err) {
      this._error.set(err.message);
    } finally {
      this._loading.set(false);
    }
  }
  
  // Optimistic updates
  async applyToTask(taskId: string, application: CreateApplicationDTO) {
    const prevTasks = this._tasks();
    // Optimistic update
    this._tasks.update(tasks => tasks.map(t => 
      t.id === taskId ? { ...t, applicationsCount: t.applicationsCount + 1 } : t
    ));
    
    try {
      await this.api.applyToTask(taskId, application);
    } catch (err) {
      this._tasks.set(prevTasks); // Rollback
      throw err;
    }
  }
}
```

### 3. Services & HTTP

```typescript
// API Client con interceptors automáticos
@Injectable({ providedIn: 'root' })
export class TaskApiService {
  constructor(private http: HttpClient) {}
  
  listTasks(filters: TaskFilters): Observable<PaginatedResponse<TaskDTO>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null) params = params.set(k, String(v));
    });
    return this.http.get<PaginatedResponse<TaskDTO>>('/tasks', { params });
  }
  
  // Tipado estricto en responses
  getTask(id: string): Observable<TaskDTO> {
    return this.http.get<TaskDTO>(`/tasks/${id}`);
  }
}

// Interceptor para errors
@Injectable()
export class ErrorHandlerInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.auth.logout();
        }
        const message = error.error?.detail || error.message;
        return throwError(() => new ApiError(error.status, message));
      })
    );
  }
}
```

### 4. Nomenclatura Angular

| Elemento | Convención | Ejemplo |
|----------|------------|---------|
| Component | `PascalCase` + `Component` | `TaskCardComponent` |
| Service | `PascalCase` + `Service` | `TaskApiService` |
| Store | `PascalCase` + `Store` | `TaskStore` |
| Pipe | `PascalCase` + `Pipe` | `TokensPipe` |
| Directive | `PascalCase` + `Directive` | `ClickOutsideDirective` |
| Interface/Type | `PascalCase` + `DTO`/`Model` | `TaskDTO`, `UserModel` |
| Enum | `PascalCase` | `TaskStatus` |
| Constante | `UPPER_SNAKE_CASE` | `MAX_FILE_SIZE` |
| Variable/Function | `camelCase` | `loadTasks`, `currentUser` |
| Archivo | `kebab-case` | `task-card.component.ts` |

### 5. Reactive Forms Tipados

```typescript
@Component({...})
export class CreateTaskComponent {
  // Form tipado con FormRecord
  form = this.fb.group({
    title: ['', [Validators.required, Validators.minLength(5), Validators.maxLength(200)]],
    description: ['', [Validators.required, Validators.maxLength(5000)]],
    categoryId: ['', Validators.required],
    skillId: [''],
    budgetMin: [0, [Validators.required, Validators.min(100)]],
    budgetMax: [0, [Validators.required, Validators.min(100)]],
    budgetType: ['fixed', Validators.required],
    preferredDate: [''],
    urgency: ['normal', Validators.required],
  });
  
  // Validación cruzada
  constructor(private fb: FormBuilder) {
    this.form.addValidators(this.budgetRangeValidator);
  }
  
  budgetRangeValidator = (group: AbstractControl): ValidationErrors | null => {
    const min = group.get('budgetMin')?.value;
    const max = group.get('budgetMax')?.value;
    return min > max ? { budgetRange: true } : null;
  };
  
  onSubmit() {
    if (this.form.valid) {
      const dto: CreateTaskDTO = this.form.getRawValue();
      this.store.createTask(dto);
    }
  }
}
```

---

## Estándares React Native (Mobile)

### 1. Componentes con NativeWind (Tailwind)

```tsx
// ✅ BUENO: Componente tipado, con NativeWind
interface TaskCardProps {
  task: TaskDTO;
  onPress: (id: string) => void;
  onApply?: (id: string) => void;
}

export const TaskCard = ({ task, onPress, onApply }: TaskCardProps) => {
  const { tokensPipe } = useTokens();
  
  return (
    <Pressable onPress={() => onPress(task.id)} className="p-4 bg-white rounded-xl shadow-sm border border-gray-100">
      <View className="flex-row justify-between items-start mb-2">
        <Text className="text-lg font-semibold text-gray-900 flex-1 pr-2">{task.title}</Text>
        {task.urgency === 'high' && (
          <View className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
            Urgente
          </View>
        )}
      </View>
      
      <Text className="text-gray-600 mb-3 line-clamp-2">{task.description}</Text>
      
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <MapPin className="text-gray-400" size={16} />
          <Text className="text-sm text-gray-500">{task.locationCity}</Text>
        </View>
        
        <Text className="text-xl font-bold text-primary-600">
          {tokensPipe.format(task.budgetMin)}
        </Text>
      </View>
      
      {onApply && (
        <Button 
          className="mt-3 w-full" 
          onPress={() => onApply(task.id)}
          variant="outline"
        >
          Aplicar
        </Button>
      )}
    </Pressable>
  );
};
```

### 2. Custom Hooks para Lógica

```tsx
// hooks/useTasks.ts
export const useTasks = (filters?: TaskFilters) => {
  const { tasks, loading, error, loadTasks, applyToTask } = useTaskStore();
  const { user } = useAuthStore();
  
  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (filters?.categoryId) result = result.filter(t => t.categoryId === filters.categoryId);
    if (filters?.status) result = result.filter(t => t.status === filters.status);
    if (filters?.city) result = result.filter(t => t.locationCity === filters.city);
    return result;
  }, [tasks, filters]);
  
  const handleApply = useCallback(async (taskId: string, data: CreateApplicationDTO) => {
    if (!user) throw new Error('Must be logged in');
    return applyToTask(taskId, data);
  }, [applyToTask, user]);
  
  useEffect(() => {
    loadTasks(filters);
  }, [loadTasks, filters]);
  
  return {
    tasks: filteredTasks,
    loading,
    error,
    applyToTask: handleApply,
    refetch: () => loadTasks(filters),
  };
};
```

### 3. Zustand Store Pattern

```tsx
// store/taskStore.ts
interface TaskState {
  tasks: TaskDTO[];
  loading: boolean;
  error: string | null;
  loadTasks: (filters?: TaskFilters) => Promise<void>;
  applyToTask: (taskId: string, data: CreateApplicationDTO) => Promise<void>;
  optimisticApply: (taskId: string) => void;
  rollbackApply: (taskId: string) => void;
}

export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: [],
      loading: false,
      error: null,
      
      loadTasks: async (filters) => {
        set({ loading: true, error: null });
        try {
          const response = await taskApi.listTasks(filters);
          set({ tasks: response.data, loading: false });
        } catch (err) {
          set({ error: err.message, loading: false });
        }
      },
      
      applyToTask: async (taskId, data) => {
        // Optimistic update
        get().optimisticApply(taskId);
        try {
          await taskApi.applyToTask(taskId, data);
        } catch (err) {
          get().rollbackApply(taskId);
          throw err;
        }
      },
      
      optimisticApply: (taskId) => set(state => ({
        tasks: state.tasks.map(t => 
          t.id === taskId ? { ...t, applicationsCount: t.applicationsCount + 1 } : t
        )
      })),
      
      rollbackApply: (taskId) => set(state => ({
        tasks: state.tasks.map(t => 
          t.id === taskId ? { ...t, applicationsCount: t.applicationsCount - 1 } : t
        )
      })),
    }),
    { name: 'task-storage', partialize: state => ({ tasks: state.tasks }) }
  )
);
```

---

## Principios Generales (Cross-Platform)

### 1. DRY - Don't Repeat Yourself
- **Shared types**: `packages/shared-types` para DTOs, enums, interfaces
- **Shared utils**: `packages/shared-utils` para formateo, validación, fechas
- **Componentes UI**: Diseño system compartido cuando sea posible

### 2. KISS - Keep It Simple, Stupid
- Evitar over-engineering en MVP
- Preferir composición sobre herencia
- Funciones pequeñas (< 20 líneas), una sola responsabilidad

### 3. YAGNI - You Aren't Gonna Need It
- No agregar abstracciones hasta que sean necesarias
- No crear "frameworks" internos prematuros
- Implementar lo mínimo viable

### 4. Explicit over Implicit
- Tipado estricto en todos lados (`noImplicitAny: true`)
- Inyección de dependencias explícita
- Nombres descriptivos > comentarios

### 5. Fail Fast
- Validar inputs al inicio (boundary validation)
- Tipos de dominio que hacen imposible estados inválidos
- `assert` / `guard` clauses tempranas

---

## Git & Commits

### Convencional Commits
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`

**Scopes:** `auth`, `task`, `token`, `user`, `message`, `api`, `web`, `mobile`, `infra`

**Ejemplos:**
```
feat(task): add task creation endpoint
fix(token): correct withdrawal fee calculation
refactor(auth): extract password hashing to domain service
test(user): add integration tests for profile update
chore(deps): update go dependencies
```

### Branch Strategy
- `main` - Producción (protegida, solo PR + CI pass)
- `develop` - Staging/Integración
- `feature/*` - Features (desde develop)
- `fix/*` - Bugfixes (desde develop/main)
- `release/*` - Preparación release
- `hotfix/*` - Hotfixes urgentes (desde main)

### PR Requirements
- [ ] CI passing (lint, typecheck, tests, build)
- [ ] Coverage > 80% (nuevo código)
- [ ] Code review aprobado (1 reviewer mínimo)
- [ ] Commits squash & merge con mensaje convencional
- [ ] Changelog actualizado (si aplica)

---

## Code Review Checklist

### Funcionalidad
- [ ] Cumple los requisitos del ticket
- [ ] Maneja casos edge (empty, null, límites)
- [ ] Validación de inputs en boundary
- [ ] Error handling apropiado

### Código
- [ ] Nombres claros y consistentes
- [ ] Funciones/componentes pequeños (< 50 líneas)
- [ ] Sin código duplicado (DRY)
- [ ] Sin `any` / `interface{}` innecesarios
- [ ] Comentarios solo para "por qué", no "qué"

### Arquitectura
- [ ] Respeta límites de capas (Clean Architecture)
- [ ] Dependencias correctas (Domain no conoce Infrastructure)
- [ ] Interfaces en lugar de concreciones
- [ ] Eventos de dominio para side effects

### Testing
- [ ] Tests unitarios para lógica de dominio
- [ ] Tests de integración para repositorios/handlers
- [ ] Tests E2E para flujos críticos
- [ ] Mocks mínimos, preferir fakes

### Seguridad
- [ ] No hay secrets hardcodeados
- [ ] Validación/sanitización de inputs
- [ ] AuthZ checks en handlers
- [ ] Rate limiting en endpoints públicos

---

## Métricas de Calidad (Quality Gates)

| Métrica | Target | Herramienta |
|---------|--------|-------------|
| Test Coverage | > 80% | go test / vitest |
| Cyclomatic Complexity | < 15 por función | golangci-lint / eslint |
| Cognitive Complexity | < 10 | golangci-lint / eslint |
| Duplicated Lines | < 3% | sonar / golangci-lint |
| Maintainability Index | > 70 | sonar |
| TypeScript Strict | 0 errors | tsc --noEmit |
| Go Vet | 0 issues | go vet |
| Critical Vulnerabilities | 0 | govulncheck / npm audit |
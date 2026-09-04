# Contributing to YourTime

Gracias por contribuir. Por favor leer esta guía antes de enviar un PR.

## Flujo de Trabajo

### 1. Branches

```
main          → Producción (protegida, solo merge via PR + CI pass)
develop       → Staging/Integración
feature/*     → Features (desde develop)
fix/*         → Bugfixes (desde develop/main)
release/*     → Preparación release
hotfix/*      → Hotfixes urgentes (desde main)
```

### 2. Commits

Usar **Conventional Commits**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

| Type | Uso |
|------|-----|
| `feat` | Nueva funcionalidad |
| `fix` | Bug fix |
| `docs` | Documentación |
| `style` | Formato, sin lógica |
| `refactor` | Refactor sin cambio de comportamiento |
| `test` | Tests |
| `chore` | Mantenimiento, deps, config |
| `perf` | Performance |
| `ci` | CI/CD |

**Scopes:** `auth`, `task`, `token`, `user`, `message`, `api`, `web`, `mobile`, `infra`

**Ejemplos:**
```
feat(task): add task creation endpoint
fix(token): correct withdrawal fee calculation
refactor(auth): extract password hashing to domain service
test(user): add integration tests for profile update
chore(deps): update go dependencies
```

### 3. Pull Requests

**Requisitos obligatorios:**
- [ ] CI passing (lint, typecheck, tests, build)
- [ ] Coverage > 80% en código nuevo
- [ ] Code review aprobado (1 reviewer mínimo)
- [ ] Commits squash & merge con mensaje convencional
- [ ] Changelog actualizado (si aplica)

**Template PR:**
```markdown
## Descripción
Breve descripción de los cambios.

## Tipo de cambio
- [ ] Bug fix
- [ ] Nueva feature
- [ ] Breaking change
- [ ] Docs / Refactor / Chore

## Testing
- [ ] Unit tests añadidos/actualizados
- [ ] Integration tests añadidos/actualizados
- [ ] Manual testing realizado

## Checklist
- [ ] Lint pasa
- [ ] Typecheck pasa
- [ ] Tests pasan
- [ ] No hay `console.log` / `fmt.Println` debug
- [ ] Variables de entorno documentadas
- [ ] Migraciones DB incluidas (si aplica)
```

## Estándares de Código

Ver `CLEAN_CODE_STANDARDS.md` para:
- Arquitectura (Clean Architecture + DDD)
- Nomenclatura Go / TypeScript / React Native
- Error handling, testing, seguridad
- Code review checklist

## Configuración Local

```bash
# 1. Instalar hooks
pnpm prepare  # husky install

# 2. Verificar que funcionan
git commit --allow-empty -m "test: verify hooks"
# Debería correr lint-staged + commitlint
```

## Reportar Issues

Usar templates en `.github/ISSUE_TEMPLATE/`:
- **Bug Report**: Pasos para reproducir, expected vs actual, logs
- **Feature Request**: Problema a resolver, propuesta, alternativas
- **Security**: Reportar privadamente a security@yourtime.app

## Código de Conducta

- Sé respetuoso e inclusivo
- Crítica constructiva, no personal
- Ayuda a otros a aprender
- Reporta comportamiento inapropiado

## Preguntas

- **Technical**: Abrir Discussion en GitHub
- **Process**: Preguntar en PR o Slack #yourtime-dev
- **Security**: security@yourtime.app
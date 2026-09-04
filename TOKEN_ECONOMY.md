# YourTime - Sistema de Tokens / Economía Interna

## Visión General

YourTime utiliza un sistema de **tokens internos** como medio de intercambio único dentro de la plataforma. Esto permite:

1. **Desacoplamiento** del precio real del servicio
2. **Flexibilidad** en precios, promociones, bonos
3. **Control** de flujo de dinero (comisiones, hold, disputas)
4. **Escalabilidad** internacional sin múltiples monedas
5. **Gamificación** (rewards, referidos, staking futuro)

---

## Flujo Económico Completo

```mermaid
flowchart LR
    subgraph "COMPRA"
        A[Usuario] -->|$ USD| B[Stripe/MP]
        B -->|Webhook OK| C[+Tokens en balance]
    end
    
    subgraph "CONTRATACIÓN"
        C -->|Crear Task| D[Reserva tokens<br/>(pending)]
        D -->|Worker acepta| E[Task in_progress]
        E -->|Worker completa| F[Pago a Worker<br/>(-fee plataforma)]
    end
    
    subgraph "RETIRO"
        F -->|Worker solicita| G[Solicitud retiro]
        G -->|Admin aprueba| H[Transferencia $ USD]
        H -->|Completado| I[-Tokens balance<br/>+$ en banco]
    end
    
    subgraph "COMISIONES"
        D -->|10%| J[Fee Plataforma]
        G -->|5%| J
    end
```

---

## Tipos de Balance

```go
// internal/domain/token/entity.go

type TokenBalance struct {
    UserID           UUID
    AvailableTokens  int64  // Disponibles para gastar YA
    PendingTokens    int64  // En transacciones pendientes (hold)
    LifetimeEarned   int64  // Total ganado históricamente (stats)
    LifetimeSpent    int64  // Total gastado históricamente
    LifetimeWithdrawn int64 // Total retirado a dinero real
    UpdatedAt        time.Time
}

// Invariant: AvailableTokens >= 0 siempre
// PendingTokens se mueven a Available al completar/confirmar
```

---

## Transacciones (Ledger Inmutable)

```go
// Cada movimiento genera UNA TokenTransaction
type TokenTransaction struct {
    ID                  UUID
    UserID              UUID
    Type                TransactionType  // Ver enum abajo
    Amount              int64            // + crédito, - débito
    BalanceAfter        int64            // Balance disponible DESPUÉS
    // Referencias opcionales
    RelatedTaskID       *UUID
    RelatedApplicationID *UUID
    RelatedWithdrawalID *UUID
    RelatedPurchaseID   *UUID
    Description         string
    Metadata            JSONB
    CreatedAt           time.Time
}

// TransactionType enum
const (
    TypePurchase         = "purchase"           // Compra tokens con $
    TypeTaskCharge       = "task_charge"        // Cliente paga por task (hold)
    TypeTaskPayment      = "task_payment"       // Worker recibe por task
    TypeTaskRefund       = "task_refund"        // Reembolso al cliente
    TypeTaskHoldRelease  = "task_hold_release"  // Libera hold a worker
    TypeWithdrawal       = "withdrawal"         // Worker retira a $
    TypeWithdrawalFee    = "withdrawal_fee"     // Fee de retiro
    TypePlatformFee      = "platform_fee"       // Fee plataforma (10% task)
    TypeBonus            = "bonus"              // Referidos, promos
    TypePenalty          = "penalty"            // Disputas, cancelaciones
)
```

---

## Flujo: Compra de Tokens

```go
// 1. Usuario elige paquete en frontend
// Paquetes configurables en platform_config
type TokenPackage struct {
    Tokens       int64   `json:"tokens"`        // 1100
    PriceCents   int64   `json:"price_cents"`   // 1000 ($10.00)
    BonusTokens  int64   `json:"bonus_tokens"`  // 100 (10% bonus)
    PriceUSD     float64 `json:"price_usd"`     // 10.00
    TokensPerUSD float64 `json:"tokens_per_usd"` // 110
}

// 2. Backend crea PurchaseIntent
func (s *TokenService) CreatePurchase(ctx context.Context, userID UUID, pkg TokenPackage, provider PaymentProvider) (*PurchaseIntent, error) {
    purchase := &TokenPurchase{
        UserID:       userID,
        TokensAmount: pkg.Tokens + pkg.BonusTokens,
        Currency:     "USD",
        AmountCents:  pkg.PriceCents,
        ExchangeRate: float64(pkg.Tokens+pkg.BonusTokens) / (float64(pkg.PriceCents)/100),
        Provider:     provider,
        Status:       "pending",
    }
    
    // Guardar purchase
    // Llamar provider (Stripe/MercadoPago) -> obtener client_token
    return &PurchaseIntent{
        PurchaseID:  purchase.ID,
        ClientToken: clientToken, // Stripe PaymentIntent client_secret
        Provider:    provider,
    }, nil
}

// 3. Webhook confirma pago
func (s *TokenService) HandlePaymentWebhook(ctx context.Context, event PaymentWebhookEvent) error {
    purchase := s.repo.GetPurchaseByProviderID(event.ProviderID)
    
    // Verificar firma del provider
    // Verificar amount matches
    
    // Acreditar tokens (ATÓMICO con transacción DB)
    return s.repo.WithTx(ctx, func(tx *sqlx.Tx) error {
        // 1. Marcar purchase completed
        purchase.Status = "completed"
        purchase.CompletedAt = time.Now()
        s.repo.UpdatePurchase(tx, purchase)
        
        // 2. Crear transacciones de ledger
        // Principal
        s.ledger.Create(tx, TokenTransaction{
            UserID:        purchase.UserID,
            Type:          TypePurchase,
            Amount:        purchase.TokensAmount,
            BalanceAfter:  newBalance.Available + purchase.TokensAmount,
            RelatedPurchaseID: &purchase.ID,
            Description:   fmt.Sprintf("Compra de %d tokens", purchase.TokensAmount),
        })
        
        // 3. Si hay bonus, transacción separada
        if pkg.BonusTokens > 0 {
            s.ledger.Create(tx, TokenTransaction{
                UserID:       purchase.UserID,
                Type:         TypeBonus,
                Amount:       pkg.BonusTokens,
                BalanceAfter: newBalance.Available + purchase.TokensAmount + pkg.BonusTokens,
                Description:  "Bonus por compra",
                Metadata:     JSONB{"purchase_id": purchase.ID, "type": "purchase_bonus"},
            })
        }
        
        // 4. Actualizar balance
        s.balance.AddAvailable(tx, purchase.UserID, purchase.TokensAmount+pkg.BonusTokens)
        s.balance.AddLifetimeEarned(tx, purchase.UserID, purchase.TokensAmount+pkg.BonusTokens)
        
        return nil
    })
}
```

---

## Flujo: Contratación de Task (Escrow/Hold)

```go
// Cuando CLIENTE crea task y selecciona worker
func (s *TaskService) AcceptApplication(ctx context.Context, taskID, clientID, applicationID UUID) error {
    return s.repo.WithTx(ctx, func(tx *sqlx.Tx) error {
        task := s.taskRepo.GetByID(tx, taskID)
        app := s.appRepo.GetByID(tx, applicationID)
        
        // 1. Verificar que cliente tiene tokens disponibles
        balance := s.balanceRepo.GetByUserID(tx, clientID)
        if balance.AvailableTokens < app.ProposedTokens {
            return ErrInsufficientTokens
        }
        
        // 2. HOLD: Mover de available -> pending (escrow)
        s.balance.SubAvailable(tx, clientID, app.ProposedTokens)
        s.balance.AddPending(tx, clientID, app.ProposedTokens)
        
        s.ledger.Create(tx, TokenTransaction{
            UserID:           clientID,
            Type:             TypeTaskCharge,
            Amount:           -app.ProposedTokens,
            BalanceAfter:     balance.AvailableTokens - app.ProposedTokens,
            RelatedTaskID:    &taskID,
            RelatedApplicationID: &applicationID,
            Description:      fmt.Sprintf("Reserva para task '%s'", task.Title),
        })
        
        // 3. Actualizar task
        task.Status = "in_progress"
        task.AssignedWorkerID = &app.WorkerID
        task.AssignedAt = time.Now()
        s.taskRepo.Update(tx, task)
        
        // 4. Actualizar application
        app.Status = "accepted"
        s.appRepo.Update(tx, app)
        
        // 5. Rechazar otras applications
        s.appRepo.RejectOthers(tx, taskID, applicationID)
        
        // 6. Notificaciones
        s.notifier.NotifyWorkerAssigned(app.WorkerID, task)
        s.notifier.NotifyClientTaskStarted(clientID, task)
        
        return nil
    })
}
```

---

## Flujo: Completar Task y Pagar Worker

```go
// Cuando WORKER marca task como completada
func (s *TaskService) CompleteTask(ctx context.Context, taskID, workerID UUID) error {
    return s.repo.WithTx(ctx, func(tx *sqlx.Tx) error {
        task := s.taskRepo.GetByID(tx, taskID)
        
        // Verificaciones
        if task.AssignedWorkerID != workerID {
            return ErrNotAssignedWorker
        }
        if task.Status != "in_progress" {
            return ErrInvalidTaskStatus
        }
        
        // Obtener monto acordado (de application aceptada)
        app := s.appRepo.GetAcceptedByTask(tx, taskID)
        tokensToPay := app.ProposedTokens
        
        // Calcular fee plataforma (10%)
        platformFee := tokensToPay * 10 / 100
        workerReceives := tokensToPay - platformFee
        
        // 1. LIBERAR HOLD del cliente -> mover pending a "gastado"
        clientBalance := s.balanceRepo.GetByUserID(tx, task.ClientID)
        s.balance.SubPending(tx, task.ClientID, tokensToPay)
        s.balance.AddLifetimeSpent(tx, task.ClientID, tokensToPay)
        
        s.ledger.Create(tx, TokenTransaction{
            UserID:           task.ClientID,
            Type:             TypeTaskHoldRelease, // O TypePlatformFee para la parte del fee
            Amount:           0, // No cambia available, solo pending
            BalanceAfter:     clientBalance.AvailableTokens,
            RelatedTaskID:    &taskID,
            Description:      fmt.Sprintf("Completado task '%s'", task.Title),
        })
        
        // 2. PAGAR AL WORKER (available +)
        workerBalance := s.balanceRepo.GetByUserID(tx, workerID)
        s.balance.AddAvailable(tx, workerID, workerReceives)
        s.balance.AddLifetimeEarned(tx, workerID, workerReceives)
        
        s.ledger.Create(tx, TokenTransaction{
            UserID:           workerID,
            Type:             TypeTaskPayment,
            Amount:           workerReceives,
            BalanceAfter:     workerBalance.AvailableTokens + workerReceives,
            RelatedTaskID:    &taskID,
            RelatedApplicationID: &app.ID,
            Description:      fmt.Sprintf("Pago por task '%s'", task.Title),
            Metadata:         JSONB{"gross": tokensToPay, "platform_fee": platformFee},
        })
        
        // 3. REGISTRAR FEE PLATAFORMA (para contabilidad)
        s.ledger.Create(tx, TokenTransaction{
            UserID:        workerID, // O system user
            Type:          TypePlatformFee,
            Amount:        -platformFee,
            BalanceAfter:  workerBalance.AvailableTokens + workerReceives, // No afecta balance real
            RelatedTaskID: &taskID,
            Description:   "Comisión YourTime (10%)",
        })
        
        // 4. Actualizar task
        task.Status = "completed"
        task.CompletedAt = time.Now()
        s.taskRepo.Update(tx, task)
        
        // 5. Notificaciones
        s.notifier.NotifyTaskCompleted(task.ClientID, task)
        s.notifier.NotifyPaymentReceived(workerID, workerReceives)
        
        return nil
    })
}
```

---

## Flujo: Retiro a Dinero Real (Cash Out)

```go
// Worker solicita retiro
func (s *TokenService) RequestWithdrawal(ctx context.Context, workerID UUID, req WithdrawalRequest) (*TokenWithdrawal, error) {
    // Validaciones
    config := s.config.GetTokenConfig()
    
    if req.TokensAmount < config.MinWithdrawalTokens {
        return nil, ErrBelowMinimumWithdrawal
    }
    if req.TokensAmount > config.MaxWithdrawalTokens {
        return nil, ErrAboveMaximumWithdrawal
    }
    
    balance := s.balanceRepo.GetByUserID(ctx, workerID)
    if balance.AvailableTokens < req.TokensAmount {
        return nil, ErrInsufficientTokens
    }
    
    // Calcular conversión
    // sell_rate: 90 tokens = $1 (worker recibe menos de lo que compró)
    sellRate := config.ExchangeRate.Sell // 90
    grossUSD := float64(req.TokensAmount) / float64(sellRate)
    grossCents := int64(math.Round(grossUSD * 100))
    
    // Fee plataforma (5%)
    platformFeeCents := grossCents * config.PlatformFeePercent.Withdrawal / 100
    // Fee processor (Stripe ~2.9% + $0.30, MP ~3.5%)
    processorFeeCents := calculateProcessorFee(grossCents, req.PayoutMethod)
    
    netCents := grossCents - platformFeeCents - processorFeeCents
    
    withdrawal := &TokenWithdrawal{
        WorkerID:                    workerID,
        TokensAmount:                req.TokensAmount,
        Currency:                    "USD",
        AmountCents:                 netCents,           // Lo que recibe worker
        GrossAmountCents:            grossCents,         // Valor bruto
        PlatformFeeCents:            platformFeeCents,
        PaymentProcessorFeeCents:    processorFeeCents,
        ExchangeRate:                float64(sellRate),
        PayoutMethod:                req.PayoutMethod,
        PayoutDetails:               encryptPayoutDetails(req.PayoutDetails),
        Status:                      "pending",
    }
    
    // HOLD tokens (available -> pending)
    s.balance.SubAvailable(ctx, workerID, req.TokensAmount)
    s.balance.AddPending(ctx, workerID, req.TokensAmount)
    
    s.ledger.Create(ctx, TokenTransaction{
        UserID:             workerID,
        Type:               TypeWithdrawal,
        Amount:             -req.TokensAmount,
        BalanceAfter:       balance.AvailableTokens - req.TokensAmount,
        RelatedWithdrawalID: &withdrawal.ID,
        Description:        fmt.Sprintf("Solicitud retiro $%.2f", float64(netCents)/100),
    })
    
    return withdrawal, nil
}

// Admin procesa retiro
func (s *TokenService) ProcessWithdrawal(ctx context.Context, withdrawalID UUID, adminID UUID, action WithdrawalAction) error {
    withdrawal := s.withdrawalRepo.GetByID(ctx, withdrawalID)
    
    if action == "approve" {
        // Ejecutar transferencia bancaria / PayPal / MP
        err := s.payoutProvider.Send(withdrawal.PayoutMethod, withdrawal.PayoutDetails, withdrawal.AmountCents)
        if err != nil {
            withdrawal.Status = "failed"
            withdrawal.FailureReason = err.Error()
            s.withdrawalRepo.Update(ctx, withdrawal)
            return err
        }
        
        // Confirmar: mover pending -> "retirado" (no vuelve a available)
        s.balance.SubPending(ctx, withdrawal.WorkerID, withdrawal.TokensAmount)
        s.balance.AddLifetimeWithdrawn(ctx, withdrawal.WorkerID, withdrawal.TokensAmount)
        
        s.ledger.Create(ctx, TokenTransaction{
            UserID:             withdrawal.WorkerID,
            Type:               TypeWithdrawalFee, // Ya descontado en net, esto es registro
            Amount:             0,
            BalanceAfter:       s.balanceRepo.GetByUserID(ctx, withdrawal.WorkerID).AvailableTokens,
            RelatedWithdrawalID: &withdrawal.ID,
            Description:        fmt.Sprintf("Retiro completado $%.2f", float64(withdrawal.AmountCents)/100),
        })
        
        withdrawal.Status = "completed"
        withdrawal.ProcessedAt = time.Now()
        
    } else if action == "reject" {
        // Devolver tokens a available
        s.balance.SubPending(ctx, withdrawal.WorkerID, withdrawal.TokensAmount)
        s.balance.AddAvailable(ctx, withdrawal.WorkerID, withdrawal.TokensAmount)
        
        s.ledger.Create(ctx, TokenTransaction{
            UserID:             withdrawal.WorkerID,
            Type:               TypeBonus, // Reversión
            Amount:             withdrawal.TokensAmount,
            BalanceAfter:       s.balanceRepo.GetByUserID(ctx, withdrawal.WorkerID).AvailableTokens,
            RelatedWithdrawalID: &withdrawal.ID,
            Description:        "Retiro rechazado - tokens devueltos",
        })
        
        withdrawal.Status = "cancelled"
    }
    
    s.withdrawalRepo.Update(ctx, withdrawal)
    return nil
}
```

---

## Configuración de Tasas (Platform Config)

```json
{
  "token_exchange_rate": {
    "buy": 100,    // 100 tokens = $1 al COMPRAR (usuario gasta $1, recibe 100 tokens)
    "sell": 90     // 90 tokens = $1 al VENDER (usuario da 90 tokens, recibe $1)
  },
  "platform_fee_percent": {
    "task": 10,        // 10% de cada task va a plataforma
    "withdrawal": 5    // 5% del retiro va a plataforma
  },
  "min_withdrawal_tokens": 1000,   // $11.11 aprox
  "max_withdrawal_tokens": 100000, // $1,111 aprox
  "token_packages": [
    {"tokens": 500, "price_cents": 500, "bonus_tokens": 0},      // $5.00 - 100 tokens/$
    {"tokens": 1100, "price_cents": 1000, "bonus_tokens": 100},  // $10.00 - 110 tokens/$ (+10%)
    {"tokens": 5500, "price_cents": 5000, "bonus_tokens": 500},  // $50.00 - 110 tokens/$ (+10%)
    {"tokens": 11500, "price_cents": 10000, "bonus_tokens": 1500} // $100.00 - 115 tokens/$ (+15%)
  ]
}
```

### Economía de la Plataforma

| Acción | Usuario | Plataforma | Worker |
|--------|---------|------------|--------|
| Compra 1000 tokens ($10) | -$10 | +$10 | - |
| Crea task 500 tokens | -500 tokens (hold) | - | - |
| Worker completa | - | +50 tokens (10%) | +450 tokens |
| Worker retira 450 tokens | - | +$2.50 (5% fee) | +$4.72 neto |

**Spread implícito:** Buy 100 / Sell 90 = 11% spread + fees = ~20% revenue por ciclo completo

---

## Seguridad y Compliance

### 1. Prevención Lavado Dinero (AML/KYC)
- **Límites**: Min/max retiro, max daily/monthly volume
- **Verificación**: Retiros > $1000 requieren KYC (documento, selfie, proof of address)
- **Monitoreo**: Patrones sospechosos (muchos retiros pequeños, circular flows)
- **Reporting**: Reporte automático a UIF si aplica (Argentina)

### 2. Contabilidad
- **Double-entry ledger**: Cada token movement tiene contrapartida
- **Auditoría**: TokenTransaction es inmutable (append-only)
- **Conciliación diaria**: Sum(available) + Sum(pending) = Total tokens emitidos - Total quemados

### 3. Fraud Prevention
- **Velocity checks**: Max 3 compras/hora, 5 retiros/día
- **Device fingerprinting**: Detectar multi-cuenta
- **Chargeback handling**: Stripe disputes -> revert tokens + penalty
- **Dispute resolution**: Mediación antes de liberar hold

---

## API Endpoints Resumen

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/tokens/balance` | Balance actual (available, pending, lifetime) |
| GET | `/tokens/transactions` | Historial paginado con filtros |
| GET | `/tokens/packages` | Paquetes disponibles para compra |
| GET | `/tokens/exchange-rate` | Tasas buy/sell, fees, límites |
| POST | `/tokens/purchase` | Crear intent de compra (Stripe/MP) |
| POST | `/tokens/purchase/webhook` | Webhook provider (sin auth) |
| POST | `/tokens/withdraw` | Solicitar retiro (worker) |
| GET | `/tokens/withdrawals` | Historial de retiros |

---

## Testing Scenarios Críticos

```go
func TestTokenEconomy_FullCycle(t *testing.T) {
    // 1. Usuario compra 1100 tokens ($10)
    purchase := createPurchase(userID, 1100, 1000) // 1000 cents = $10
    processPaymentWebhook(purchase.ID, "succeeded")
    
    assertBalance(userID, available=1100, pending=0, earned=1100)
    
    // 2. Usuario crea task 500 tokens
    task := createTask(clientID, 500)
    application := applyToTask(task.ID, workerID, 500)
    acceptApplication(task.ID, application.ID)
    
    assertBalance(clientID, available=600, pending=500) // 500 en hold
    
    // 3. Worker completa task
    completeTask(task.ID, workerID)
    
    // Cliente: 500 gastados, 0 pending
    assertBalance(clientID, available=600, pending=0, spent=500)
    // Worker: recibe 450 (500 - 10% fee)
    assertBalance(workerID, available=450, pending=0, earned=450)
    
    // 4. Worker retira 450 tokens
    withdrawal := requestWithdrawal(workerID, 450)
    processWithdrawal(withdrawal.ID, "approve")
    
    // Worker: 450 withdrawn, 0 available
    assertBalance(workerID, available=0, pending=0, withdrawn=450)
    // Worker recibe ~$4.72 neto (450/90 = $5 - 5% fee - processor fee)
}
```

---

## Métricas de Negocio (KPIs)

| Métrica | Fórmula | Target |
|---------|---------|--------|
| **Token Velocity** | Total transacciones / Supply promedio | > 5x/mes |
| **Buy/Sell Ratio** | Tokens comprados / Tokens retirados | > 1.5 (crecimiento) |
| **Platform Take Rate** | Fees recaudados / Volumen total | ~15-20% |
| **Avg Task Value** | Mean(tokens per task) | Tracking |
| **Withdrawal Rate** | Tokens retirados / Tokens ganados | < 50% (retención) |
| **Chargeback Rate** | Disputas / Transacciones | < 1% |

---

## Escalabilidad Futura

1. **Staking**: Lock tokens -> rewards (reducción velocity)
2. **Marketplace Secundario**: Peer-to-peer token exchange
3. **Multi-moneda**: Tokens anclados a USD, pero display en ARS/EUR/etc
4. **DeFi Integration**: Liquidity pools, yield farming (regulatorio complejo)
5. **Corporate Accounts**: Empresas compran tokens bulk para contratar servicios
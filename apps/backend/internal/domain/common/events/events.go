package events

import (
	"time"
	"github.com/google/uuid"
)

type Event interface {
	EventType() string
	AggregateID() uuid.UUID
	OccurredAt() time.Time
}

type BaseEvent struct {
	ID        uuid.UUID
	Timestamp time.Time
}

func NewBaseEvent(aggregateID uuid.UUID) BaseEvent {
	return BaseEvent{
		ID:        uuid.New(),
		Timestamp: time.Now().UTC(),
	}
}

func (e BaseEvent) AggregateID() uuid.UUID {
	return e.ID
}

func (e BaseEvent) OccurredAt() time.Time {
	return e.Timestamp
}
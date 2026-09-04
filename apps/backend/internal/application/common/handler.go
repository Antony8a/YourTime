package common

import (
	"context"
)

type Command interface {
	Validate() error
}

type Query interface {
	Validate() error
}

type CommandHandler[C Command] interface {
	Handle(ctx context.Context, cmd C) error
}

type QueryHandler[Q Query, R any] interface {
	Handle(ctx context.Context, query Q) (R, error)
}

type PaginationParams struct {
	Limit  int
	Cursor string
}

type PaginatedResult[T any] struct {
	Data  []T
	NextCursor string
	HasMore bool
}
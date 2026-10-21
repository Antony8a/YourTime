package errors

// Error is a domain error with a stable machine-readable Code that clients can
// translate, a human Msg (English, for logs and developers) and a Kind that
// decides the HTTP status. errors.Is matches both the error itself and its Kind.
type Error struct {
	Code string
	Msg  string
	Kind error
}

// New creates a coded error of the given kind (ErrNotFound, ErrConflict, ...).
func New(kind error, code, msg string) *Error { return &Error{Code: code, Msg: msg, Kind: kind} }

func (e *Error) Error() string { return e.Msg + ": " + e.Kind.Error() }
func (e *Error) Unwrap() error { return e.Kind }

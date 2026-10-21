package logger

import (
	"os"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Logger is an alias so callers can depend on this package instead of zerolog directly.
type Logger = zerolog.Logger

// Info, Warn and Error use the global logger configured by New for call sites
// that don't hold a Logger instance (e.g. middleware built before DI wiring).
func Info() *zerolog.Event  { return log.Info() }
func Warn() *zerolog.Event  { return log.Warn() }
func Error() *zerolog.Event { return log.Error() }

func New(env string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano

	var output zerolog.ConsoleWriter
	if env == "development" {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
			NoColor:    false,
		}
	} else {
		output = zerolog.ConsoleWriter{
			Out:        os.Stdout,
			TimeFormat: time.RFC3339,
			NoColor:    true,
		}
	}

	logger := zerolog.New(output).
		With().
		Timestamp().
		Str("service", "yourtime-api").
		Str("env", env).
		Logger()

	log.Logger = logger
	return logger
}

func WithContext(logger zerolog.Logger, keyValues ...interface{}) zerolog.Logger {
	return logger.With().Fields(map[string]interface{}{
		"ctx": keyValues,
	}).Logger()
}

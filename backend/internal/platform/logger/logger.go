package logger

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
)

var globalLogger zerolog.Logger

func New(environment string) zerolog.Logger {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	zerolog.TimestampFieldName = "@timestamp"

	level := zerolog.InfoLevel
	if strings.EqualFold(environment, "development") {
		level = zerolog.DebugLevel
	}

	globalLogger = zerolog.New(os.Stdout).Level(level).With().Timestamp().Logger()
	return globalLogger
}

// Helper functions for global logger convenience
func Error() *zerolog.Event {
	return globalLogger.Error()
}

func Warn() *zerolog.Event {
	return globalLogger.Warn()
}

func Info() *zerolog.Event {
	return globalLogger.Info()
}

func Debug() *zerolog.Event {
	return globalLogger.Debug()
}

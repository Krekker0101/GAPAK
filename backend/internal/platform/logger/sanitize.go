package logger

import (
	"regexp"
	"strings"
)

var sensitivePatterns = []*regexp.Regexp{
	regexp.MustCompile(`(?i)(authorization\s*:\s*bearer\s+)[^\s,;]+`),
	regexp.MustCompile(`(?i)(bearer\s+)[^\s,;]+`),
	regexp.MustCompile(`(?i)(refresh[_ -]?token\s*[=:]\s*)[^\s,;]+`),
	regexp.MustCompile(`(?i)(access[_ -]?token\s*[=:]\s*)[^\s,;]+`),
	regexp.MustCompile(`(?i)(password\s*[=:]\s*)[^\s,;]+`),
	regexp.MustCompile(`(?i)(secret\s*[=:]\s*)[^\s,;]+`),
	regexp.MustCompile(`(?i)(cookie\s*[=:]\s*)[^\s,;]+`),
}

func Sanitize(s string) string {
	s = strings.TrimSpace(s)
	for _, p := range sensitivePatterns {
		s = p.ReplaceAllString(s, `${1}[REDACTED]`)
	}
	if len(s) > 2048 {
		s = s[:2048] + "…"
	}
	return s
}

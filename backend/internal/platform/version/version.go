package version

// Build metadata is injected by CI/release builds with -ldflags.
// Safe development defaults keep local builds informative.
var (
	Version   = "dev"
	Commit    = "unknown"
	BuildTime = "unknown"
)

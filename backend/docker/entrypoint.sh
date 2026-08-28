#!/bin/sh
set -eu

# Railway may provide an explicit Start Command. Always respect it.
if [ "$#" -gt 0 ]; then
    exec "$@"
fi

# The same immutable image is deployed as API, worker and (optionally) the
# one-shot migration service. Select the binary from an explicit override or
# Railway's service name, while keeping API as the safe local/default process.
process_name="$(printf '%s' "${GAPAK_PROCESS:-${RAILWAY_SERVICE_NAME:-api}}" | tr '[:upper:]' '[:lower:]')"
case "$process_name" in
    *worker*)
        exec /usr/local/bin/gapak-worker
        ;;
    *migrate*)
        exec /usr/local/bin/gapak-migrate
        ;;
    *admin*)
        exec /usr/local/bin/gapak-admin
        ;;
    *)
        exec /usr/local/bin/gapak-api
        ;;
esac

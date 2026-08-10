#!/bin/sh
set -eu

: "${DEPLOY_IMAGE:?DEPLOY_IMAGE must be set}"
: "${DEPLOY_TARGET:?DEPLOY_TARGET must be set}"

case "$DEPLOY_TARGET" in
  docker-compose)
    : "${DEPLOY_HOST:?DEPLOY_HOST must be set}"
    : "${DEPLOY_USER:?DEPLOY_USER must be set}"
    echo "Deployment target is docker-compose on ${DEPLOY_HOST}. Configure the platform-specific SSH/container rollout in your secret-managed deployment environment."
    echo "Image: ${DEPLOY_IMAGE}"
    ;;
  *)
    echo "Unsupported deployment target: ${DEPLOY_TARGET}" >&2
    exit 1
    ;;
esac

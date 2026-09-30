#!/usr/bin/env bash
set -euo pipefail

# The workflow pipes this script into `bash -s`, which reads it from stdin as it runs, and
# `docker compose exec` reads stdin too. Everything runs inside main, called on the last line,
# so bash has parsed the whole script before any command can consume the rest of it.
main() {
  local usage='Usage: deploy.sh <compose directory> <service> <reference directory> <revision>'
  local compose_directory=${1:?$usage}
  local service=${2:?$usage}
  local reference_directory=${3:?$usage}
  local revision=${4:?$usage}

  cd "$compose_directory"

  if [ -n "$(docker compose ps --status running --quiet "$service")" ]; then
    docker compose exec -T "$service" \
      node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON backup-database.ts </dev/null
  else
    echo "$service is not running, so there is no database to back up."
  fi

  mv "$reference_directory/pack.json.gz.upload" "$reference_directory/pack.json.gz"

  docker compose pull "$service"
  docker compose up -d "$service"

  local container running
  container=$(docker compose ps --quiet "$service")
  running=$(docker inspect "$container" \
    --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
  if [ "$running" != "$revision" ]; then
    echo "$service is running revision ${running:-unknown}, not $revision: the pull did not replace the image." >&2
    exit 1
  fi
  echo "$service is running revision $revision."
}

main "$@"

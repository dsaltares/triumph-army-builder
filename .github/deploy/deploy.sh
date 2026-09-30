#!/usr/bin/env bash
set -euo pipefail

usage='Usage: deploy.sh <compose directory> <service> <reference directory> <revision>'
compose_directory=${1:?$usage}
service=${2:?$usage}
reference_directory=${3:?$usage}
revision=${4:?$usage}

cd "$compose_directory"

if [ -n "$(docker compose ps --status running --quiet "$service")" ]; then
  docker compose exec -T "$service" \
    node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON backup-database.ts
else
  echo "$service is not running, so there is no database to back up."
fi

mv "$reference_directory/pack.json.gz.upload" "$reference_directory/pack.json.gz"

docker compose pull "$service"
docker compose up -d "$service"

container=$(docker compose ps --quiet "$service")
running=$(docker inspect "$container" \
  --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
if [ "$running" != "$revision" ]; then
  echo "$service is running revision ${running:-unknown}, not $revision: the pull did not replace the image." >&2
  exit 1
fi
echo "$service is running revision $revision."

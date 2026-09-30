#!/usr/bin/env bash
set -euo pipefail

usage='Usage: deploy.sh <compose directory> <service> <reference directory>'
compose_directory=${1:?$usage}
service=${2:?$usage}
reference_directory=${3:?$usage}

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

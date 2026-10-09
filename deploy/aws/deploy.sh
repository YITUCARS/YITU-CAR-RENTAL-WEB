#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "usage: deploy.sh <s3-bucket> <s3-key>" >&2
  exit 2
fi

export AWS_REGION="${AWS_REGION:-ap-southeast-2}"
export AWS_DEFAULT_REGION="${AWS_DEFAULT_REGION:-$AWS_REGION}"
export DOCKER_BUILDKIT=1

bucket="$1"
key="$2"
base=/opt/yitu-rental
tag="$(date -u +%Y%m%dT%H%M%SZ)"
release_dir="$base/releases/$tag"
previous="$(docker image inspect yitu-rental-web:latest --format '{{.Id}}' 2>/dev/null || true)"

install -d -m 0755 "$release_dir"
aws s3 cp "s3://$bucket/$key" "$release_dir/source.tar.gz" --only-show-errors
tar --warning=no-unknown-keyword -xzf "$release_dir/source.tar.gz" -C "$release_dir"

"$base/fetch-secrets.sh"
[[ -n "$previous" ]] && docker tag yitu-rental-web:latest yitu-rental-web:previous

docker build \
  --file "$release_dir/Dockerfile" \
  --secret "id=production_env,src=$base/.env" \
  --tag "yitu-rental-web:$tag" \
  --tag yitu-rental-web:latest \
  "$release_dir"

docker compose -f "$base/compose.yml" up -d

for _ in {1..40}; do
  if [[ "$(docker inspect yitu-rental-web --format '{{.State.Health.Status}}' 2>/dev/null || true)" == healthy ]]; then
    find "$base/releases" -mindepth 1 -maxdepth 1 -type d -mtime +7 -exec rm -rf {} +
    docker image ls yitu-rental-web --format '{{.Tag}}' \
      | grep -E '^[0-9]{8}T[0-9]{6}Z$' | grep -v "^$tag$" \
      | xargs -r -I{} docker rmi "yitu-rental-web:{}" >/dev/null || true
    echo "YITU Rental is healthy ($tag)."
    exit 0
  fi
  sleep 3
done

docker logs --tail 150 yitu-rental-web >&2 || true
if [[ -n "$previous" ]]; then
  echo "Rolling back to previous image." >&2
  docker tag yitu-rental-web:previous yitu-rental-web:latest
  docker compose -f "$base/compose.yml" up -d
fi
exit 1

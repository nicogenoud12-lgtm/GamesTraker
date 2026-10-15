#!/bin/sh
# Auto-deploy for the home server: if main moved on GitHub, pull it and rebuild.
# Run it from cron every couple of minutes (see README → "Actualización automática").
# Safe to run often: it does nothing when there is nothing new, and never runs twice at once.
set -eu
export PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:$PATH"
cd "$(dirname "$0")/.."

exec 9>/tmp/gamestraker-deploy.lock
flock -n 9 || exit 0

git fetch -q origin main
target=$(git rev-parse origin/main)
# Compared with what was last deployed (not HEAD), so a failed build is retried next time.
[ "$target" = "$(cat .deployed 2>/dev/null || true)" ] && exit 0

echo "$(date '+%F %T') actualizando a $(git rev-parse --short origin/main): $(git log -1 --format=%s origin/main)"
git merge -q --ff-only origin/main
docker compose up -d --build
echo "$target" > .deployed
# Old images pile up with every build; drop the ones nothing uses anymore.
docker image prune -f >/dev/null
echo "$(date '+%F %T') listo"

#!/usr/bin/env sh
set -eu

APP_NAME="${APP_NAME:-private-audio-room}"
APP_PORT="${APP_PORT:-8787}"
AUDIO_DIR="${AUDIO_DIR:-/Audio}"
DATA_DIR="${DATA_DIR:-./data}"

if ! command -v docker >/dev/null 2>&1; then
  echo "ERROR: docker command not found. Please enable Docker on your UGREEN NAS first." >&2
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  echo "ERROR: Docker Compose not found. Please install/enable Docker Compose in UGOS Pro." >&2
  exit 1
fi

if [ ! -f package.json ] || [ ! -f Dockerfile ]; then
  echo "ERROR: please run this script from the project root directory." >&2
  exit 1
fi

if [ ! -d "$AUDIO_DIR" ]; then
  echo "Creating audio directory: $AUDIO_DIR"
  mkdir -p "$AUDIO_DIR"
fi

mkdir -p "$DATA_DIR"

cat > docker-compose.ugreen.yml <<EOF
services:
  ${APP_NAME}:
    build: .
    container_name: ${APP_NAME}
    restart: unless-stopped
    ports:
      - "${APP_PORT}:8787"
    environment:
      PORT: "8787"
      AUDIO_ROOT: /media/audio
    volumes:
      - "${AUDIO_DIR}:/media/audio:ro"
      - "${DATA_DIR}:/app/data"
EOF

echo "Deploying ${APP_NAME}..."
echo "Audio directory: ${AUDIO_DIR}"
echo "Data directory: ${DATA_DIR}"
echo "Port: ${APP_PORT}"

$COMPOSE -f docker-compose.ugreen.yml up -d --build

echo
echo "Done."
echo "Open: http://YOUR_NAS_IP:${APP_PORT}"
echo "In the app, set NAS path to: /media/audio"

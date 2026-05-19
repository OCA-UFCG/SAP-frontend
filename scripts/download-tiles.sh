#!/usr/bin/env bash
set -euo pipefail

TILES_RELEASE_TAG="${TILES_RELEASE_TAG:-tiles-2025}"
TILES_REPOSITORY="${TILES_REPOSITORY:-OCA-UFCG/SAP-frontend}"
TILES_BASE_URL="${TILES_BASE_URL:-https://github.com/${TILES_REPOSITORY}/releases/download/${TILES_RELEASE_TAG}}"
TILES_DIR="${TILES_DIR:-public/tiles}"

download_tile() {
  local file_name="$1"
  local output_path="${TILES_DIR}/${file_name}"
  local url="${TILES_BASE_URL}/${file_name}"

  echo "Downloading ${file_name} from ${url}"
  curl --fail --location --show-error --silent "${url}" --output "${output_path}"

  if [ ! -s "${output_path}" ]; then
    echo "Downloaded tile file is missing or empty: ${output_path}" >&2
    exit 1
  fi
}

mkdir -p "${TILES_DIR}"

download_tile "brazil-states.mbtiles"
download_tile "brazil-cities.mbtiles"

ls -lh "${TILES_DIR}"/*.mbtiles

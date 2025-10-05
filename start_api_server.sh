#!/usr/bin/env bash
set -euo pipefail

# Resolve project directories relative to this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="${SCRIPT_DIR}/deHATEr"
VENV_DIR="${SERVER_DIR}/.venv"

if [[ ! -d "${SERVER_DIR}" ]]; then
  echo "Error: deHATEr directory not found next to this script." >&2
  exit 1
fi

if [[ -z "${VIRTUAL_ENV:-}" && -f "${VENV_DIR}/bin/activate" ]]; then
  # Activate local virtual environment when available
  source "${VENV_DIR}/bin/activate"
fi

if ! command -v python >/dev/null 2>&1; then
  echo "Error: python not found in PATH." >&2
  exit 1
fi

cd "${SERVER_DIR}"

CMD=(python -m uvicorn api_server:app --host "${HOST:-127.0.0.1}" --port "${PORT:-8000}")

if [[ "${UVICORN_RELOAD:-0}" == "1" ]]; then
  CMD+=(--reload)
fi

exec "${CMD[@]}"

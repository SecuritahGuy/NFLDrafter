#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -e '.[dev]'
npm ci
npm --prefix frontend ci

(
  cd api
  ../.venv/bin/python cli.py init
)

echo "Bootstrap complete. Run 'make check' or 'make dev'."

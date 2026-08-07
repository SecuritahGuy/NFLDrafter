#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"

python_bin="$(command -v python3)"
if [[ -x .venv/bin/python ]] && .venv/bin/python -c 'import pytest' 2>/dev/null; then
  python_bin="$project_dir/.venv/bin/python"
fi

(cd api && "$python_bin" -m pytest)
npm --prefix frontend run test:run
"$python_bin" -m compileall -q api/app
npm --prefix frontend run build

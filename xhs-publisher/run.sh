#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NODE_BIN="/Users/a37/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
NODE_MODULES="/Users/a37/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules"

if [[ ! -x "$NODE_BIN" ]]; then
  NODE_BIN="node"
fi

export NODE_PATH="$NODE_MODULES${NODE_PATH:+:$NODE_PATH}"
exec "$NODE_BIN" "$ROOT_DIR/xhs-publisher/publisher.cjs" "$@" --config "$ROOT_DIR/xhs-publisher/config.json"

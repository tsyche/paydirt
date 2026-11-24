#!/usr/bin/env bash
# Copy production hooks plus browser-only fixtures to a NEW disposable directory.
set -euo pipefail
repo_dir=$(cd "$(dirname "$0")/.." && pwd)
dest=${1:?usage: prepare-test-hooks.sh NEW_DIRECTORY}
if [[ -e "$dest" || -L "$dest" ]]; then
    echo "Refusing to replace an existing hooks directory: $dest" >&2
    exit 1
fi
cp -R "$repo_dir/pocketbase/pb_hooks" "$dest"
cp "$repo_dir/pocketbase/test_hooks/"*.pb.js "$dest/"

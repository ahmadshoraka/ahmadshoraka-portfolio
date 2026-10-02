#!/usr/bin/env bash
# Idempotent Cloud Agent install for the Angular portfolio.
# Angular 22 requires Node ^22.22.3 || ^24.15.0 || >=26.0.0, which is newer than
# the default image's bundled Node, so pin a compatible Node into the home dir
# (persisted in the environment snapshot) and prepend it to PATH before install.
set -euo pipefail

NODE_VERSION="v22.23.2"
NODE_DIR="${HOME}/.local/node"

if [ "$("${NODE_DIR}/bin/node" -v 2>/dev/null || true)" != "${NODE_VERSION}" ]; then
  echo "Installing Node ${NODE_VERSION} into ${NODE_DIR}"
  rm -rf "${NODE_DIR}"
  mkdir -p "${NODE_DIR}"
  curl -fsSL "https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-linux-x64.tar.xz" \
    | tar -xJ -C "${NODE_DIR}" --strip-components=1
else
  echo "Node ${NODE_VERSION} already present in ${NODE_DIR}"
fi

export PATH="${NODE_DIR}/bin:${PATH}"
echo "Using node $(node -v) / npm $(npm -v)"

npm ci

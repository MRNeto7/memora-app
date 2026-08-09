#!/bin/sh
# Xcode Cloud: install JS deps before resolving Swift packages — the
# Capacitor plugin packages (camera, filesystem) are referenced from
# node_modules, which only exists after npm ci.
set -e
export HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node@20 2>/dev/null || brew install node
export PATH="/opt/homebrew/opt/node@20/bin:$PATH"
node --version
cd "$CI_PRIMARY_REPOSITORY_PATH"
npm ci

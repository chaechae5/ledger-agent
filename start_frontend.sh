#!/bin/bash
export PATH="/opt/homebrew/Cellar/node/25.9.0_1/bin:$PATH"
cd "$(dirname "$0")/frontend"
exec node node_modules/.bin/vite

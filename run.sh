#!/bin/bash

# ==========================================
# KekoSuite - v1.0.5 (TUI Edition)
# ==========================================

BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR" || exit

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

if [ ! -f ".env" ]; then
    node core/setup.js
    if [ ! -f ".env" ]; then
        exit 1
    fi
fi

# Inicia la interfaz interactiva de Node.js
node core/menu.js

#!/bin/bash

# ==========================================
# KekoSuite - Instalador de Comando Global
# ==========================================

# 1. Obtener la ruta absoluta de la carpeta actual
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_PATH="$HOME/.local/bin"
COMMAND_NAME="kekosuite"

echo "Instalando $COMMAND_NAME..."

# 2. Asegurar que los scripts sean ejecutables
chmod +x "$BASE_DIR/run.sh"
chmod +x "$BASE_DIR/scripts/monitor.sh"
chmod +x "$BASE_DIR/scripts/vps_autostart.sh"

# 3. Crear carpeta bin local si no existe
mkdir -p "$BIN_PATH"

# 4. Crear el enlace simbólico
if [ -L "$BIN_PATH/$COMMAND_NAME" ]; then
    rm "$BIN_PATH/$COMMAND_NAME"
fi
ln -s "$BASE_DIR/run.sh" "$BIN_PATH/$COMMAND_NAME"

# 5. Asegurar que ~/.local/bin esté en el PATH
if [[ ":$PATH:" != *":$BIN_PATH:"* ]]; then
    echo "Añadiendo $BIN_PATH al PATH en .bashrc..."
    echo "" >> "$HOME/.bashrc"
    echo "# KekoSuite Path" >> "$HOME/.bashrc"
    echo "export PATH=\"\$PATH:$BIN_PATH\"" >> "$HOME/.bashrc"
    echo "✅ Instalación completada. Por favor, reinicia tu terminal o ejecuta: source ~/.bashrc"
else
    echo "✅ Instalación completada. Ya puedes usar el comando '$COMMAND_NAME' desde cualquier lugar."
fi

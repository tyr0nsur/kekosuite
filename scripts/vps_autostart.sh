#!/bin/bash

# ==========================================
# KekoSuite - VPS AutoStart (Crontab @reboot)
# ==========================================

# 1. Esperar un tiempo prudencial
sleep 60

# 2. Definir rutas dinámicamente
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUTO_RESTART_FLAG="$BASE_DIR/.emulator_auto_restart"
LOG_FILE="$BASE_DIR/logs/monitor.log"

# 3. Obtener datos dinámicos
cd "$BASE_DIR" || exit
JAR_NAME=$(node -e "try { console.log(require('./config.json').emulator_jar_name) } catch(e) { console.log('') }")
LIVE_PATH=$(node -e "try { console.log(require('./config.json').emulator_live_path) } catch(e) { console.log('') }")
MIN_RAM=$(node -e "try { console.log(require('./config.json').emulator_min_ram) } catch(e) { console.log('1G') }")
MAX_RAM=$(node -e "try { console.log(require('./config.json').emulator_max_ram) } catch(e) { console.log('2G') }")

JAR_NAME=${JAR_NAME:-"Habbo-3.6.0-jar-with-dependencies.jar"}
LIVE_PATH=${LIVE_PATH:-"/home/surcity-hotel/emulator/Emulator"}

# 4. Activar el flag de auto-reinicio
touch "$AUTO_RESTART_FLAG"

# 5. Iniciar el emulador en screen
if ! screen -list | grep -q "\.emulator"; then
    cd "$LIVE_PATH" || exit
    screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME"
    echo "[$(date)] [AUTOSTART] Emulador iniciado tras reboot (RAM: ${MIN_RAM}/${MAX_RAM})" >> "$LOG_FILE"
else
    echo "[$(date)] [AUTOSTART] El emulador ya estaba en ejecución tras el reboot." >> "$LOG_FILE"
fi

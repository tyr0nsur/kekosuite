#!/bin/bash

# ==========================================
# KekoSuite - Monitor de Estado (Cron)
# ==========================================

# Determinar directorio base dinámicamente para portabilidad
BASE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AUTO_RESTART_FLAG="$BASE_DIR/.emulator_auto_restart"
LOG_FILE="$BASE_DIR/logs/monitor.log"

# 1. Verificar si el auto-reinicio está activado
if [ -f "$AUTO_RESTART_FLAG" ]; then
    
    # 2. Obtener configuración dinámica
    cd "$BASE_DIR" || exit
    JAR_NAME=$(node -e "try { console.log(require('./config.json').emulator_jar_name) } catch(e) { console.log('') }")
    LIVE_PATH=$(node -e "try { console.log(require('./config.json').emulator_live_path) } catch(e) { console.log('') }")
    MIN_RAM=$(node -e "try { console.log(require('./config.json').emulator_min_ram) } catch(e) { console.log('1G') }")
    MAX_RAM=$(node -e "try { console.log(require('./config.json').emulator_max_ram) } catch(e) { console.log('2G') }")

    # Valores por defecto
    JAR_NAME=${JAR_NAME:-"Habbo-3.6.0-jar-with-dependencies.jar"}
    LIVE_PATH=${LIVE_PATH:-"/home/surcity-hotel/emulator/Emulator"}

    # 3. Comprobar si el proceso está corriendo
    if ! ps aux | grep -v grep | grep "$JAR_NAME" > /dev/null; then
        echo "[$(date)] [MONITOR] El emulador ($JAR_NAME) está caído. Reiniciando..." >> "$LOG_FILE"
        
        cd "$LIVE_PATH" || exit
        screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME"
        
        echo "[$(date)] [MONITOR] Reinicio completado con RAM: ${MIN_RAM}/${MAX_RAM}" >> "$LOG_FILE"
    fi
fi

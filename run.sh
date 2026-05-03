#!/bin/bash

# ==========================================
# KekoSuite - v1.0.0
# ==========================================

# Portabilidad: Determinar directorio base
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR" || exit

# Cargar NVM si existe
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Colores ANSI
RED='\e[31m'
GREEN='\e[32m'
YELLOW='\e[33m'
BLUE='\e[34m'
MAGENTA='\e[35m'
CYAN='\e[36m'
WHITE='\e[37m'
BOLD='\e[1m'
RESET='\e[0m'

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}No se encontró el archivo .env. Iniciando asistente...${RESET}"
    node core/setup.js
    if [ ! -f ".env" ]; then
        echo -e "${RED}Configuración cancelada.${RESET}"
        exit 1
    fi
fi

print_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo ' $$\   $$\          $$\                  $$$$$$\            $$\   $$\               '
    echo ' $$ | $$  |         $$ |                $$  __$$\           \__|  $$ |              '
    echo ' $$ |$$  / $$$$$$\  $$ |  $$\  $$$$$$\  $$ /  \__|$$\   $$\ $$\ $$$$$$\    $$$$$$\  '
    echo ' $$$$$  / $$  __$$\ $$ | $$  |$$  __$$\ \$$$$$$\  $$ |  $$ |$$ |\_$$  _|  $$  __$$\ '
    echo ' $$  $$<  $$$$$$$$ |$$$$$$  / $$ /  $$ | \____$$\ $$ |  $$ |$$ |  $$ |    $$$$$$$$ |'
    echo ' $$ |\$$\ $$   ____|$$  _$$<  $$ |  $$ |$$\   $$ |$$ |  $$ |$$ |  $$ |$$\ $$   ____|'
    echo ' $$ | \$$\\$$$$$$$\ $$ | \$$\ \$$$$$$  |\$$$$$$  |\$$$$$$  |$$ |  \$$$$  |\$$$$$$$\ '
    echo ' \__|  \__|\_______|\__|  \__| \______/  \______/  \______/ \__|   \____/  \_______|'
    echo -e "${RESET}"
    echo -e "       ${MAGENTA}[~] KekoSuite v1.0.0 [#] Made by eMiLiOp [~]${RESET}"
    echo -e "${CYAN}==========================================${RESET}"
}

# Auxiliares de Servidor
check_status() {
    JAR_NAME=$(node -e "try { console.log(require('./config.js').emulator_jar_name) } catch(e) { console.log('') }")
    if ps aux | grep -v grep | grep "$JAR_NAME" > /dev/null; then
        SERVER_STATUS="${GREEN}ENCENDIDO${RESET}"
        IS_RUNNING=true
    else
        SERVER_STATUS="${RED}APAGADO${RESET}"
        IS_RUNNING=false
    fi

    if [ -f "./.emulator_auto_restart" ]; then
        AUTO_START_STATUS="${GREEN}ACTIVO${RESET}"
        AUTO_START=true
    else
        AUTO_START_STATUS="${RED}INACTIVO${RESET}"
        AUTO_START=false
    fi
}

cambiar_version() {
    echo -e "${YELLOW}Buscando versiones disponibles...${RESET}"
    LIVE_PATH=$(node -e "console.log(require('./config.js').emulator_live_path)")
    jars=($(ls "$LIVE_PATH"/*.jar 2>/dev/null | xargs -n 1 basename))
    if [ ${#jars[@]} -eq 0 ]; then
        echo -e "${RED}No se encontraron archivos .jar en $LIVE_PATH${RESET}"
    else
        echo -e "Versiones disponibles:"
        for i in "${!jars[@]}"; do
            echo -e " ${CYAN}$((i+1)))${RESET} ${jars[$i]}"
        done
        echo -ne "${BOLD}Selecciona una versión [1-${#jars[@]}]: ${RESET}"
        read jar_choice
        if [[ "$jar_choice" -ge 1 && "$jar_choice" -le "${#jars[@]}" ]]; then
            SELECTED_JAR="${jars[$((jar_choice-1))]}"
            node -e "
                const fs = require('fs');
                let env = fs.readFileSync('./.env', 'utf8');
                env = env.replace(/^EMULATOR_JAR_NAME=.*$/m, 'EMULATOR_JAR_NAME=\"$SELECTED_JAR\"');
                fs.writeFileSync('./.env', env);
            "
            echo -e "✅ ${BOLD}Versión cambiada a $SELECTED_JAR.${RESET}"
        else
            echo -e "${RED}Opción inválida.${RESET}"
        fi
    fi
}

cambiar_ram() {
    print_header
    echo -e "   ${YELLOW}🧠 CONFIGURACIÓN DE MEMORIA RAM${RESET}"
    echo -e "${CYAN}==========================================${RESET}"
    CUR_MIN=$(node -e "try { console.log(require('./config.js').emulator_min_ram) } catch(e) { console.log('1G') }")
    CUR_MAX=$(node -e "try { console.log(require('./config.js').emulator_max_ram) } catch(e) { console.log('2G') }")
    
    echo -e " RAM Actual: ${CYAN}Mín: $CUR_MIN / Máx: $CUR_MAX${RESET}"
    echo -e "${CYAN}==========================================${RESET}"
    echo -ne " Nueva RAM Mínima (ej: 1G, 512M) [Enter para omitir]: "
    read n_min
    echo -ne " Nueva RAM Máxima (ej: 4G, 2G) [Enter para omitir]: "
    read n_max
    
    node -e "
        const fs = require('fs');
        let env = fs.readFileSync('./.env', 'utf8');
        if ('$n_min') env = env.replace(/^EMULATOR_MIN_RAM=.*$/m, 'EMULATOR_MIN_RAM=\"$n_min\"');
        if ('$n_max') env = env.replace(/^EMULATOR_MAX_RAM=.*$/m, 'EMULATOR_MAX_RAM=\"$n_max\"');
        fs.writeFileSync('./.env', env);
    "
    echo -e "✅ ${BOLD}Configuración de RAM actualizada.${RESET}"
}

# Submenús
menu_furnis() {
    while true; do
        print_header
        echo -e "   ${YELLOW}🛋️  GESTIÓN DE FURNIS Y ROPA${RESET}"
        echo -e "${CYAN}==========================================${RESET}"
        echo -e " ${GREEN}1)${RESET} Sincronizador Maestro"
        echo -e " ${GREEN}2)${RESET} Sincronizador de Ropa"
        echo -e " ${GREEN}3)${RESET} Importador Manual"
        echo -e " ${GREEN}4)${RESET} Reparador de Furnis"
        echo -e " ${GREEN}5)${RESET} Actualizador de Nombres (Traductor)"
        echo -e " ${GREEN}6)${RESET} Generar Ofertas Especiales (Target Offers)"
        echo -e " ${RED}0)${RESET} Volver al Menú Principal"
        echo -e "${CYAN}==========================================${RESET}"
        echo -ne "Selecciona [0-6]: "
        read opt; case $opt in
            1) node core/mass_syncer.js; read -p "Enter..." ;;
            2) node core/auto_clothing_importer.js; read -p "Enter..." ;;
            3) node core/index.js; read -p "Enter..." ;;
            4) node core/furni_fixer.js; read -p "Enter..." ;;
            5) node core/name_updater.js; read -p "Enter..." ;;
            6) node core/offers_generator.js; read -p "Enter..." ;;
            0) return ;;
        esac
    done
}

menu_mantenimiento() {
    while true; do
        print_header
        echo -e "   ${YELLOW}🛠️  MANTENIMIENTO${RESET}"
        echo -e "${CYAN}==========================================${RESET}"
        echo -e " ${GREEN}1)${RESET} Escanear Cuadrados Negros"
        echo -e " ${GREEN}2)${RESET} Encontrar Duplicados"
        echo -e " ${GREEN}3)${RESET} Limpiar Huérfanos"
        echo -e " ${GREEN}4)${RESET} Editor Masivo de Precios"
        echo -e " ${GREEN}5)${RESET} Limpiar Catálogo (Páginas rotas e Items fantasma)"
        echo -e " ${GREEN}6)${RESET} Descargar Iconos Faltantes (Auto-Download PNGs)"
        echo -e " ${RED}0)${RESET} Volver"
        echo -e "${CYAN}==========================================${RESET}"
        echo -ne "Selecciona [0-6]: "
        read opt; case $opt in
            1) node core/broken_furni_scanner.js; read -p "Enter..." ;;
            2) node core/duplicate_finder.js; read -p "Enter..." ;;
            3) node core/orphan_cleaner.js; read -p "Enter..." ;;
            4) node core/mass_price_updater.js; read -p "Enter..." ;;
            5) node core/catalog_cleaner.js; read -p "Enter..." ;;
            6) node core/icon_fetcher.js; read -p "Enter..." ;;
            0) return ;;
        esac
    done
}

menu_actualizaciones() {
    while true; do
        print_header
        echo -e "   ${YELLOW}🔄 ACTUALIZACIONES${RESET}"
        echo -e "${CYAN}==========================================${RESET}"
        echo -e " ${GREEN}1)${RESET} Comprobar Novedades"
        echo -e " ${GREEN}2)${RESET} Actualizar CMS"
        echo -e " ${GREEN}3)${RESET} Actualizar Emulador"
        echo -e " ${RED}0)${RESET} Volver"
        echo -e "${CYAN}==========================================${RESET}"
        echo -ne "Selecciona [0-3]: "
        read opt; case $opt in
            1) node core/update_checker.js; read -p "Enter..." ;;
            2) node core/cms_updater.js; read -p "Enter..." ;;
            3) node core/emulator_updater.js; read -p "Enter..." ;;
            0) return ;;
        esac
    done
}

menu_servidor() {
    while true; do
        check_status
        print_header
        echo -e "   ${YELLOW}⚙️  CONTROL DEL SERVIDOR${RESET}"
        echo -e "${CYAN}==========================================${RESET}"
        echo -e " ESTADO: $SERVER_STATUS | AUTO-REINICIO: $AUTO_START_STATUS"
        echo -e "${CYAN}==========================================${RESET}"

        if [ "$IS_RUNNING" = false ]; then
            echo -e " ${GREEN}1)${RESET} Encender (Auto-Start ON)"
            echo -e " ${GREEN}2)${RESET} Encender (Auto-Start OFF)"
            echo -e " ${CYAN}3)${RESET} Cambiar Versión"
            echo -e " ${YELLOW}4)${RESET} Configurar RAM"
            MAX=4
        else
            echo -e " ${RED}1)${RESET} Apagar Emulador"
            echo -e " ${YELLOW}2)${RESET} Reiniciar"
            echo -e " ${BLUE}3)${RESET} Alternar Auto-Reinicio"
            echo -e " ${GREEN}4)${RESET} Ver Consola"
            echo -e " ${CYAN}5)${RESET} Cambiar Versión"
            echo -e " ${YELLOW}6)${RESET} Configurar RAM"
            MAX=6
        fi
        echo -e " ${RED}0)${RESET} Volver"
        echo -ne "\nSelecciona [0-$MAX]: "
        read opt_s

    JAR_NAME=$(node -e "try { console.log(require('./config.js').emulator_jar_name) } catch(e) { console.log('') }")
    LIVE_PATH=$(node -e "try { console.log(require('./config.js').emulator_live_path) } catch(e) { console.log('') }")
    MIN_RAM=$(node -e "try { console.log(require('./config.js').emulator_min_ram) } catch(e) { console.log('1G') }")
    MAX_RAM=$(node -e "try { console.log(require('./config.js').emulator_max_ram) } catch(e) { console.log('2G') }")

        case $opt_s in
            0) return ;;
            1)
                if [ "$IS_RUNNING" = false ]; then
                    touch ./.emulator_auto_restart
                    (cd "$LIVE_PATH" && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME")
                else
                    rm -f ./.emulator_auto_restart
                    pkill -f "$JAR_NAME"; screen -S emulator -X quit 2>/dev/null
                fi; read -p "Enter..." ;;
            2)
                if [ "$IS_RUNNING" = false ]; then
                    rm -f ./.emulator_auto_restart
                    (cd "$LIVE_PATH" && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME")
                else
                    pkill -f "$JAR_NAME"; sleep 2; screen -S emulator -X quit 2>/dev/null
                    (cd "$LIVE_PATH" && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME")
                fi; read -p "Enter..." ;;
            3)
                if [ "$IS_RUNNING" = false ]; then cambiar_version; else
                    [ -f "./.emulator_auto_restart" ] && rm ./.emulator_auto_restart || touch ./.emulator_auto_restart
                fi; read -p "Enter..." ;;
            4)
                if [ "$IS_RUNNING" = true ]; then screen -r emulator; else cambiar_ram; read -p "Enter..."; fi ;;
            5) [ "$IS_RUNNING" = true ] && cambiar_version && read -p "Enter..." ;;
            6) [ "$IS_RUNNING" = true ] && cambiar_ram && read -p "Enter..." ;;
        esac
    done
}

# Menú Principal
while true; do
    print_header
    echo -e " ${CYAN}1)${RESET} Gestión de Furnis y Ropa"
    echo -e " ${CYAN}2)${RESET} Mantenimiento y Optimización"
    echo -e " ${CYAN}3)${RESET} Gestión de Actualizaciones"
    echo -e " ${CYAN}4)${RESET} Control del Servidor"
    echo -e " ${RED}0)${RESET} Salir"
    echo -e "=========================================="
    echo -ne "Selecciona [0-4]: "
    read opcion; case $opcion in
        1) menu_furnis ;;
        2) menu_mantenimiento ;;
        3) menu_actualizaciones ;;
        4) menu_servidor ;;
        0) exit 0 ;;
    esac
done

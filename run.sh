#!/bin/bash

# ==========================================
# KekoSuite - v1.0.5 (Premium UI)
# ==========================================

# Portabilidad: Determinar directorio base
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$BASE_DIR" || exit

# Cargar NVM si existe
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Colores ANSI
RED='\e[38;5;196m'
GREEN='\e[38;5;46m'
YELLOW='\e[38;5;226m'
BLUE='\e[38;5;33m'
MAGENTA='\e[38;5;201m'
CYAN='\e[38;5;51m'
WHITE='\e[38;5;231m'
GRAY='\e[38;5;240m'
BOLD='\e[1m'
RESET='\e[0m'

if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No se encontró el archivo .env. Iniciando asistente...${RESET}"
    node core/setup.js
    if [ ! -f ".env" ]; then
        echo -e "${RED}❌ Configuración cancelada.${RESET}"
        exit 1
    fi
fi

print_header() {
    clear
    echo -e "${CYAN}${BOLD}"
    echo '  _  __    _          _____       _ _       '
    echo ' | |/ /___| |_____   / ____|     (_) |      '
    echo ' |   // _ \ |/ / _ \ | (___  _   _ _| |_ ___'
    echo ' |  <|  __/   < (_) | \___ \| | | | | __/ _ \'
    echo ' |   \>___|_|\_\___/  ____) | |_| | | ||  __/'
    echo ' |_|\_\              |_____/ \__,_|_|\__\___|'
    echo -e "${RESET}"
    echo -e "${MAGENTA} ╭─────────────────────────────────────────────╮${RESET}"
    echo -e "${MAGENTA} │${RESET}    ${WHITE}${BOLD}KekoSuite v1.0.5${RESET} ${GRAY}—${RESET} ${CYAN}Made by eMiLiOp${RESET}     ${MAGENTA}│${RESET}"
    echo -e "${MAGENTA} ╰─────────────────────────────────────────────╯${RESET}"
    echo ""
}

# Auxiliares de Servidor
check_status() {
    JAR_NAME=$(node -e "try { console.log(require('./config.js').emulator_jar_name) } catch(e) { console.log('') }")
    if ps aux | grep -v grep | grep "$JAR_NAME" > /dev/null; then
        SERVER_STATUS="${GREEN}● ENCENDIDO${RESET}"
        IS_RUNNING=true
    else
        SERVER_STATUS="${RED}○ APAGADO${RESET}"
        IS_RUNNING=false
    fi

    if [ -f "./.emulator_auto_restart" ]; then
        AUTO_START_STATUS="${GREEN}Activo${RESET}"
        AUTO_START=true
    else
        AUTO_START_STATUS="${GRAY}Inactivo${RESET}"
        AUTO_START=false
    fi
}

cambiar_version() {
    echo -e "\n${CYAN} ╭── ${WHITE}${BOLD}SELECCIÓN DE VERSIÓN${RESET}${CYAN} ─────────────────────${RESET}"
    LIVE_PATH=$(node -e "console.log(require('./config.js').emulator_live_path)")
    jars=($(ls "$LIVE_PATH"/*.jar 2>/dev/null | xargs -n 1 basename))
    if [ ${#jars[@]} -eq 0 ]; then
        echo -e "${CYAN} │${RESET}  ${RED}No se encontraron archivos .jar en $LIVE_PATH${RESET}"
    else
        for i in "${!jars[@]}"; do
            echo -e "${CYAN} │${RESET}  ${GREEN}[ $((i+1)) ]${RESET} ${jars[$i]}"
        done
        echo -e "${CYAN} ╰───────────────────────────────────────────────${RESET}"
        echo -ne " ${MAGENTA}❯${RESET} Selecciona una versión [1-${#jars[@]}]: "
        read jar_choice
        if [[ "$jar_choice" -ge 1 && "$jar_choice" -le "${#jars[@]}" ]]; then
            SELECTED_JAR="${jars[$((jar_choice-1))]}"
            node -e "
                const fs = require('fs');
                let env = fs.readFileSync('./.env', 'utf8');
                env = env.replace(/^EMULATOR_JAR_NAME=.*$/m, 'EMULATOR_JAR_NAME=\"$SELECTED_JAR\"');
                fs.writeFileSync('./.env', env);
            "
            echo -e " ${GREEN}✔ Versión actualizada a $SELECTED_JAR.${RESET}"
        else
            echo -e " ${RED}✖ Opción inválida.${RESET}"
        fi
    fi
}

cambiar_ram() {
    print_header
    CUR_MIN=$(node -e "try { console.log(require('./config.js').emulator_min_ram) } catch(e) { console.log('1G') }")
    CUR_MAX=$(node -e "try { console.log(require('./config.js').emulator_max_ram) } catch(e) { console.log('2G') }")
    
    echo -e "${CYAN} ╭── ${WHITE}${BOLD}CONFIGURACIÓN DE MEMORIA RAM${RESET}${CYAN} ─────────────${RESET}"
    echo -e "${CYAN} │${RESET}  Actual: ${WHITE}Min: ${GREEN}$CUR_MIN${WHITE} / Max: ${GREEN}$CUR_MAX${RESET}"
    echo -e "${CYAN} ╰───────────────────────────────────────────────${RESET}"
    echo -ne " ${MAGENTA}❯${RESET} Nueva RAM Mínima (ej: 1G, 512M) [Enter para omitir]: "
    read n_min
    echo -ne " ${MAGENTA}❯${RESET} Nueva RAM Máxima (ej: 4G, 2G) [Enter para omitir]: "
    read n_max
    
    node -e "
        const fs = require('fs');
        let env = fs.readFileSync('./.env', 'utf8');
        if ('$n_min') env = env.replace(/^EMULATOR_MIN_RAM=.*$/m, 'EMULATOR_MIN_RAM=\"$n_min\"');
        if ('$n_max') env = env.replace(/^EMULATOR_MAX_RAM=.*$/m, 'EMULATOR_MAX_RAM=\"$n_max\"');
        fs.writeFileSync('./.env', env);
    "
    echo -e "\n ${GREEN}✔ Configuración de RAM actualizada.${RESET}"
}

# Submenús
menu_furnis() {
    while true; do
        print_header
        echo -e "${CYAN} ╭── ${WHITE}${BOLD}GESTIÓN DE FURNIS Y ROPA${RESET}${CYAN} ─────────────────${RESET}"
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 1 ]${RESET} 📦 Sincronizador Maestro (API)"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 2 ]${RESET} 👕 Sincronizador de Ropa"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 3 ]${RESET} 📥 Importador Manual"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 4 ]${RESET} 🔧 Reparador de Furnis Rotos"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 5 ]${RESET} 🔤 Traductor de Nombres (Auto)"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 6 ]${RESET} 🎁 Generar Ofertas Especiales (Targets)"
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GRAY}[ 0 ]${RESET} Volver al Menú Principal"
        echo -e "${CYAN} ╰───────────────────────────────────────────────${RESET}"
        echo -ne " ${MAGENTA}❯${RESET} "
        read opt; echo ""; case $opt in
            1) node core/mass_syncer.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            2) node core/auto_clothing_importer.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            3) node core/index.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            4) node core/furni_fixer.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            5) node core/name_updater.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            6) node core/offers_generator.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            0) return ;;
        esac
    done
}

menu_mantenimiento() {
    while true; do
        print_header
        echo -e "${CYAN} ╭── ${WHITE}${BOLD}MANTENIMIENTO Y OPTIMIZACIÓN${RESET}${CYAN} ─────────────${RESET}"
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 1 ]${RESET} ⬛ Escanear Cuadrados Negros (Icons)"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 2 ]${RESET} 🗂️  Encontrar Muebles Duplicados"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 3 ]${RESET} 🧹 Limpiar Items_base Huérfanos"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 4 ]${RESET} 💰 Editor Masivo de Precios"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 5 ]${RESET} 🗑️  Limpiar Catálogo (Huérfanos/Páginas rotas)"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 6 ]${RESET} 🖼️  Descargar Iconos Faltantes (PNGs)"
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GRAY}[ 0 ]${RESET} Volver al Menú Principal"
        echo -e "${CYAN} ╰───────────────────────────────────────────────${RESET}"
        echo -ne " ${MAGENTA}❯${RESET} "
        read opt; echo ""; case $opt in
            1) node core/broken_furni_scanner.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            2) node core/duplicate_finder.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            3) node core/orphan_cleaner.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            4) node core/mass_price_updater.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            5) node core/catalog_cleaner.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            6) node core/icon_fetcher.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            0) return ;;
        esac
    done
}

menu_actualizaciones() {
    while true; do
        print_header
        echo -e "${CYAN} ╭── ${WHITE}${BOLD}GESTIÓN DE ACTUALIZACIONES${RESET}${CYAN} ───────────────${RESET}"
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 1 ]${RESET} 🌐 Comprobar Novedades de HabboFurni"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 2 ]${RESET} 🖥️  Actualizar CMS"
        echo -e "${CYAN} │${RESET}  ${GREEN}[ 3 ]${RESET} 🚀 Actualizar Emulador Arcturus"
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GRAY}[ 0 ]${RESET} Volver al Menú Principal"
        echo -e "${CYAN} ╰───────────────────────────────────────────────${RESET}"
        echo -ne " ${MAGENTA}❯${RESET} "
        read opt; echo ""; case $opt in
            1) node core/update_checker.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            2) node core/cms_updater.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            3) node core/emulator_updater.js; echo -ne "\n${GRAY}Presiona Enter para continuar...${RESET}"; read ;;
            0) return ;;
        esac
    done
}

menu_servidor() {
    while true; do
        check_status
        print_header
        echo -e "${CYAN} ╭── ${WHITE}${BOLD}CONTROL DEL SERVIDOR${RESET}${CYAN} ─────────────────────${RESET}"
        echo -e "${CYAN} │${RESET}  ESTADO: $SERVER_STATUS ${CYAN}│${RESET} REINICIO AUTOMÁTICO: $AUTO_START_STATUS"
        echo -e "${CYAN} ├───────────────────────────────────────────────${RESET}"
        echo -e "${CYAN} │${RESET}"

        if [ "$IS_RUNNING" = false ]; then
            echo -e "${CYAN} │${RESET}  ${GREEN}[ 1 ]${RESET} ▶ Encender Servidor (Con Auto-Start)"
            echo -e "${CYAN} │${RESET}  ${GREEN}[ 2 ]${RESET} ▷ Encender Servidor (Sin Auto-Start)"
            echo -e "${CYAN} │${RESET}  ${YELLOW}[ 3 ]${RESET} 🔄 Cambiar Versión de Emulador"
            echo -e "${CYAN} │${RESET}  ${BLUE}[ 4 ]${RESET} 🧠 Configurar Asignación de RAM"
            MAX=4
        else
            echo -e "${CYAN} │${RESET}  ${RED}[ 1 ]${RESET} ⏹ Apagar Servidor"
            echo -e "${CYAN} │${RESET}  ${YELLOW}[ 2 ]${RESET} 🔃 Reiniciar Servidor"
            echo -e "${CYAN} │${RESET}  ${CYAN}[ 3 ]${RESET} ♾️  Alternar Auto-Reinicio (Cron)"
            echo -e "${CYAN} │${RESET}  ${GREEN}[ 4 ]${RESET} 📺 Ver Consola en Vivo (Screen)"
            echo -e "${CYAN} │${RESET}  ${YELLOW}[ 5 ]${RESET} 🔄 Cambiar Versión de Emulador"
            echo -e "${CYAN} │${RESET}  ${BLUE}[ 6 ]${RESET} 🧠 Configurar Asignación de RAM"
            MAX=6
        fi
        echo -e "${CYAN} │${RESET}"
        echo -e "${CYAN} │${RESET}  ${GRAY}[ 0 ]${RESET} Volver al Menú Principal"
        echo -e "${CYAN} ╰───────────────────────────────────────────────${RESET}"
        echo -ne " ${MAGENTA}❯${RESET} "
        read opt_s

        JAR_NAME=$(node -e "try { console.log(require('./config.js').emulator_jar_name) } catch(e) { console.log('') }")
        LIVE_PATH=$(node -e "try { console.log(require('./config.js').emulator_live_path) } catch(e) { console.log('') }")
        MIN_RAM=$(node -e "try { console.log(require('./config.js').emulator_min_ram) } catch(e) { console.log('1G') }")
        MAX_RAM=$(node -e "try { console.log(require('./config.js').emulator_max_ram) } catch(e) { console.log('2G') }")

        echo ""
        case $opt_s in
            0) return ;;
            1)
                if [ "$IS_RUNNING" = false ]; then
                    touch ./.emulator_auto_restart
                    (cd "$LIVE_PATH" && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME")
                    echo -e " ${GREEN}✔ Servidor iniciando en segundo plano.${RESET}"
                else
                    rm -f ./.emulator_auto_restart
                    pkill -f "$JAR_NAME"; screen -S emulator -X quit 2>/dev/null
                    echo -e " ${RED}✔ Servidor apagado.${RESET}"
                fi; echo -ne "\n${GRAY}Presiona Enter...${RESET}"; read ;;
            2)
                if [ "$IS_RUNNING" = false ]; then
                    rm -f ./.emulator_auto_restart
                    (cd "$LIVE_PATH" && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME")
                    echo -e " ${GREEN}✔ Servidor iniciando en segundo plano.${RESET}"
                else
                    echo -e " ${YELLOW}Reiniciando servidor...${RESET}"
                    pkill -f "$JAR_NAME"; sleep 2; screen -S emulator -X quit 2>/dev/null
                    (cd "$LIVE_PATH" && screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "$JAR_NAME")
                    echo -e " ${GREEN}✔ Servidor reiniciado.${RESET}"
                fi; echo -ne "\n${GRAY}Presiona Enter...${RESET}"; read ;;
            3)
                if [ "$IS_RUNNING" = false ]; then cambiar_version; else
                    if [ -f "./.emulator_auto_restart" ]; then
                        rm ./.emulator_auto_restart
                        echo -e " ${GRAY}Auto-reinicio desactivado.${RESET}"
                    else
                        touch ./.emulator_auto_restart
                        echo -e " ${GREEN}Auto-reinicio activado.${RESET}"
                    fi
                fi; echo -ne "\n${GRAY}Presiona Enter...${RESET}"; read ;;
            4)
                if [ "$IS_RUNNING" = true ]; then screen -r emulator; else cambiar_ram; echo -ne "\n${GRAY}Presiona Enter...${RESET}"; read; fi ;;
            5) [ "$IS_RUNNING" = true ] && cambiar_version && echo -ne "\n${GRAY}Presiona Enter...${RESET}" && read ;;
            6) [ "$IS_RUNNING" = true ] && cambiar_ram && echo -ne "\n${GRAY}Presiona Enter...${RESET}" && read ;;
        esac
    done
}

# Menú Principal
while true; do
    print_header
    echo -e "${CYAN} ╭── ${WHITE}${BOLD}MENÚ PRINCIPAL${RESET}${CYAN} ─────────────────────────────${RESET}"
    echo -e "${CYAN} │${RESET}"
    echo -e "${CYAN} │${RESET}  ${GREEN}[ 1 ]${RESET} 🛋️  Gestión de Furnis y Ropa"
    echo -e "${CYAN} │${RESET}  ${GREEN}[ 2 ]${RESET} 🛠️  Mantenimiento y Optimización"
    echo -e "${CYAN} │${RESET}  ${GREEN}[ 3 ]${RESET} 🔄 Gestión de Actualizaciones"
    echo -e "${CYAN} │${RESET}  ${GREEN}[ 4 ]${RESET} ⚙️  Control del Servidor"
    echo -e "${CYAN} │${RESET}"
    echo -e "${CYAN} │${RESET}  ${RED}[ 0 ]${RESET} ❌ Salir del Sistema"
    echo -e "${CYAN} ╰─────────────────────────────────────────────────${RESET}"
    echo -ne " ${MAGENTA}❯${RESET} "
    read opcion; case $opcion in
        1) menu_furnis ;;
        2) menu_mantenimiento ;;
        3) menu_actualizaciones ;;
        4) menu_servidor ;;
        0) clear; echo -e "\n${CYAN}¡Hasta pronto!${RESET}\n"; exit 0 ;;
    esac
done

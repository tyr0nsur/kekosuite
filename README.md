KekoSuite v1.0.0 (FIRST RELEASE 2026) By eMiLiOp

Herramienta profesional para la gestión de emuladores Arcturus Morningstar, catálogo de furnis, ropa y mantenimiento de base de datos.

## 📁 Estructura del Proyecto

- `run.sh`: Punto de entrada principal (CLI).
- `config.json`: Configuración general y rutas del servidor.
- `core/`: Lógica interna y herramientas en JavaScript.
- `scripts/`: Scripts automatizados para Crontab (Auto-start y Monitor).
- `logs/`: Historial de eventos y estados del emulador.

## 🚀 Instalación y Uso

Para poder usar el comando `kekosuite` desde cualquier lugar, ejecuta el instalador una sola vez:

./install.sh


Una vez instalado, simplemente escribe: kekosuite


## ⚙️ Automatización (Crontab)

Si has movido la carpeta de KekoSuite, asegúrate de actualizar tu `crontab -e` con las nuevas rutas.

Ejemplo recomendado:

# Iniciar automáticamente tras reinicio del VPS
@reboot /home/surcity-hotel/tools/kekosuite/scripts/vps_autostart.sh

# Monitor de estado cada minuto (auto-reinicio si cae)
* * * * * /home/surcity-hotel/tools/kekosuite/scripts/monitor.sh

## 🧠 Configuración de RAM
Puedes ajustar la memoria dedicada al emulador desde el menú de **Control del Servidor > Configurar RAM**. Los cambios se aplicarán en el siguiente reinicio del emulador.

---
*Desarrollado para la gestión eficiente de hoteles Keko privados.*

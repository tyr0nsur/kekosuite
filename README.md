<p align="center">
  <img src="https://i.imgur.com/uR2i1n1.png" alt="KekoSuite Logo" width="150" height="150" style="border-radius: 20px;">
</p>

<h1 align="center">KekoSuite</h1>

<p align="center">
  <strong>El motor definitivo de automatización y gestión para hoteles Keko (Arcturus / Nitro).</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Versión-1.0.0-blue.svg?style=flat-square" alt="Version">
  <img src="https://img.shields.io/badge/Autor-eMiLiOp-orange.svg?style=flat-square" alt="Author">
  <img src="https://img.shields.io/badge/Soporte-Arcturus%20Morningstar-green.svg?style=flat-square" alt="Support">
  <img src="https://img.shields.io/badge/Entorno-Linux%20CLI-lightgrey.svg?style=flat-square" alt="CLI">
</p>

---

## 📖 Acerca de KekoSuite

**KekoSuite** es una potente interfaz CLI (Command Line Interface) desarrollada en Node.js y Bash diseñada para administradores y dueños de retroservidores Habbo. Olvídate de arreglar furnis a mano, crear ropa SQL por SQL, o reiniciar tu servidor manualmente. KekoSuite automatiza las tareas más tediosas del hotel.

### ✨ Características Principales

- 🛋️ **Importación Inteligente de Furnis:** Extrae furnis directamente desde la API oficial y asigna tipos de interacción automáticamente (*Trofeos, Maniquíes, Wireds, Cajas Crackeables, Mascotas y más*).
- 👗 **Generador Automático de Ropa:** Detecta y sincroniza sets de ropa en tu base de datos instantáneamente.
- 🧹 **Limpieza y Saneamiento del Catálogo:** Busca y elimina muebles huérfanos y corrige errores de formato que crashean el cliente Nitro.
- 🚀 **Control Total del Emulador:** Inicia, detiene, reinicia, monitorea y actualiza tu Arcturus Emulator con un solo botón.
- 🔧 **Control de Recursos (RAM):** Ajusta los parámetros `-Xms` y `-Xmx` para controlar el consumo de tu servidor.
- 🔄 **Actualizador del CMS:** Sincroniza y descarga automáticamente actualizaciones desde repositorios de Git.

---

## 🚀 Instalación y Uso Rápido

Para que el comando global `kekosuite` funcione en todo tu servidor, simplemente ejecuta el instalador automatizado.

```bash
# Entra al directorio clonado
cd kekosuite

# Instala las dependencias y crea el comando global
./install.sh
```

Una vez instalado, invoca el panel en cualquier momento escribiendo:
```bash
kekosuite
```

---

## ⚙️ Configuración (Dotenv)

KekoSuite utiliza un archivo `.env` seguro para gestionar tus credenciales y rutas. No subas nunca este archivo a repositorios públicos.

1. Copia la plantilla de configuración:
   ```bash
   cp .env.example .env
   ```
2. Rellena el archivo `.env` con los datos de tu servidor:
   * **Base de datos:** Host, Usuario, Contraseña, Nombre.
   * **Rutas del Servidor:** Rutas completas a `Nitro-Assets`, `Nitro-Converter`, y tu CMS.
   * **Arcturus:** Ruta del Source, ruta Live y nombre de tu `Habbo-Emulator.jar`.

---

## 🛠️ Automatización y Persistencia (Crontab)

KekoSuite incluye scripts nativos para mantener tu emulador siempre vivo, incluso si el VPS se reinicia o el emulador choca.

Abre el editor de cronjobs:
```bash
crontab -e
```
Y añade estas líneas de seguridad (asegúrate de que las rutas coincidan con la ubicación de KekoSuite):

```bash
# Iniciar el emulador automáticamente tras reiniciar el servidor
@reboot /ruta/a/kekosuite/scripts/vps_autostart.sh

# Monitor centinela: Revisa cada minuto si el emulador está caído y lo levanta
* * * * * /ruta/a/kekosuite/scripts/monitor.sh
```

---

## 📁 Estructura del Proyecto

```text
kekosuite/
├── .env                # Configuración privada (No versionado)
├── config.js           # Cargador dinámico de credenciales
├── core/               # Cerebro de KekoSuite (Lógica Node.js)
│   ├── nitro_extractor.js
│   ├── furni_fixer.js
│   ├── ...
├── scripts/            # Bash scripts de monitorización
├── logs/               # Registro de errores y operaciones
├── run.sh              # Menú CLI principal
└── install.sh          # Vinculador de variable de entorno global
```

---

<p align="center">
  Hecho con ☕ por <b>eMiLiOp</b> para el futuro de los hoteles Keko.
</p>

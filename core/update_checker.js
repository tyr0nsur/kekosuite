const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config.js');

async function checkGitUpdate(dirName, dirPath) {
    if (!fs.existsSync(dirPath) || !fs.existsSync(path.join(dirPath, '.git'))) {
        return { name: dirName, status: 'NOT_CLONED', message: 'No instalado / carpeta no encontrada' };
    }

    try {
        // Fetch updates from remote
        execSync('git fetch', { cwd: dirPath, stdio: 'ignore' });
        
        // Compare local with remote
        const local = execSync('git rev-parse HEAD', { cwd: dirPath }).toString().trim();
        const remote = execSync('git rev-parse @{u}', { cwd: dirPath }).toString().trim();

        if (local === remote) {
            return { name: dirName, status: 'UP_TO_DATE', message: '✅ Actualizado' };
        } else {
            return { name: dirName, status: 'UPDATE_AVAILABLE', message: '⚠️ ¡Actualización disponible!' };
        }
    } catch (e) {
        return { name: dirName, status: 'ERROR', message: 'Error al comprobar (¿no hay internet o repo remoto?)' };
    }
}

async function main() {
    console.log("==============================================");
    console.log("   Habbo Tools Suite: Buscador de Novedades   ");
    console.log("==============================================\n");

    console.log("Comprobando repositorios...\n");

    const cmsStatus = await checkGitUpdate("AtomCMS", config.cms_path);
    const emuStatus = await checkGitUpdate("Arcturus Emulator", config.emulator_source_path);

    console.log(`[CMS] ${cmsStatus.name.padEnd(20)}: ${cmsStatus.message}`);
    console.log(`[EMU] ${emuStatus.name.padEnd(20)}: ${emuStatus.message}`);

    console.log("\n==============================================");
    if (cmsStatus.status === 'UPDATE_AVAILABLE' || emuStatus.status === 'UPDATE_AVAILABLE') {
        console.log("Hay actualizaciones pendientes. Ve al menú de Actualizaciones para instalarlas.");
    } else {
        console.log("Todo parece estar al día.");
    }
}

main();

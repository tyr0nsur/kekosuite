const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
const config = require('../config.js');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

// We need to find the CMS root. Based on artisan location found earlier:
// /home/surcity-hotel/htdocs/hotel.surcity.es/artisan
const CMS_PATH = config.cms_path;

async function main() {
    console.log("==============================================");
    console.log("   Habbo Tools Suite: Actualizador de CMS     ");
    console.log("==============================================\n");

    console.log(`Directorio del CMS detectado: ${CMS_PATH}`);
    
    if (!fs.existsSync(path.join(CMS_PATH, 'artisan'))) {
        console.error("❌ Error: No se encontró el archivo 'artisan' en la ruta del CMS.");
        rl.close();
        return;
    }

    const confirm = await question("¿Deseas proceder con la actualización del CMS (git pull, migrate, seed)? [y/N]: ");
    if (confirm.toLowerCase() !== 'y') {
        console.log("Cancelado.");
        rl.close();
        return;
    }

    try {
        console.log("\n[1/3] Preparando repositorio Git...");
        
        // Limpieza preventiva por si hubo un fallo anterior
        try { execSync('git merge --abort', { cwd: CMS_PATH, stdio: 'ignore' }); } catch(e) {}
        try { execSync('git am --abort', { cwd: CMS_PATH, stdio: 'ignore' }); } catch(e) {}

        try {
            console.log("Intentando guardar cambios locales (stash)...");
            execSync('git stash -u', { cwd: CMS_PATH, stdio: 'inherit' });
        } catch (e) {
            console.log("\n⚠️  No se pudo guardar el estado actual (probablemente por conflictos previos).");
            const forceClean = await question("¿Quieres FORZAR una limpieza total para poder actualizar? (Recomendado para arreglar el error 500) [y/N]: ");
            if (forceClean.toLowerCase() === 'y') {
                execSync('git reset --hard origin/main', { cwd: CMS_PATH, stdio: 'inherit' });
                execSync('git clean -fd', { cwd: CMS_PATH, stdio: 'inherit' });
            } else {
                console.log("Operación cancelada.");
                rl.close(); return;
            }
        }

        console.log("Bajando novedades de Git...");
        execSync('git fetch --all', { cwd: CMS_PATH, stdio: 'inherit' });
        execSync('git pull', { cwd: CMS_PATH, stdio: 'inherit' });
        
        console.log("Intentando re-aplicar tus cambios (pop)...");
        try {
            execSync('git stash pop', { cwd: CMS_PATH, stdio: 'inherit' });
        } catch (e) {
            console.log("\n⚠️  Conflictos detectados al re-aplicar cambios.");
            const fix = await question("¿Deseas resetear a la versión oficial estable para arreglar el hotel? [y/N]: ");
            if (fix.toLowerCase() === 'y') {
                execSync('git reset --hard origin/main', { cwd: CMS_PATH, stdio: 'inherit' });
            }
        }

        console.log("\n[2/3] Ejecutando: php artisan migrate...");
        execSync('php artisan migrate --force', { cwd: CMS_PATH, stdio: 'inherit' });

        console.log("\n[3/3] Ejecutando: php artisan db:seed --class=WebsiteWordfilterSeeder...");
        execSync('php artisan db:seed --class=WebsiteWordfilterSeeder --force', { cwd: CMS_PATH, stdio: 'inherit' });

        console.log("\n✅ CMS actualizado exitosamente.");
    } catch (err) {
        console.error("\n❌ Error durante la actualización:");
        console.error(err.message);
    }

    rl.close();
}

main();

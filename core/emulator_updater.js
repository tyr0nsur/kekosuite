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

// Paths
const EMULATOR_REPO_URL = config.emulator_repo_url;
const SOURCE_PATH = config.emulator_source_path;
const LIVE_EMULATOR_PATH = config.emulator_live_path;
const JAR_NAME = config.emulator_jar_name;
const MIN_RAM = config.emulator_min_ram || '1G';
const MAX_RAM = config.emulator_max_ram || '2G';

async function main() {
    console.log("==============================================");
    console.log("   Habbo Tools Suite: Actualizador de Arcturus ");
    console.log("==============================================\n");

    // 1. Check for Maven
    try {
        execSync('mvn -version', { stdio: 'ignore' });
    } catch (e) {
        console.error("❌ Error: 'mvn' (Maven) no está instalado en este sistema.");
        console.log("Para compilar el emulador desde el código fuente necesitas Maven.");
        console.log("Sugerencia: Pide al administrador que ejecute 'sudo apt install maven'");
        rl.close();
        return;
    }

    // 2. Clone or Pull
    if (!fs.existsSync(SOURCE_PATH)) {
        console.log(`Clonando repositorio en ${SOURCE_PATH}...`);
        fs.mkdirSync(SOURCE_PATH, { recursive: true });
        execSync(`git clone ${EMULATOR_REPO_URL} .`, { cwd: SOURCE_PATH, stdio: 'inherit' });
    } else {
        console.log("Actualizando código fuente (git pull)...");
        execSync('git pull', { cwd: SOURCE_PATH, stdio: 'inherit' });
    }

    const build = await question("\n¿Deseas compilar el emulador ahora? (mvn clean install) [y/N]: ");
    if (build.toLowerCase() !== 'y') {
        rl.close();
        return;
    }

    try {
        console.log("\nCompilando... Esto puede tardar unos minutos.");
        execSync('mvn clean install', { cwd: SOURCE_PATH, stdio: 'inherit' });

        console.log("\n✅ Compilación exitosa.");
        
        const deploy = await question("¿Deseas mover el nuevo .jar a la carpeta del servidor en vivo? [y/N]: ");
        if (deploy.toLowerCase() === 'y') {
            // Find the generated jar in target folder
            const targetDir = path.join(SOURCE_PATH, 'target');
            const files = fs.readdirSync(targetDir);
            const jarFile = files.find(f => f.endsWith('-jar-with-dependencies.jar'));

            if (jarFile) {
                const src = path.join(targetDir, jarFile);
                const dest = path.join(LIVE_EMULATOR_PATH, JAR_NAME);
                fs.copyFileSync(src, dest);
                console.log(`✅ Emulador actualizado: ${jarFile} -> ${dest}`);
                console.log("Nota: Tu archivo config.ini no ha sido tocado, por lo que tus ajustes se mantienen.");
                
                const restart = await question("\n¿Deseas reiniciar el emulador ahora mismo para aplicar los cambios? [y/N]: ");
                if (restart.toLowerCase() === 'y') {
                    console.log("Reiniciando emulador...");
                    try {
                        execSync(`pkill -f "${JAR_NAME}"`, { stdio: 'ignore' });
                        execSync('sleep 2');
                        execSync('screen -S emulator -X quit', { stdio: 'ignore' });
                    } catch (e) {}
                    
                    execSync(`screen -dmS emulator java -Dfile.encoding=UTF8 -Xms${MIN_RAM} -Xmx${MAX_RAM} -jar "${JAR_NAME}"`, { 
                        cwd: LIVE_EMULATOR_PATH,
                        stdio: 'inherit' 
                    });
                    console.log("✅ Emulador reiniciado exitosamente en segundo plano.");
                } else {
                    console.log("Recuerda reiniciar el emulador manualmente cuando desees aplicar los cambios.");
                }
            } else {
                console.error("❌ No se encontró el archivo .jar generado en la carpeta target.");
            }
        }

    } catch (err) {
        console.error("\n❌ Error durante la compilación:");
        console.error(err.message);
    }

    rl.close();
}

main();

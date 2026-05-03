const fs = require('fs');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
    console.log("==========================================");
    console.log("   Habbo Tools Suite - Configuración Inicial");
    console.log("==========================================");
    console.log("Bienvenido. Como es tu primera vez ejecutando la suite, necesitamos configurar tus rutas y credenciales.\n");

    const config = {};

    config.api_token = await question("1. HabboFurni API Token: ");
    
    console.log("\n--- Credenciales Base de Datos ---");
    config.db_host = await question("Host MySQL (ej. 127.0.0.1): ") || '127.0.0.1';
    config.db_user = await question("Usuario MySQL: ");
    config.db_pass = await question("Contraseña MySQL: ");
    config.db_name = await question("Nombre de la Base de Datos (ej. habbo): ");

    console.log("\n--- Rutas Locales ---");
    config.furniture_data_path = await question("Ruta absoluta a tu FurnitureData.json: ");
    config.nitro_bundled_path = await question("Ruta absoluta a tu carpeta public/nitro-assets/bundled/furniture: ");
    
    console.log("\n--- Rutas de Nitro Converter ---");
    config.converter_cwd = await question("Ruta absoluta a tu carpeta nitro-converter: ");
    config.converter_swf_path = await question("Ruta absoluta a assets/swf/furniture del converter: ");
    config.converter_bundled_path = await question("Ruta absoluta a assets/bundled/furniture del converter: ");

    console.log("\n--- Rutas Web y CMS ---");
    config.cms_path = await question("Ruta absoluta a la raíz de tu CMS: ");
    config.cms_icons_path = await question("Ruta absoluta a c_images/catalogue/: ");
    config.dcr_icons_path = await question("Ruta absoluta a dcr/hof_furni/icons/: ");

    console.log("\n--- Configuración de Emulador (Arcturus) ---");
    config.emulator_repo_url = await question("URL del repositorio Git del emulador: ") || 'https://git.krews.org/morningstar/Arcturus-Community.git';
    config.emulator_source_path = await question("Ruta absoluta donde se clonará el código fuente: ");
    config.emulator_live_path = await question("Ruta absoluta a la carpeta del servidor en vivo: ");
    config.emulator_jar_name = await question("Nombre del archivo .jar del emulador (ej. Habbo-3.6.0.jar): ");

    fs.writeFileSync('config.json', JSON.stringify(config, null, 4));

    console.log("\n✅ Configuración guardada exitosamente en 'config.json'!");
    console.log("Ya puedes empezar a usar Habbo Tools Suite.");
    rl.close();
}

main();

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

const config = require('../config.js');
const API_TOKEN = config.api_token;
const CONVERTER_SWF_PATH = config.converter_swf_path;
const CONVERTER_BUNDLED_PATH = config.converter_bundled_path;

const NITRO_BUNDLED_PATH = config.nitro_bundled_path;
const FURNITURE_DATA_PATH = config.furniture_data_path;

async function main() {
    console.log("=== HabboFurni - Buscador de Cuadrados Negros ===");

    const dbConfig = {
        host: config.db_host,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log("Connected to MySQL.\n");
    } catch (err) {
        console.error("Failed to connect to MySQL:", err.message);
        process.exit(1);
    }

    console.log("Leyendo la base de datos de furnis (items_base)...");
    const [rows] = await connection.execute("SELECT id, item_name, type FROM items_base");
    
    console.log(`Se encontraron ${rows.length} furnis en la base de datos.`);
    console.log("Verificando archivos .nitro...\n");

    const brokenFurnis = [];

    for (const row of rows) {
        // Ignorar furnis del sistema que no tienen archivo propio (siempre que sepas cuáles son)
        // Pero en principio validamos todos.
        
        let classname = row.item_name;
        
        // Ignorar bots, efectos, y cosas internas del sistema
        if (classname.includes('badge_')) continue;
        if (classname.startsWith('bot_')) continue;
        if (classname.startsWith('rentable_bot')) continue;
        if (classname.startsWith('avatar_effect')) continue;
        if (classname.startsWith('room_ad_')) continue;
        if (classname === 'post.it' || classname === 'post.it.vd') continue;

        // Si el classname contiene un '*', es una variación de color (ej. plasto*1). 
        // Nitro solo usa el archivo base (plasto.nitro), así que cortamos el asterisco.
        if (classname.includes('*')) {
            classname = classname.split('*')[0];
        }

        const nitroPath = path.join(NITRO_BUNDLED_PATH, `${classname}.nitro`);
        
        if (!fs.existsSync(nitroPath)) {
            brokenFurnis.push(classname);
        }
    }

    if (brokenFurnis.length === 0) {
        console.log("✅ ¡Tu catálogo está perfecto! Todos los furnis de la base de datos tienen su archivo gráfico correspondiente.");
    } else {
        console.log(`⚠️ Se encontraron ${brokenFurnis.length} furnis rotos (les falta su archivo .nitro):`);
        
        // Mostrar los primeros 50 para no inundar la consola
        const displayLimit = Math.min(brokenFurnis.length, 50);
        for(let i=0; i < displayLimit; i++) {
            console.log(`- ${brokenFurnis[i]}`);
        }
        
        if (brokenFurnis.length > 50) {
            console.log(`... y ${brokenFurnis.length - 50} furnis más.`);
        }
        
        console.log("\n💡 SOLUCIÓN AUTOMÁTICA DISPONIBLE");
        const confirm = await question("¿Quieres intentar reparar estos furnis rotos automáticamente (descargándolos de HabboFurni)? [y/N]: ");
        
        if (confirm.toLowerCase() === 'y') {
            console.log("\nIniciando Auto-Reparación (esto puede tomar mucho tiempo si son miles de furnis)...");
            
            let repaired = 0;
            let failed = 0;
            
            for (const classname of brokenFurnis) {
                // Remove trailing spaces or " name" just in case
                const cleanClassname = classname.replace(' name', '').trim();
                console.log(`\n--- Intentando reparar: ${cleanClassname} ---`);
                
                try {
                    const res = await fetch(`https://habbofurni.com/api/v1/furniture/${cleanClassname}`, {
                        headers: {
                            'Authorization': `Bearer ${API_TOKEN}`,
                            'Accept': 'application/json',
                            'X-Hotel-ID': '3'
                        }
                    });
                    
                    if (!res.ok) {
                        console.log(`❌ No encontrado en la API de HabboFurni (Error ${res.status}).`);
                        failed++;
                        continue;
                    }
                    
                    const resJson = await res.json();
                    const dataObj = resJson.data;
                    if (!dataObj || !dataObj.hotelData) {
                        console.log(`❌ Datos incompletos en HabboFurni.`);
                        failed++;
                        continue;
                    }
                    
                    const swfUrl = dataObj.hotelData.swf.url;
                    console.log(`Descargando SWF...`);
                    const swfRes = await fetch(swfUrl);
                    if (!swfRes.ok) throw new Error("Fallo al descargar SWF");
                    
                    const swfBuffer = await swfRes.arrayBuffer();
                    const swfPath = path.join(CONVERTER_SWF_PATH, `${cleanClassname}.swf`);
                    fs.writeFileSync(swfPath, Buffer.from(swfBuffer));
                    
                    // Descargar Icono si existe
                    if (dataObj.hotelData.icon && dataObj.hotelData.icon.url) {
                        const iconRes = await fetch(dataObj.hotelData.icon.url);
                        if (iconRes.ok) {
                            const iconBuffer = await iconRes.arrayBuffer();
                            const iconPath1 = path.join(config.dcr_icons_path, `${cleanClassname}_icon.png`);
                            const iconPath2 = path.join(config.cms_icons_path, `${cleanClassname}_icon.png`);
                            fs.writeFileSync(iconPath1, Buffer.from(iconBuffer));
                            fs.writeFileSync(iconPath2, Buffer.from(iconBuffer));
                        }
                    }

                    console.log(`Convirtiendo a Nitro...`);
                    execSync('source /home/surcity-hotel/.nvm/nvm.sh && node ./dist/Main.js --convert-swf', {
                        cwd: config.converter_cwd,
                        shell: '/bin/bash',
                        stdio: 'ignore'
                    });

                    const convertedNitro = path.join(CONVERTER_BUNDLED_PATH, `${cleanClassname}.nitro`);
                    if (fs.existsSync(convertedNitro)) {
                        const destNitro = path.join(NITRO_BUNDLED_PATH, `${cleanClassname}.nitro`);
                        fs.copyFileSync(convertedNitro, destNitro);
                        console.log(`✅ ¡Reparado con éxito!`);
                        repaired++;
                    } else {
                        console.log(`❌ Fallo en la conversión.`);
                        failed++;
                    }

                } catch(err) {
                    console.log(`❌ Error durante la reparación: ${err.message}`);
                    failed++;
                }
            }
            
            console.log(`\n================================`);
            console.log(`RESUMEN DE AUTO-REPARACIÓN`);
            console.log(`Reparados exitosamente: ${repaired}`);
            console.log(`No encontrados / Fallidos: ${failed}`);
            console.log(`================================`);
            console.log("Reinicia el emulador y borra la caché para ver los cambios.");
        }
    }

    await connection.end();
    rl.close();
}

main();

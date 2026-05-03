const fs = require('fs');
const mysql = require('mysql2/promise');
const config = require('../config.js');
const readline = require('readline');

const FURNITURE_DATA_PATH = config.furniture_data_path;
const API_TOKEN = config.api_token;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(r => rl.question(q, r));

const colors = {
    green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
    red: '\x1b[31m', magenta: '\x1b[35m', reset: '\x1b[0m', bold: '\x1b[1m'
};

async function main() {
    console.log(`${colors.cyan}${colors.bold}`);
    console.log("=============================================");
    console.log("   KekoSuite: Actualizador de Nombres v2.0   ");
    console.log("=============================================");
    console.log(`${colors.reset}`);

    const connection = await mysql.createConnection({
        host: config.db_host, user: config.db_user,
        password: config.db_pass, database: config.db_name
    });

    // Contar furnis sin nombre real
    const [countName] = await connection.execute(
        "SELECT COUNT(*) as c FROM items_base WHERE public_name LIKE '% name'"
    );
    const [countSame] = await connection.execute(
        "SELECT COUNT(*) as c FROM items_base WHERE public_name = item_name AND public_name NOT LIKE '% name'"
    );

    const totalUntranslated = countName[0].c + countSame[0].c;
    const [totalItems] = await connection.execute("SELECT COUNT(*) as c FROM items_base");

    console.log(`${colors.yellow}📊 Estado actual de tu catálogo:${colors.reset}`);
    console.log(`   Total furnis: ${totalItems[0].c}`);
    console.log(`   Con nombre genérico (termina en " name"): ${colors.red}${countName[0].c}${colors.reset}`);
    console.log(`   Con classname como nombre (sin traducir): ${colors.red}${countSame[0].c}${colors.reset}`);
    console.log(`   ${colors.bold}Total sin nombre real: ${totalUntranslated}${colors.reset}\n`);

    if (totalUntranslated === 0) {
        console.log(`${colors.green}¡Tu catálogo está perfecto! No hay furnis pendientes.${colors.reset}`);
        await connection.end(); rl.close(); return;
    }

    console.log(`${colors.cyan}Selecciona modo:${colors.reset}`);
    console.log(` 1) Escaneo rápido - Solo furnis genéricos (terminan en " name")`);
    console.log(` 2) Escaneo completo - Todos los furnis sin nombre real`);
    console.log(` 3) Escaneo por campaña - Furnis de una línea específica (ej: easter, noel, neopets)`);
    console.log(` 0) Cancelar`);
    const mode = await question(`\n${colors.bold}Opción: ${colors.reset}`);

    let items;
    switch (mode) {
        case '1':
            [items] = await connection.execute(
                "SELECT id, item_name, public_name FROM items_base WHERE public_name LIKE '% name' ORDER BY id DESC"
            );
            break;
        case '2':
            [items] = await connection.execute(
                "SELECT id, item_name, public_name FROM items_base WHERE public_name = item_name OR public_name LIKE '% name' ORDER BY id DESC"
            );
            break;
        case '3': {
            const keyword = await question(`Escribe el prefijo de campaña (ej: easter, noel, hween, neopets): `);
            if (!keyword.trim()) { console.log("Cancelado."); await connection.end(); rl.close(); return; }
            [items] = await connection.execute(
                "SELECT id, item_name, public_name FROM items_base WHERE (public_name = item_name OR public_name LIKE '% name') AND item_name LIKE ? ORDER BY id DESC",
                [`${keyword.trim()}%`]
            );
            break;
        }
        default:
            console.log("Cancelado.");
            await connection.end(); rl.close(); return;
    }

    if (items.length === 0) {
        console.log(`${colors.green}No se encontraron furnis pendientes con ese filtro.${colors.reset}`);
        await connection.end(); rl.close(); return;
    }

    console.log(`\n${colors.yellow}Se van a procesar ${items.length} furnis. Esto consultará la API de HabboFurni.${colors.reset}`);
    if (items.length > 500) {
        console.log(`${colors.magenta}⚠ Son muchos furnis. El proceso puede tardar varios minutos.${colors.reset}`);
    }
    const confirm = await question(`¿Continuar? [y/N]: `);
    if (confirm.toLowerCase() !== 'y') {
        console.log("Cancelado."); await connection.end(); rl.close(); return;
    }

    // Backup
    if (fs.existsSync(FURNITURE_DATA_PATH)) {
        fs.copyFileSync(FURNITURE_DATA_PATH, FURNITURE_DATA_PATH + '.bak');
        console.log(`${colors.green}✔ Backup creado: FurnitureData.json.bak${colors.reset}`);
    }
    const furniDataObj = JSON.parse(fs.readFileSync(FURNITURE_DATA_PATH, 'utf8'));

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const batchSize = 50;

    for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const progress = `[${Math.min(i + batchSize, items.length)}/${items.length}]`;

        for (const item of batch) {
            const classname = item.item_name;
            const baseClassname = classname.includes('*') ? classname.split('*')[0] : classname;

            try {
                const res = await fetch(`https://habbofurni.com/api/v1/furniture/${baseClassname}`, {
                    headers: {
                        'Authorization': `Bearer ${API_TOKEN}`,
                        'Accept': 'application/json',
                        'X-Hotel-ID': '3'
                    }
                });

                if (!res.ok) {
                    skippedCount++;
                    continue;
                }

                const json = await res.json();
                // Intentar hotel_data[0] primero, luego hotelData
                const apiData = json.data?.hotel_data?.[0] || json.data?.hotelData;

                if (!apiData || !apiData.name) {
                    skippedCount++;
                    continue;
                }

                // Si el nombre de la API también es genérico, saltamos
                if (apiData.name.endsWith(' name') || apiData.name === classname) {
                    skippedCount++;
                    continue;
                }

                const newName = apiData.name;
                const newDesc = apiData.description || '';

                // Solo mostrar si realmente se cambia
                if (item.public_name !== newName) {
                    process.stdout.write(`${colors.green}✔${colors.reset} ${progress} ${classname} → ${colors.cyan}${newName}${colors.reset}\n`);

                    // 1. Actualizar items_base
                    await connection.execute(
                        "UPDATE items_base SET public_name = ? WHERE id = ?",
                        [newName, item.id]
                    );

                    // 2. Actualizar catalog_items
                    await connection.execute(
                        "UPDATE catalog_items SET catalog_name = ? WHERE item_ids = ?",
                        [newName, item.id.toString()]
                    );

                    // 3. Actualizar FurnitureData.json
                    const allTypes = [
                        ...(furniDataObj.roomitemtypes?.furnitype || []),
                        ...(furniDataObj.wallitemtypes?.furnitype || [])
                    ];
                    const entry = allTypes.find(f => f.classname === classname);
                    if (entry) {
                        entry.name = newName;
                        if (newDesc && !newDesc.endsWith(' desc')) {
                            entry.description = newDesc;
                        }
                    }

                    updatedCount++;
                } else {
                    skippedCount++;
                }

            } catch (err) {
                errorCount++;
            }

            // Pausa entre requests para no saturar la API
            await new Promise(resolve => setTimeout(resolve, 150));
        }

        // Guardar FurnitureData.json cada lote por seguridad
        if (updatedCount > 0 && i % (batchSize * 5) === 0) {
            fs.writeFileSync(FURNITURE_DATA_PATH, JSON.stringify(furniDataObj, null, 2));
        }
    }

    // Guardado final
    if (updatedCount > 0) {
        fs.writeFileSync(FURNITURE_DATA_PATH, JSON.stringify(furniDataObj, null, 2));
    }

    console.log(`\n${colors.cyan}${colors.bold}=== Resumen ===${colors.reset}`);
    console.log(`${colors.green}  Actualizados: ${updatedCount}${colors.reset}`);
    console.log(`${colors.yellow}  Sin traducción disponible: ${skippedCount}${colors.reset}`);
    if (errorCount > 0) console.log(`${colors.red}  Errores: ${errorCount}${colors.reset}`);
    if (updatedCount > 0) {
        console.log(`\n${colors.green}Recuerda: :update items / :update catalog en el emulador y borrar caché del navegador.${colors.reset}`);
    }

    await connection.end();
    rl.close();
}

main();

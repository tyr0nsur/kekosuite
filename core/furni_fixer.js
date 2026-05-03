const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const readline = require('readline');

const config = require('../config.js');
const { extractPhysics, detectInteractionType } = require('./nitro_extractor');

// Colors for console
const colors = {
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m"
};

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

let furniDataObj = null;

async function main() {
    console.log(`${colors.cyan}${colors.bright}=== HABBO FURNI FIXER & AUDITOR PRO ===${colors.reset}`);
    
    // Load FurnitureData
    console.log(`${colors.cyan}Cargando FurnitureData.json...${colors.reset}`);
    try {
        const rawData = fs.readFileSync(config.furniture_data_path, 'utf8');
        furniDataObj = JSON.parse(rawData);
    } catch(err) {
        console.error(`${colors.red}✘ Error al cargar FurnitureData.json: ${err.message}${colors.reset}`);
        process.exit(1);
    }

    const dbConfig = {
        host: config.db_host,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log(`${colors.green}✔ Conectado a la base de datos.${colors.reset}`);
    } catch (err) {
        console.error(`${colors.red}✘ Error al conectar a MySQL: ${err.message}${colors.reset}`);
        process.exit(1);
    }

    while (true) {
        console.log(`\n${colors.yellow}Selecciona una opción:${colors.reset}`);
        console.log(`${colors.cyan}1)${colors.reset} Auditar y arreglar páginas/categorías (Soporta múltiples IDs)`);
        console.log(`${colors.cyan}2)${colors.reset} Auditar y arreglar TODO el catálogo`);
        console.log(`${colors.cyan}0)${colors.reset} Salir`);

        const choice = await question(`\n${colors.bright}Opción > ${colors.reset}`);

        if (choice === '0' || choice === null) {
            break;
        } else if (choice === '1') {
            await fixCatalogPage(connection);
        } else if (choice === '2') {
            await fixFullDatabase(connection);
        } else if (choice) {
            console.log(`${colors.red}Opción no válida.${colors.reset}`);
        } else {
            break;
        }
    }

    await connection.end();
    rl.close();
    console.log(`${colors.green}¡Hasta luego!${colors.reset}`);
}

async function fixCatalogPage(connection) {
    console.log(`\n${colors.magenta}--- Auditoría de Páginas de Catálogo ---${colors.reset}`);
    
    const [pages] = await connection.execute("SELECT id, caption FROM catalog_pages WHERE parent_id != -1 ORDER BY id DESC LIMIT 20");
    console.log(`${colors.yellow}Últimas 20 páginas añadidas:${colors.reset}`);
    pages.forEach(p => console.log(` - [${p.id}] ${p.caption}`));

    const input = await question(`\n${colors.bright}Introduce las IDs de página a auditar (separadas por comas, ej: 12,15,20): ${colors.reset}`);
    if (!input || input.trim() === '') return;

    let targetPageIds = input.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (targetPageIds.length === 0) {
        console.log(`${colors.red}IDs no válidas.${colors.reset}`);
        return;
    }

    // Detect child pages (if parent category was given)
    console.log(`${colors.cyan}Comprobando si hay subcategorías (páginas hijas)...${colors.reset}`);
    const placeholders = targetPageIds.map(() => '?').join(',');
    const [children] = await connection.execute(`SELECT id FROM catalog_pages WHERE parent_id IN (${placeholders})`, targetPageIds);
    
    if (children.length > 0) {
        const childIds = children.map(c => c.id);
        console.log(`${colors.green}Se detectaron ${childIds.length} subcategorías. Se auditarán todas juntas.${colors.reset}`);
        targetPageIds = [...new Set([...targetPageIds, ...childIds])];
    }

    console.log(`${colors.cyan}Buscando items en ${targetPageIds.length} páginas...${colors.reset}`);
    const pagePlaceholders = targetPageIds.map(() => '?').join(',');
    const [items] = await connection.execute(`SELECT item_ids FROM catalog_items WHERE page_id IN (${pagePlaceholders})`, targetPageIds);
    
    if (items.length === 0) {
        console.log(`${colors.red}No se encontraron items en estas páginas.${colors.reset}`);
        return;
    }

    const itemBaseIds = new Set();
    items.forEach(row => {
        const ids = row.item_ids.split(';');
        ids.forEach(id => {
            if (id.trim() && !isNaN(id.trim())) itemBaseIds.add(id.trim());
        });
    });

    if (itemBaseIds.size === 0) {
        console.log(`${colors.red}No se encontraron IDs de items base válidos.${colors.reset}`);
        return;
    }

    console.log(`${colors.green}Se encontraron ${itemBaseIds.size} furnis únicos.${colors.reset}`);
    const idList = Array.from(itemBaseIds).join(',');
    const [furnis] = await connection.execute(`SELECT id, sprite_id, item_name, type FROM items_base WHERE id IN (${idList})`);

    await auditAndFix(furnis, connection);
}

async function fixFullDatabase(connection) {
    console.log(`\n${colors.magenta}--- Auditoría de Toda la Base de Datos ---${colors.reset}`);
    const [furnis] = await connection.execute("SELECT id, sprite_id, item_name, type FROM items_base");
    console.log(`${colors.yellow}Se auditarán ${furnis.length} furnis.${colors.reset}`);
    
    await auditAndFix(furnis, connection);
}

async function auditAndFix(furnis, connection) {
    const broken = [];
    const NITRO_PATH = config.nitro_bundled_path;

    console.log(`${colors.cyan}Iniciando auditoría profunda (Nitro + FurnitureData + Icons)...${colors.reset}`);

    for (const furni of furnis) {
        let classname = furni.item_name;
        if (classname.includes('*')) classname = classname.split('*')[0];
        if (classname.includes('badge_') || classname.startsWith('bot_') || classname.startsWith('avatar_effect')) continue;

        let issues = [];

        // 1. Check Nitro file
        const nitroFile = path.join(NITRO_PATH, `${classname}.nitro`);
        if (!fs.existsSync(nitroFile)) issues.push("Falta archivo .nitro");

        // 2. Check FurnitureData
        const isWall = furni.type === 'i';
        if (isWall && !furniDataObj.wallitemtypes) furniDataObj.wallitemtypes = { furnitype: [] };
        if (!isWall && !furniDataObj.roomitemtypes) furniDataObj.roomitemtypes = { furnitype: [] };
        const searchArray = isWall ? furniDataObj.wallitemtypes.furnitype : furniDataObj.roomitemtypes.furnitype;
        const entryInData = searchArray.find(f => f.classname === classname);
        if (!entryInData) {
            issues.push("Falta en FurnitureData.json");
        } else {
            // Verificamos si el ID en el JSON coincide con el ID de la base de datos
            // (En Nitro deben coincidir para que el emulador y el cliente se entiendan)
            if (entryInData.id !== furni.id) {
                issues.push(`ID mismatch (JSON: ${entryInData.id}, DB: ${furni.id})`);
            }
        }

        // 3. Check Database sprite_id consistency
        // Obtenemos el sprite_id de la DB (ya lo tenemos en furni.sprite_id si lo añadimos al SELECT)
        if (furni.sprite_id !== furni.id) {
            issues.push(`Sprite ID mismatch (Base: ${furni.sprite_id}, Debe ser: ${furni.id})`);
        }

        // 4. Check Icons
        const iconPath1 = path.join(config.dcr_icons_path, `${classname}_icon.png`);
        const iconPath2 = path.join(config.cms_icons_path, `${classname}_icon.png`);
        if (!fs.existsSync(iconPath1) && !fs.existsSync(iconPath2)) issues.push("Faltan iconos");

        // 4. (Opcional) Guardamos para verificar DB luego si el usuario confirma
        if (issues.length > 0) {
            broken.push({ 
                id: furni.id, 
                classname: classname, 
                issues: issues,
                type: furni.type 
            });
        }
    }

    if (broken.length === 0) {
        console.log(`${colors.green}✅ ¡Todo correcto! No se encontraron problemas en los furnis auditados.${colors.reset}`);
        return;
    }

    console.log(`${colors.red}⚠️ Se encontraron ${broken.length} furnis con problemas:${colors.reset}`);
    
    const limit = 30;
    broken.slice(0, limit).forEach(b => {
        console.log(` - ${colors.bright}${b.classname}${colors.reset} (ID: ${b.id}): ${colors.yellow}${b.issues.join(', ')}${colors.reset}`);
    });
    if (broken.length > limit) console.log(` ... y ${broken.length - limit} más.`);

    const confirm = await question(`\n${colors.bright}¿Deseas intentar arreglarlos automáticamente? [y/N]: ${colors.reset}`);
    
    if (confirm.toLowerCase() === 'y') {
        let success = 0;
        let fail = 0;

        for (const b of broken) {
            console.log(`\n${colors.blue}Arreglando: ${colors.bright}${b.classname}${colors.reset}...`);
            const fixed = await repairFurni(b, connection);
            if (fixed) success++;
            else fail++;
        }

        console.log(`\n${colors.cyan}Guardando FurnitureData.json...${colors.reset}`);
        if (fs.existsSync(config.furniture_data_path)) {
            fs.copyFileSync(config.furniture_data_path, config.furniture_data_path + '.bak');
            console.log(`${colors.green}Backup creado: FurnitureData.json.bak${colors.reset}`);
        }
        fs.writeFileSync(config.furniture_data_path, JSON.stringify(furniDataObj, null, 2));

        console.log(`\n${colors.green}=== Resumen de Reparación ===${colors.reset}`);
        console.log(`${colors.green}Reparados: ${success}${colors.reset}`);
        console.log(`${colors.red}Fallidos: ${fail}${colors.reset}`);
        console.log(`${colors.yellow}Recuerda reiniciar el emulador y limpiar caché.${colors.reset}`);
    }
}

async function repairFurni(furni, connection) {
    const classname = furni.classname;
    const API_TOKEN = config.api_token;
    const CONVERTER_SWF_PATH = config.converter_swf_path;
    const CONVERTER_BUNDLED_PATH = config.converter_bundled_path;
    const NITRO_BUNDLED_PATH = config.nitro_bundled_path;

    try {
        // 1. Fetch de la API para obtener datos necesarios
        const res = await fetch(`https://habbofurni.com/api/v1/furniture/${classname}`, {
            headers: {
                'Authorization': `Bearer ${API_TOKEN}`,
                'Accept': 'application/json',
                'X-Hotel-ID': '3'
            }
        });

        if (!res.ok) {
            console.log(` ${colors.red}✘ No encontrado en la API.${colors.reset}`);
            return false;
        }

        const json = await res.json();
        const apiData = json.data?.hotelData || {};
        if (!apiData) return false;

        // A. Descargar e instalar iconos
        if (apiData.icon?.url) {
            const iconRes = await fetch(apiData.icon.url);
            if (iconRes.ok) {
                const iconBuffer = await iconRes.arrayBuffer();
                fs.writeFileSync(path.join(config.dcr_icons_path, `${classname}_icon.png`), Buffer.from(iconBuffer));
                fs.writeFileSync(path.join(config.cms_icons_path, `${classname}_icon.png`), Buffer.from(iconBuffer));
                console.log(` ${colors.cyan}✔ Iconos actualizados.${colors.reset}`);
            }
        }

        // B. Descargar y convertir Nitro (si falta)
        const nitroFile = path.join(NITRO_BUNDLED_PATH, `${classname}.nitro`);
        if (!fs.existsSync(nitroFile)) {
            console.log(` ${colors.cyan}⬇ Descargando y convirtiendo SWF...${colors.reset}`);
            const swfRes = await fetch(apiData.swf.url);
            if (swfRes.ok) {
                const swfBuffer = await swfRes.arrayBuffer();
                const swfPath = path.join(CONVERTER_SWF_PATH, `${classname}.swf`);
                fs.writeFileSync(swfPath, Buffer.from(swfBuffer));
                
                execSync('source /home/surcity-hotel/.nvm/nvm.sh && node ./dist/Main.js --convert-swf', {
                    cwd: config.converter_cwd,
                    shell: '/bin/bash',
                    stdio: 'ignore'
                });

                const convertedFile = path.join(CONVERTER_BUNDLED_PATH, `${classname}.nitro`);
                if (fs.existsSync(convertedFile)) {
                    fs.copyFileSync(convertedFile, path.join(NITRO_BUNDLED_PATH, `${classname}.nitro`));
                    console.log(` ${colors.green}✔ Archivo .nitro generado.${colors.reset}`);
                }
            }
        } else {
            console.log(` ${colors.green}✔ Archivo .nitro ya existe.${colors.reset}`);
        }

        // C. Actualizar Base de Datos (items_base) para asegurar tipo y sprite_id correctos
        const apiTypeLetter = apiData.type === 'wall' ? 'i' : 's';
        const apiSpriteId = furni.id; // Usamos el ID de la DB como sprite_id para que coincida con FurnitureData
        const lowerClass = classname.toLowerCase();
        const canSit = (apiData.can_sit_on || apiData.can_sit || lowerClass.includes('chair') || lowerClass.includes('sofa') || lowerClass.includes('bench') || lowerClass.includes('stool') || lowerClass.includes('seat')) ? 1 : 0;
        const canLay = (apiData.can_lay_on || apiData.can_lay || lowerClass.includes('bed') || lowerClass.includes('lay')) ? 1 : 0;
        const canWalk = (apiData.can_stand_on || apiData.can_walk || lowerClass.includes('rug') || lowerClass.includes('carpet')) ? 1 : 0;

        const physics = extractPhysics(nitroFile);
        let allowStack = 0;
        if (canWalk) allowStack = 1;
        else if (physics.stackHeight > 0 && physics.stackHeight < 1.6 && !canSit && !canLay && apiTypeLetter === 's') allowStack = 1;

        const detection = detectInteractionType(classname, apiData);

        console.log(` ${colors.cyan}⚙ Sincronizando base de datos (Sprite ID: ${apiSpriteId}, Altura: ${physics.stackHeight}, Tipo: ${detection.interactionType})...${colors.reset}`);
        await connection.execute(
            "UPDATE items_base SET type = ?, sprite_id = ?, width = ?, length = ?, stack_height = ?, allow_stack = ?, allow_sit = ?, allow_lay = ?, allow_walk = ?, interaction_modes_count = ?, interaction_type = ?, vending_ids = ? WHERE id = ?",
            [apiTypeLetter, apiSpriteId, apiData.xdim || 1, apiData.ydim || 1, physics.stackHeight, allowStack, canSit, canLay, canWalk, physics.modesCount, detection.interactionType, detection.vendingIds, furni.id]
        );

        if (detection.isClothing && detection.clothingSetId) {
            try {
                await connection.execute(
                    `INSERT IGNORE INTO catalog_clothing (name, setid) VALUES (?, ?)`,
                    [classname, detection.clothingSetId]
                );
            } catch (clothErr) {}
        }

        // D. Actualizar FurnitureData.json
        const isWall = apiTypeLetter === 'i';
        if (isWall && !furniDataObj.wallitemtypes) furniDataObj.wallitemtypes = { furnitype: [] };
        if (!isWall && !furniDataObj.roomitemtypes) furniDataObj.roomitemtypes = { furnitype: [] };
        const searchArray = isWall ? furniDataObj.wallitemtypes.furnitype : furniDataObj.roomitemtypes.furnitype;
        const index = searchArray.findIndex(f => f.classname === classname);

        const furniEntry = {
            id: furni.id,
            classname: classname,
            revision: apiData.revision || 1,
            category: apiData.category || "other",
            defaultdir: apiData.default_dir || 0,
            xdim: apiData.xdim || 1,
            ydim: apiData.ydim || 1,
            partcolors: apiData.part_colors || { color: [] },
            name: apiData.name || classname,
            description: apiData.description || classname,
            adurl: "",
            offerid: furni.id,
            buyout: 0,
            rentofferid: -1,
            rentbuyout: 0,
            bc: 0,
            excludeddynamic: 0,
            customparams: "",
            specialtype: 1,
            canstandon: canWalk,
            cansiton: canSit,
            canlayon: canLay,
            furniline: apiData.furni_line || "custom"
        };

        if (index >= 0) {
            searchArray[index] = furniEntry;
            console.log(` ${colors.cyan}✔ FurnitureData actualizado.${colors.reset}`);
        } else {
            searchArray.push(furniEntry);
            console.log(` ${colors.green}+ Añadido a FurnitureData.${colors.reset}`);
        }

        return true;
    } catch (err) {
        console.log(` ${colors.red}✘ Error: ${err.message}${colors.reset}`);
        return false;
    }
}

main();

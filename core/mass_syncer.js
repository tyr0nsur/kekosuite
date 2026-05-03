const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');
const readline = require('readline');
const config = require('../config.js');
const { extractPhysics, detectInteractionType } = require('./nitro_extractor');
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

const API_TOKEN = config.api_token;
const CONVERTER_SWF_PATH = config.converter_swf_path;
const CONVERTER_BUNDLED_PATH = config.converter_bundled_path;
const NITRO_BUNDLED_PATH = config.nitro_bundled_path;
const FURNITURE_DATA_PATH = config.furniture_data_path;
const STATE_FILE = path.join(__dirname, 'sync_state.json');

// Globals
const defaultPrice = 150;
let parentCatalogPageId = null;
let isStopping = false;

// Graceful exit handler
process.on('SIGINT', () => {
    console.log("\n\n[!] Señal de interrupción recibida. Cerrando de forma segura al terminar el furni actual...");
    isStopping = true;
});

async function getOrCreateParentPage(connection) {
    const [rows] = await connection.execute("SELECT id FROM catalog_pages WHERE caption = 'HabboFurni Actualizaciones' LIMIT 1");
    if (rows.length > 0) return rows[0].id;
    
    const [res] = await connection.execute(
        `INSERT INTO catalog_pages (parent_id, caption, page_layout, icon_color, icon_image, min_rank, order_num, visible, enabled) 
         VALUES (7, 'HabboFurni Actualizaciones', 'default_3x3', 1, 1, 1, 1, '1', '1')`
    );
    return res.insertId;
}

async function getOrCreateCampaignPage(connection, furniLine) {
    if (!furniLine || furniLine.trim() === '') furniLine = 'misc';
    const [rows] = await connection.execute("SELECT id FROM catalog_pages WHERE caption = ? AND parent_id = ? LIMIT 1", [furniLine, parentCatalogPageId]);
    if (rows.length > 0) return rows[0].id;
    
    const [res] = await connection.execute(
        `INSERT INTO catalog_pages (parent_id, caption, page_layout, icon_color, icon_image, min_rank, order_num, visible, enabled) 
         VALUES (?, ?, 'default_3x3', 1, 1, 1, 1, '1', '1')`,
        [parentCatalogPageId, furniLine]
    );
    return res.insertId;
}

async function main() {
    console.log("\x1b[36m%s\x1b[0m", "======================================================");
    console.log("\x1b[36m%s\x1b[0m", "   Habbo Tools Suite: The Ultimate Syncer (v2.5)      ");
    console.log("\x1b[36m%s\x1b[0m", "======================================================");
    
    let state = {
        currentPage: 1,
        totalPages: 1,
        totalProcessed: 0,
        totalMissing: 0,
        totalBroken: 0
    };

    // Load previous state if exists
    if (fs.existsSync(STATE_FILE)) {
        const savedState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
        console.log(`\x1b[33m[i] Se ha detectado una sesión previa en la Página ${savedState.currentPage}.\x1b[0m`);
        const resume = await question("¿Deseas REANUDAR el proceso? [Y/n]: ");
        if (resume.toLowerCase() !== 'n') {
            state = savedState;
            console.log("Reanudando...");
        } else {
            console.log("Iniciando desde cero...");
        }
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
        console.log("✅ Conectado a MySQL.");
    } catch (err) {
        console.error("❌ Fallo al conectar a MySQL:", err.message);
        process.exit(1);
    }

    parentCatalogPageId = await getOrCreateParentPage(connection);
    
    let furniDataObj;
    try {
        furniDataObj = JSON.parse(fs.readFileSync(FURNITURE_DATA_PATH, 'utf8'));
    } catch(err) {
        console.error("❌ Fallo al leer FurnitureData.json:", err.message);
        process.exit(1);
    }

    console.log("\nEscaneando API HabboFurni...");

    while (state.currentPage <= state.totalPages && !isStopping) {
        try {
            console.log(`\x1b[34m\n--- Procesando Página ${state.currentPage} / ${state.totalPages || '?'} ---\x1b[0m`);
            const res = await fetch(`https://habbofurni.com/api/v1/furniture?per_page=100&page=${state.currentPage}`, {
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Accept': 'application/json',
                    'X-Hotel-ID': '3'
                }
            });

            if (!res.ok) {
                console.error(`⚠️ Error API (HTTP ${res.status}). Reintentando en 10s...`);
                await new Promise(r => setTimeout(r, 10000));
                continue;
            }

            const json = await res.json();
            if (state.currentPage === 1 || state.totalPages === 1) {
                state.totalPages = json.meta.last_page;
                console.log(`Total: ${json.meta.total} furnis | ${state.totalPages} páginas.`);
            }

            for (const item of json.data) {
                if (isStopping) break;

                const classname = item.classname;
                const apiData = item.hotelData || {};
                if (!apiData) continue;

                // Check DB and Filesystem
                const [existing] = await connection.execute('SELECT id FROM items_base WHERE item_name = ? LIMIT 1', [classname]);
                const isInDb = existing.length > 0;
                
                let nitroExists = fs.existsSync(path.join(NITRO_BUNDLED_PATH, `${classname.split('*')[0]}.nitro`));

                if (isInDb && nitroExists) continue;

                if (!isInDb) state.totalMissing++;
                if (isInDb && !nitroExists) state.totalBroken++;

                process.stdout.write(` > ${classname}... `);

                // Download and Convert
                if (apiData.swf?.url) {
                    try {
                        const baseClassname = classname.split('*')[0];
                        const swfRes = await fetch(apiData.swf.url);
                        if (swfRes.ok) {
                            fs.writeFileSync(path.join(CONVERTER_SWF_PATH, `${baseClassname}.swf`), Buffer.from(await swfRes.arrayBuffer()));
                            
                            if (apiData.icon?.url) {
                                const iconBuf = Buffer.from(await (await fetch(apiData.icon.url)).arrayBuffer());
                                fs.writeFileSync(path.join(config.dcr_icons_path, `${baseClassname}_icon.png`), iconBuf);
                                fs.writeFileSync(path.join(config.cms_icons_path, `${baseClassname}_icon.png`), iconBuf);
                            }

                            execSync('source /home/surcity-hotel/.nvm/nvm.sh && node ./dist/Main.js --convert-swf', {
                                cwd: config.converter_cwd,
                                shell: '/bin/bash',
                                stdio: 'ignore'
                            });

                            const converted = path.join(CONVERTER_BUNDLED_PATH, `${baseClassname}.nitro`);
                            if (fs.existsSync(converted)) {
                                fs.copyFileSync(converted, path.join(NITRO_BUNDLED_PATH, `${baseClassname}.nitro`));
                            }
                        }
                    } catch (e) { console.log(`[Error SWF/Nitro] `); }
                }

                // DB and JSON Update
                if (!isInDb) {
                    try {
                        const pageId = await getOrCreateCampaignPage(connection, apiData.furni_line);
                        const [maxRows] = await connection.execute("SELECT MAX(id) as maxId FROM items_base");
                        const nextId = (maxRows[0].maxId || 20260000) + 1;
                        
                        const type = apiData.type === 'wall' ? 'i' : 's';
                        const lowerClass = classname.toLowerCase();
                        const canSit = (apiData.can_sit_on || apiData.can_sit || lowerClass.includes('chair') || lowerClass.includes('sofa') || lowerClass.includes('bench') || lowerClass.includes('stool') || lowerClass.includes('seat')) ? 1 : 0;
                        const canLay = (apiData.can_lay_on || apiData.can_lay || lowerClass.includes('bed') || lowerClass.includes('lay')) ? 1 : 0;
                        const canWalk = (apiData.can_stand_on || apiData.can_walk || lowerClass.includes('rug') || lowerClass.includes('carpet')) ? 1 : 0;

                        const baseClassname = classname.split('*')[0];
                        const nitroPath = path.join(NITRO_BUNDLED_PATH, `${baseClassname}.nitro`);
                        const physics = extractPhysics(nitroPath);

                        // Determinar allow_stack de forma inteligente
                        let allowStack = 0;
                        if (canWalk) allowStack = 1;
                        else if (physics.stackHeight > 0 && physics.stackHeight < 1.6 && !canSit && !canLay && type === 's') allowStack = 1;

                        // Detectar tipo de interacción inteligente
                        const detection = detectInteractionType(classname, apiData);

                        await connection.execute(
                            `INSERT INTO items_base (id, sprite_id, item_name, public_name, width, length, stack_height, allow_stack, allow_sit, allow_lay, allow_walk, allow_gift, allow_trade, allow_recycle, allow_marketplace_sell, allow_inventory_stack, type, interaction_type, interaction_modes_count, vending_ids, multiheight, customparams, effect_id_male, effect_id_female, clothing_on_walk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 1, ?, ?, ?, ?, '0', '', 0, 0, '')`,
                            [nextId, nextId, classname, apiData.name || classname, apiData.xdim || 1, apiData.ydim || 1, physics.stackHeight, allowStack, canSit, canLay, canWalk, type, detection.interactionType, physics.modesCount, detection.vendingIds]
                        );

                        if (detection.isClothing && detection.clothingSetId) {
                            try {
                                await connection.execute(
                                    `INSERT INTO catalog_clothing (name, setid) VALUES (?, ?)`,
                                    [classname, detection.clothingSetId]
                                );
                            } catch (clothErr) {
                                console.log(`[Warn DB] Error insertando ropa en catalog_clothing: ${clothErr.message}`);
                            }
                        }

                        await connection.execute(
                            `INSERT INTO catalog_items (item_ids, page_id, catalog_name, cost_credits, cost_points, points_type, amount, limited_sells, limited_stack, extradata, have_offer) VALUES (?, ?, ?, ?, 0, 0, 1, 0, 0, '', '1')`,
                            [nextId.toString(), pageId, classname, defaultPrice]
                        );

                        const entry = { 
                            id: nextId, 
                            classname, 
                            revision: apiData.revision || 1, 
                            name: apiData.name || classname, 
                            description: apiData.description || classname, 
                            offerid: nextId, 
                            furniline: apiData.furni_line || "custom",
                            xdim: apiData.xdim || 1,
                            ydim: apiData.ydim || 1,
                            canstandon: canWalk,
                            cansiton: canSit,
                            canlayon: canLay
                        };
                        if (type === 'i') {
                            if (!furniDataObj.wallitemtypes) furniDataObj.wallitemtypes = { furnitype: [] };
                            if (!furniDataObj.wallitemtypes.furnitype) furniDataObj.wallitemtypes.furnitype = [];
                            furniDataObj.wallitemtypes.furnitype.push(entry);
                        } else {
                            if (!furniDataObj.roomitemtypes) furniDataObj.roomitemtypes = { furnitype: [] };
                            if (!furniDataObj.roomitemtypes.furnitype) furniDataObj.roomitemtypes.furnitype = [];
                            furniDataObj.roomitemtypes.furnitype.push(entry);
                        }
                    } catch (e) { console.log(`[Error DB] `); }
                }
                
                state.totalProcessed++;
                process.stdout.write(`OK\n`);
            }

            // End of page checkpoint
            if (fs.existsSync(FURNITURE_DATA_PATH)) {
                fs.copyFileSync(FURNITURE_DATA_PATH, FURNITURE_DATA_PATH + '.bak');
            }
            fs.writeFileSync(FURNITURE_DATA_PATH, JSON.stringify(furniDataObj, null, 2));
            if (!isStopping) {
                state.currentPage++;
                fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
            }

        } catch (error) {
            console.error("\n❌ Error en bucle:", error.message);
            await new Promise(r => setTimeout(r, 5000));
        }
    }

    if (isStopping) {
        console.log("\n\x1b[31m%s\x1b[0m", "--- PROCESO PAUSADO Y GUARDADO ---");
        console.log(`Te has quedado en la página ${state.currentPage}.`);
    } else {
        console.log("\n\x1b[32m%s\x1b[0m", "--- SINCRONIZACIÓN COMPLETADA ---");
        if (fs.existsSync(STATE_FILE)) fs.unlinkSync(STATE_FILE);
    }

    console.log(`Nuevos: ${state.totalMissing} | Reparados: ${state.totalBroken}`);
    await connection.end();
    rl.close();
}

main();

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const mysql = require('mysql2/promise');
const { execSync } = require('child_process');

const config = require('../config.js');
const { extractPhysics, detectInteractionType } = require('./nitro_extractor');

const API_TOKEN = config.api_token;
const FURNITURE_DATA_PATH = config.furniture_data_path;
const NITRO_BUNDLED_PATH = config.nitro_bundled_path;
const CONVERTER_SWF_PATH = config.converter_swf_path;
const CONVERTER_BUNDLED_PATH = config.converter_bundled_path;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
    console.log("=== HabboFurni Importer ===");

    const dbConfig = {
        host: config.db_host,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log("Connected to MySQL.");
    } catch (err) {
        console.error("Failed to connect to MySQL:", err.message);
        process.exit(1);
    }

    let pageId;
    const action = await question("Do you want to (1) use an existing catalog page or (2) create a new one? [1/2]: ");
    if (action === '2') {
        const pageName = await question("Enter new page name (e.g. 2026 Nuevos): ");
        const parentId = await question("Enter parent_id (e.g. 7 for main category): ");
        const iconId = await question("Enter icon_color/image (e.g. 1): ");
        
        try {
            const [result] = await connection.execute(
                `INSERT INTO catalog_pages (parent_id, caption, page_layout, icon_color, icon_image, min_rank, order_num, visible, enabled, club_only) 
                 VALUES (?, ?, 'default_3x3', ?, ?, 1, 1, '1', '1', '0')`,
                [parseInt(parentId) || 7, pageName, parseInt(iconId) || 1, parseInt(iconId) || 1]
            );
            pageId = result.insertId;
            console.log(`Created new catalog page with ID: ${pageId}`);
        } catch (e) {
            console.error("Failed to create page:", e);
            process.exit(1);
        }
    } else {
        pageId = await question("Enter existing catalog page ID: ");
        pageId = parseInt(pageId);
    }

    const price = await question("Enter cost_credits for the furnis (default 150): ") || 150;
    const points = await question("Enter cost_points for the furnis (default 0): ") || 0;
    const pointsType = await question("Enter points_type (0 = Duckets, 5 = Diamonds) (default 0): ") || 0;

    const classnamesInput = await question("Enter furni classnames separated by commas (e.g. fireplace_armas, lt_c26_goldenstatue): ");
    const classnames = classnamesInput.split(',').map(s => s.trim()).filter(s => s.length > 0);

    if (classnames.length === 0) {
        console.log("No classnames provided. Exiting.");
        process.exit(0);
    }

    // Load FurnitureData
    console.log("Reading FurnitureData.json...");
    let furniDataObj;
    try {
        const rawData = fs.readFileSync(FURNITURE_DATA_PATH, 'utf8');
        furniDataObj = JSON.parse(rawData);
    } catch(err) {
        console.error("Failed to read FurnitureData.json:", err.message);
        process.exit(1);
    }

    for (const classname of classnames) {
        console.log(`\n--- Processing: ${classname} ---`);
        try {
            // 0. Check if already exists in DB
            const [existing] = await connection.execute('SELECT id FROM items_base WHERE item_name = ? LIMIT 1', [classname]);
            if (existing.length > 0) {
                console.log(`Skipping ${classname}: Already exists in database with ID ${existing[0].id}.`);
                continue;
            }

            // 1. Fetch API
            console.log(`Fetching API info for ${classname}...`);
            const res = await fetch(`https://habbofurni.com/api/v1/furniture/${classname}`, {
                headers: {
                    'Authorization': `Bearer ${API_TOKEN}`,
                    'Accept': 'application/json',
                    'X-Hotel-ID': '3'
                }
            });
            if (!res.ok) {
                console.error(`API Error: ${res.status} ${res.statusText}`);
                continue;
            }
            const resJson = await res.json();
            const dataObj = resJson.data;
            if (!dataObj || !dataObj.hotelData) {
                console.error(`Furni ${classname} not found on HabboFurni API.`);
                continue;
            }
            const apiData = dataObj.hotelData || {};
            const swfUrl = apiData.swf.url;

            // 2. Download SWF and Icon
            console.log(`Downloading SWF from ${swfUrl}...`);
            const baseClassname = classname.split('*')[0];
            const swfRes = await fetch(swfUrl);
            if (!swfRes.ok) throw new Error("Failed to download SWF");
            const swfBuffer = await swfRes.arrayBuffer();
            const swfPath = path.join(CONVERTER_SWF_PATH, `${baseClassname}.swf`);
            fs.writeFileSync(swfPath, Buffer.from(swfBuffer));
            console.log(`Saved SWF to ${swfPath}`);

            if (apiData.icon && apiData.icon.url) {
                console.log(`Downloading Icon from ${apiData.icon.url}...`);
                const iconRes = await fetch(apiData.icon.url);
                if (iconRes.ok) {
                    const iconBuffer = await iconRes.arrayBuffer();
                    const iconPath1 = path.join(config.dcr_icons_path, `${baseClassname}_icon.png`);
                    const iconPath2 = path.join(config.cms_icons_path, `${baseClassname}_icon.png`);
                    fs.writeFileSync(iconPath1, Buffer.from(iconBuffer));
                    fs.writeFileSync(iconPath2, Buffer.from(iconBuffer));
                    console.log(`Saved Icon for CMS/Catalogue fallbacks.`);
                }
            }


            // 3. Run Converter
            console.log(`Converting ${classname}.swf to .nitro...`);
            try {
                execSync('source /home/surcity-hotel/.nvm/nvm.sh && node ./dist/Main.js --convert-swf', {
                    cwd: config.converter_cwd,
                    shell: '/bin/bash',
                    stdio: 'ignore'
                });
            } catch(e) {
                console.error("Converter failed.");
                continue;
            }

            // 4. Move .nitro
            const convertedNitro = path.join(CONVERTER_BUNDLED_PATH, `${baseClassname}.nitro`);
            if (!fs.existsSync(convertedNitro)) {
                console.error(`Expected nitro file not found at ${convertedNitro}`);
                continue;
            }
            const destNitro = path.join(NITRO_BUNDLED_PATH, `${baseClassname}.nitro`);
            fs.copyFileSync(convertedNitro, destNitro);
            console.log(`Copied .nitro to ${destNitro}`);

            // 5. Calculate ID
            const [maxRows] = await connection.execute("SELECT MAX(id) as maxId FROM items_base");
            const nextId = (maxRows[0].maxId || 20260000) + 1;

            // 6. DB Inserts
            const typeLetter = apiData.type === 'wall' ? 'i' : 's';
            const width = apiData.xdim || 1;
            const length = apiData.ydim || 1;
            const lowerClass = classname.toLowerCase();
            const canSit = (apiData.can_sit_on || apiData.can_sit || lowerClass.includes('chair') || lowerClass.includes('sofa') || lowerClass.includes('bench') || lowerClass.includes('stool') || lowerClass.includes('seat')) ? 1 : 0;
            const canLay = (apiData.can_lay_on || apiData.can_lay || lowerClass.includes('bed') || lowerClass.includes('lay')) ? 1 : 0;
            const canWalk = (apiData.can_stand_on || apiData.can_walk || lowerClass.includes('rug') || lowerClass.includes('carpet')) ? 1 : 0;
            
            const physics = extractPhysics(destNitro);
            let allowStack = 0;
            if (canWalk) allowStack = 1;
            else if (physics.stackHeight > 0 && physics.stackHeight < 1.6 && !canSit && !canLay && typeLetter === 's') allowStack = 1;

            const detection = detectInteractionType(classname, apiData);

            console.log(`Inserting into database con ID ${nextId} (Altura: ${physics.stackHeight}, Estados: ${physics.modesCount}, Tipo: ${detection.interactionType})...`);
            
            await connection.execute(
                `INSERT INTO items_base 
                (id, sprite_id, item_name, public_name, width, length, stack_height, allow_stack, allow_sit, allow_lay, allow_walk, allow_gift, allow_trade, allow_recycle, allow_marketplace_sell, allow_inventory_stack, type, interaction_type, interaction_modes_count, vending_ids, multiheight, customparams, effect_id_male, effect_id_female, clothing_on_walk) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, 0, 0, 1, ?, ?, ?, ?, '0', '', 0, 0, '')`,
                [nextId, nextId, classname, apiData.name || classname, width, length, physics.stackHeight, allowStack, canSit, canLay, canWalk, typeLetter, detection.interactionType, physics.modesCount, detection.vendingIds]
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
                `INSERT INTO catalog_items 
                (item_ids, page_id, catalog_name, cost_credits, cost_points, points_type, amount, limited_sells, limited_stack, extradata, have_offer) 
                VALUES (?, ?, ?, ?, ?, ?, 1, 0, 0, '', '1')`,
                [nextId.toString(), pageId, classname, parseInt(price), parseInt(points), parseInt(pointsType)]
            );

            // 7. Update FurnitureData.json
            const furniEntry = {
                id: nextId,
                classname: classname,
                revision: apiData.revision || 1,
                category: apiData.category || "other",
                defaultdir: apiData.default_dir || 0,
                xdim: width,
                ydim: length,
                partcolors: apiData.part_colors || { color: [] },
                name: apiData.name || classname,
                description: apiData.description || classname,
                adurl: "",
                offerid: nextId,
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

            if (apiData.type === 'wall') {
                if (!furniDataObj.wallitemtypes) furniDataObj.wallitemtypes = { furnitype: [] };
                if (!furniDataObj.wallitemtypes.furnitype) furniDataObj.wallitemtypes.furnitype = [];
                
                const exists = furniDataObj.wallitemtypes.furnitype.findIndex(f => f.classname === classname);
                if (exists >= 0) furniDataObj.wallitemtypes.furnitype[exists] = furniEntry;
                else furniDataObj.wallitemtypes.furnitype.push(furniEntry);
            } else {
                if (!furniDataObj.roomitemtypes) furniDataObj.roomitemtypes = { furnitype: [] };
                if (!furniDataObj.roomitemtypes.furnitype) furniDataObj.roomitemtypes.furnitype = [];
                
                const exists = furniDataObj.roomitemtypes.furnitype.findIndex(f => f.classname === classname);
                if (exists >= 0) furniDataObj.roomitemtypes.furnitype[exists] = furniEntry;
                else furniDataObj.roomitemtypes.furnitype.push(furniEntry);
            }

            console.log(`Finished processing ${classname}.`);

        } catch(err) {
            console.error(`Error processing ${classname}:`, err.message);
        }
    }

    console.log("\nSaving FurnitureData.json...");
    if (fs.existsSync(FURNITURE_DATA_PATH)) {
        fs.copyFileSync(FURNITURE_DATA_PATH, FURNITURE_DATA_PATH + '.bak');
        console.log("Created backup: FurnitureData.json.bak");
    }
    fs.writeFileSync(FURNITURE_DATA_PATH, JSON.stringify(furniDataObj, null, 2));
    
    console.log("\nAll done! Please restart your emulator or run ':update items' and ':update catalog' in-game, and clear your browser cache.");
    await connection.end();
    rl.close();
}

main();

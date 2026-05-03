const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const readline = require('readline');
const config = require('../config.js');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

async function main() {
    console.log("==============================================");
    console.log("  Habbo Tools Suite: Limpiador de Huérfanos   ");
    console.log("==============================================\n");

    const dbConfig = {
        host: config.db_host,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log("Conectado a MySQL.\n");
    } catch (err) {
        console.error("Fallo al conectar a MySQL:", err.message);
        rl.close();
        process.exit(1);
    }

    let totalOrphans = 0;

    // --- 1. Orphan catalog_items (point to non-existent items_base) ---
    console.log("--- Fase 1: Buscando catalog_items huérfanos ---");
    console.log("(Furnis en el catálogo cuyo item_base ya no existe)\n");

    const [orphanCatalog] = await connection.execute(`
        SELECT ci.id, ci.catalog_name, ci.page_id, ci.item_ids
        FROM catalog_items ci
        WHERE ci.item_ids != ''
        AND ci.item_ids NOT IN (SELECT CAST(id AS CHAR) FROM items_base)
        AND ci.item_ids NOT LIKE '%;%'
        LIMIT 500
    `);

    if (orphanCatalog.length === 0) {
        console.log("✅ No se encontraron catalog_items huérfanos.\n");
    } else {
        console.log(`⚠️ Se encontraron ${orphanCatalog.length} catalog_items huérfanos:\n`);
        for (const item of orphanCatalog.slice(0, 20)) {
            console.log(`  - ID: ${item.id} | Nombre: ${item.catalog_name} | Página: ${item.page_id} | item_ids: ${item.item_ids}`);
        }
        if (orphanCatalog.length > 20) console.log(`  ... y ${orphanCatalog.length - 20} más.`);
        totalOrphans += orphanCatalog.length;

        const confirm1 = await question("\n¿Eliminar estos registros huérfanos del catálogo? [y/N]: ");
        if (confirm1.toLowerCase() === 'y') {
            const ids = orphanCatalog.map(i => i.id);
            const [result] = await connection.execute(
                `DELETE FROM catalog_items WHERE id IN (${ids.join(',')})`
            );
            console.log(`✅ Se eliminaron ${result.affectedRows} registros huérfanos de catalog_items.\n`);
        }
    }

    // --- 2. Empty catalog pages (pages with no items) ---
    console.log("--- Fase 2: Buscando páginas de catálogo vacías ---");
    console.log("(Páginas que no contienen ningún furni)\n");

    const [emptyPages] = await connection.execute(`
        SELECT cp.id, cp.caption, cp.parent_id
        FROM catalog_pages cp
        LEFT JOIN catalog_items ci ON ci.page_id = cp.id
        WHERE ci.id IS NULL
        AND cp.page_layout != 'frontpage'
        AND cp.page_layout != 'frontpage_featured'
        AND cp.caption NOT IN ('root', 'Frontpage')
        ORDER BY cp.id
        LIMIT 200
    `);

    if (emptyPages.length === 0) {
        console.log("✅ No se encontraron páginas vacías.\n");
    } else {
        console.log(`⚠️ Se encontraron ${emptyPages.length} páginas vacías:\n`);
        for (const page of emptyPages.slice(0, 20)) {
            console.log(`  - ID: ${page.id} | Nombre: ${page.caption} | Parent: ${page.parent_id}`);
        }
        if (emptyPages.length > 20) console.log(`  ... y ${emptyPages.length - 20} más.`);
        totalOrphans += emptyPages.length;

        console.log("\n⚠️ CUIDADO: Algunas páginas vacías pueden ser categorías padre (contenedores).");
        const confirm2 = await question("¿Eliminar SOLO las que NO son padres de otras páginas? [y/N]: ");
        if (confirm2.toLowerCase() === 'y') {
            // Only delete pages that aren't parents of other pages
            const pageIds = emptyPages.map(p => p.id);
            const [children] = await connection.execute(
                `SELECT DISTINCT parent_id FROM catalog_pages WHERE parent_id IN (${pageIds.join(',')})`
            );
            const parentIds = new Set(children.map(c => c.parent_id));
            const safeToDelete = pageIds.filter(id => !parentIds.has(id));

            if (safeToDelete.length > 0) {
                const [result] = await connection.execute(
                    `DELETE FROM catalog_pages WHERE id IN (${safeToDelete.join(',')})`
                );
                console.log(`✅ Se eliminaron ${result.affectedRows} páginas vacías (sin hijos).\n`);
            } else {
                console.log("Todas las páginas vacías son padres de otras. No se borró nada.\n");
            }
        }
    }

    // --- 3. FurnitureData.json cleanup ---
    console.log("--- Fase 3: Limpiando FurnitureData.json ---");
    console.log("(Entradas en el JSON que ya no existen en items_base)\n");

    const furniDataPath = config.furniture_data_path;
    if (fs.existsSync(furniDataPath)) {
        const furniData = JSON.parse(fs.readFileSync(furniDataPath, 'utf8'));

        // Get all classnames from DB
        const [allItems] = await connection.execute("SELECT item_name FROM items_base");
        const dbClassnames = new Set(allItems.map(i => i.item_name));

        let orphansInJson = 0;
        let cleanedJson = false;

        for (const section of ['roomitemtypes', 'wallitemtypes']) {
            if (furniData[section] && furniData[section].furnitype) {
                const before = furniData[section].furnitype.length;
                furniData[section].furnitype = furniData[section].furnitype.filter(f => dbClassnames.has(f.classname));
                const removed = before - furniData[section].furnitype.length;
                if (removed > 0) {
                    console.log(`  ${section}: ${removed} entradas huérfanas encontradas.`);
                    orphansInJson += removed;
                }
            }
        }

        if (orphansInJson === 0) {
            console.log("✅ FurnitureData.json está limpio.\n");
        } else {
            totalOrphans += orphansInJson;
            const confirm3 = await question(`\n¿Eliminar ${orphansInJson} entradas huérfanas del JSON? [y/N]: `);
            if (confirm3.toLowerCase() === 'y') {
                fs.writeFileSync(furniDataPath, JSON.stringify(furniData, null, 2));
                console.log("✅ FurnitureData.json limpiado y guardado.\n");
            }
        }
    }

    // Summary
    console.log("==============================================");
    console.log(`   RESUMEN: ${totalOrphans} registros huérfanos detectados en total.`);
    console.log("==============================================");
    if (totalOrphans > 0) {
        console.log("Recuerda usar ':update catalog' y ':update items' en el emulador.");
    }

    await connection.end();
    rl.close();
}

main();

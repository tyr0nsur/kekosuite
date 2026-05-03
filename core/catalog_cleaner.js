const mysql = require('mysql2/promise');
const config = require('../config.js');

async function cleanCatalog() {
    console.log("=== Limpiador de Catálogo ===");

    const dbConfig = {
        host: config.db_host,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        console.log("Conectado a MySQL.");
    } catch (err) {
        console.error("Error conectando a MySQL:", err.message);
        process.exit(1);
    }

    console.log("Buscando furnis huérfanos en el catálogo...");
    try {
        // En Arcturus, item_ids en catalog_items apunta a items_base.id
        // Vamos a borrar los catalog_items donde su item_id no exista en items_base.
        const [rows] = await connection.execute(`
            SELECT ci.id, ci.item_ids 
            FROM catalog_items ci 
            LEFT JOIN items_base ib ON ci.item_ids = ib.id 
            WHERE ib.id IS NULL AND ci.item_ids != ''
        `);

        if (rows.length === 0) {
            console.log("¡El catálogo está limpio! No se encontraron furnis huérfanos.");
        } else {
            console.log(`Se encontraron ${rows.length} furnis huérfanos. Eliminando...`);
            let deletedCount = 0;
            for (const row of rows) {
                await connection.execute('DELETE FROM catalog_items WHERE id = ?', [row.id]);
                deletedCount++;
            }
            console.log(`✅ Se eliminaron ${deletedCount} furnis huérfanos del catálogo.`);
        }

        console.log("Buscando páginas de catálogo sin contenido...");
        const [emptyPages] = await connection.execute(`
            SELECT cp.id, cp.caption 
            FROM catalog_pages cp 
            LEFT JOIN catalog_items ci ON cp.id = ci.page_id 
            WHERE ci.id IS NULL AND cp.parent_id != -1 AND cp.visible = '1'
        `);

        if (emptyPages.length > 0) {
            console.log(`Se encontraron ${emptyPages.length} páginas vacías. Ocultando...`);
            for (const page of emptyPages) {
                await connection.execute("UPDATE catalog_pages SET visible = '0', enabled = '0', parent_id = -1 WHERE id = ?", [page.id]);
            }
            console.log(`✅ Páginas vacías movidas al archivo oculto.`);
        }

    } catch (e) {
        console.error("Error limpiando el catálogo:", e);
    }

    await connection.end();
    console.log("=== Limpieza completada ===");
}

cleanCatalog();

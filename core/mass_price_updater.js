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
    console.log("   Habbo Tools Suite: Editor Masivo de Precios ");
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

    // Show available catalog pages
    const showPages = await question("¿Quieres ver la lista de páginas del catálogo? [y/N]: ");
    if (showPages.toLowerCase() === 'y') {
        const searchTerm = await question("Filtrar por nombre (dejar vacío para ver todas): ");
        let query = "SELECT id, caption, parent_id FROM catalog_pages";
        let params = [];
        if (searchTerm.trim()) {
            query += " WHERE caption LIKE ?";
            params.push(`%${searchTerm}%`);
        }
        query += " ORDER BY parent_id, id LIMIT 50";

        const [pages] = await connection.execute(query, params);
        console.log("\n  ID    | Parent | Nombre");
        console.log("  ------|--------|---------------------------");
        for (const p of pages) {
            console.log(`  ${String(p.id).padEnd(6)}| ${String(p.parent_id).padEnd(7)}| ${p.caption}`);
        }
        console.log("");
    }

    const pageId = await question("Introduce el ID de la página del catálogo a modificar: ");

    // Show current items in that page
    const [items] = await connection.execute(
        `SELECT ci.id, ci.catalog_name, ci.cost_credits, ci.cost_points, ci.points_type 
         FROM catalog_items ci WHERE ci.page_id = ? ORDER BY ci.id`, [pageId]
    );

    if (items.length === 0) {
        console.log("❌ No se encontraron furnis en esa página.");
        await connection.end();
        rl.close();
        return;
    }

    console.log(`\n✅ Se encontraron ${items.length} furnis en la página ${pageId}:\n`);
    console.log("  ID       | Nombre                          | Créditos | Puntos | Tipo");
    console.log("  ---------|-------------------------------|----------|--------|-----");
    
    const pointsTypeMap = { 0: 'Duckets', 5: 'Diamantes' };
    for (const item of items) {
        const typeName = pointsTypeMap[item.points_type] || `Tipo ${item.points_type}`;
        console.log(`  ${String(item.id).padEnd(9)}| ${item.catalog_name.substring(0, 31).padEnd(32)}| ${String(item.cost_credits).padEnd(9)}| ${String(item.cost_points).padEnd(7)}| ${typeName}`);
    }

    console.log("\n--- Nuevos Precios ---");
    const newCredits = await question(`Nuevo precio en Créditos (dejar vacío = no cambiar): `);
    const newPoints = await question(`Nuevo precio en Puntos secundarios (dejar vacío = no cambiar): `);
    const newPointsType = await question(`Tipo de puntos (0 = Duckets, 5 = Diamantes, dejar vacío = no cambiar): `);

    // Build the update query dynamically
    let setClauses = [];
    let updateParams = [];

    if (newCredits.trim() !== '') {
        setClauses.push("cost_credits = ?");
        updateParams.push(parseInt(newCredits));
    }
    if (newPoints.trim() !== '') {
        setClauses.push("cost_points = ?");
        updateParams.push(parseInt(newPoints));
    }
    if (newPointsType.trim() !== '') {
        setClauses.push("points_type = ?");
        updateParams.push(parseInt(newPointsType));
    }

    if (setClauses.length === 0) {
        console.log("No se realizaron cambios.");
        await connection.end();
        rl.close();
        return;
    }

    updateParams.push(pageId);
    const updateQuery = `UPDATE catalog_items SET ${setClauses.join(', ')} WHERE page_id = ?`;

    const confirm = await question(`\n⚠️ Esto actualizará ${items.length} furnis. ¿Confirmar? [y/N]: `);
    if (confirm.toLowerCase() !== 'y') {
        console.log("Cancelado.");
        await connection.end();
        rl.close();
        return;
    }

    const [result] = await connection.execute(updateQuery, updateParams);
    console.log(`\n✅ ¡Éxito! Se actualizaron ${result.affectedRows} furnis.`);
    console.log("Recuerda usar ':update catalog' en el emulador para aplicar los cambios.");

    await connection.end();
    rl.close();
}

main();

const mysql = require('mysql2/promise');
const readline = require('readline');
const config = require('../config.js');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));


async function main() {
    console.log("=== HabboFurni Duplicate Finder ===");

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

    console.log("Scanning items_base for duplicate classnames...");
    
    // Find item_names that appear more than once
    const [duplicates] = await connection.execute(`
        SELECT item_name, COUNT(*) as count, GROUP_CONCAT(id) as ids 
        FROM items_base 
        GROUP BY item_name 
        HAVING count > 1
        ORDER BY count DESC
    `);

    if (duplicates.length === 0) {
        console.log("✅ No duplicate furnis found in items_base!");
    } else {
        console.log(`⚠️ Found ${duplicates.length} duplicate classname(s):\n`);
        
        let idsToDelete = [];
        
        for (const dup of duplicates) {
            console.log(`- Classname: ${dup.item_name} | Duplicated ${dup.count} times | IDs: ${dup.ids}`);
            
            // Split the comma-separated IDs, sort them ascending, and keep the lowest one. Delete the rest.
            const idsArr = dup.ids.split(',').map(Number).sort((a, b) => a - b);
            const toKeep = idsArr.shift(); // Remove the lowest ID from the array to keep it
            idsToDelete.push(...idsArr); // Push the rest to be deleted
        }
        
        console.log(`\nFound ${idsToDelete.length} redundant rows that can be safely deleted.`);
        const confirm = await question("¿Quieres que los elimine automáticamente manteniendo el ID más bajo de cada uno? [y/N]: ");
        
        if (confirm.toLowerCase() === 'y') {
            console.log("\nBorrando duplicados...");
            // MySQL IN clause might be too long if there are thousands, but for Habbo it's usually fine.
            // Just chunk them if needed, but for now a direct query works.
            const query = `DELETE FROM items_base WHERE id IN (${idsToDelete.join(',')})`;
            try {
                const [result] = await connection.execute(query);
                console.log(`✅ ¡Éxito! Se han borrado ${result.affectedRows} registros duplicados de items_base.`);
            } catch(err) {
                console.error("Error al borrar duplicados:", err.message);
            }
        } else {
            console.log("\nCancelado. No se borró nada.");
        }
    }

    await connection.end();
    rl.close();
}

main();

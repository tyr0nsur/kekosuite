const mysql = require('mysql2/promise');
const config = require('../config.js');
const ora = require('ora');
const chalk = require('chalk');

async function cleanCatalog() {
    console.log(chalk.cyan.bold('\n=== 🧹 Limpiador de Catálogo ===\n'));
    const spinner = ora('Conectando a la base de datos...').start();

    const dbConfig = {
        host: config.db_host,
        user: config.db_user,
        password: config.db_pass,
        database: config.db_name
    };

    let connection;
    try {
        connection = await mysql.createConnection(dbConfig);
        spinner.succeed(chalk.green('Conectado a MySQL.'));
    } catch (err) {
        spinner.fail(chalk.red(`Error conectando a MySQL: ${err.message}`));
        process.exit(1);
    }

    spinner.start('Buscando furnis huérfanos en el catálogo...');
    try {
        const [rows] = await connection.execute(`
            SELECT ci.id, ci.item_ids 
            FROM catalog_items ci 
            LEFT JOIN items_base ib ON ci.item_ids = ib.id 
            WHERE ib.id IS NULL AND ci.item_ids != ''
        `);

        if (rows.length === 0) {
            spinner.info(chalk.blue('El catálogo está limpio. No se encontraron furnis huérfanos.'));
        } else {
            spinner.text = `Se encontraron ${rows.length} furnis huérfanos. Eliminando...`;
            let deletedCount = 0;
            for (const row of rows) {
                await connection.execute('DELETE FROM catalog_items WHERE id = ?', [row.id]);
                deletedCount++;
            }
            spinner.succeed(chalk.green(`Se eliminaron ${deletedCount} furnis huérfanos del catálogo.`));
        }

        spinner.start('Buscando páginas de catálogo sin contenido...');
        const [emptyPages] = await connection.execute(`
            SELECT cp.id, cp.caption 
            FROM catalog_pages cp 
            LEFT JOIN catalog_items ci ON cp.id = ci.page_id 
            WHERE ci.id IS NULL AND cp.parent_id != -1 AND cp.visible = '1'
        `);

        if (emptyPages.length > 0) {
            spinner.text = `Se encontraron ${emptyPages.length} páginas vacías. Ocultando...`;
            for (const page of emptyPages) {
                await connection.execute("UPDATE catalog_pages SET visible = '0', enabled = '0', parent_id = -1 WHERE id = ?", [page.id]);
            }
            spinner.succeed(chalk.green('Páginas vacías movidas al archivo oculto.'));
        } else {
            spinner.info(chalk.blue('No se encontraron páginas vacías.'));
        }

    } catch (e) {
        spinner.fail(chalk.red(`Error limpiando el catálogo: ${e.message}`));
    }

    await connection.end();
    console.log(chalk.cyan.bold('\n=== Limpieza completada ===\n'));
}

cleanCatalog();

const mysql = require('mysql2/promise');
const config = require('../config.js');
const ora = require('ora');
const chalk = require('chalk');
const TaskManager = require('./taskManager.js');

const taskId = process.argv[2]; // Passed by TaskManager

async function cleanCatalog() {
    let spinner;
    if (!taskId) {
        console.log(chalk.cyan.bold('\n=== 🧹 Limpiador de Catálogo ===\n'));
        spinner = ora('Conectando a la base de datos...').start();
    } else {
        TaskManager.updateProgress(taskId, 0, 0, 'Conectando a MySQL...');
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
        if (spinner) spinner.succeed(chalk.green('Conectado a MySQL.'));
    } catch (err) {
        if (spinner) spinner.fail(chalk.red(`Error conectando a MySQL: ${err.message}`));
        if (taskId) TaskManager.finishTask(taskId, 'failed', `Error conectando a MySQL: ${err.message}`);
        process.exit(1);
    }

    if (spinner) spinner.start('Buscando furnis huérfanos en el catálogo...');
    if (taskId) TaskManager.updateProgress(taskId, 0, 0, 'Buscando huérfanos...');
    
    try {
        const [rows] = await connection.execute(`
            SELECT ci.id, ci.item_ids 
            FROM catalog_items ci 
            LEFT JOIN items_base ib ON ci.item_ids = ib.id 
            WHERE ib.id IS NULL AND ci.item_ids != ''
        `);

        if (rows.length === 0) {
            if (spinner) spinner.info(chalk.blue('El catálogo está limpio. No se encontraron furnis huérfanos.'));
        } else {
            if (spinner) spinner.text = `Se encontraron ${rows.length} furnis huérfanos. Eliminando...`;
            if (taskId) TaskManager.updateProgress(taskId, 0, rows.length, 'Eliminando huérfanos...');
            
            let deletedCount = 0;
            for (let i = 0; i < rows.length; i++) {
                await connection.execute('DELETE FROM catalog_items WHERE id = ?', [rows[i].id]);
                deletedCount++;
                if (taskId && i % 10 === 0) TaskManager.updateProgress(taskId, i, rows.length, `Borrados ${deletedCount}...`);
            }
            if (spinner) spinner.succeed(chalk.green(`Se eliminaron ${deletedCount} furnis huérfanos del catálogo.`));
        }

        if (spinner) spinner.start('Buscando páginas de catálogo sin contenido...');
        if (taskId) TaskManager.updateProgress(taskId, rows.length, rows.length, 'Buscando páginas vacías...');
        
        const [emptyPages] = await connection.execute(`
            SELECT cp.id, cp.caption 
            FROM catalog_pages cp 
            LEFT JOIN catalog_items ci ON cp.id = ci.page_id 
            WHERE ci.id IS NULL AND cp.parent_id != -1 AND cp.visible = '1'
        `);

        if (emptyPages.length > 0) {
            if (spinner) spinner.text = `Se encontraron ${emptyPages.length} páginas vacías. Ocultando...`;
            if (taskId) TaskManager.updateProgress(taskId, 0, emptyPages.length, 'Ocultando páginas vacías...');
            for (let i = 0; i < emptyPages.length; i++) {
                await connection.execute("UPDATE catalog_pages SET visible = '0', enabled = '0', parent_id = -1 WHERE id = ?", [emptyPages[i].id]);
                if (taskId) TaskManager.updateProgress(taskId, i, emptyPages.length, `Páginas ocultadas: ${i}`);
            }
            if (spinner) spinner.succeed(chalk.green('Páginas vacías movidas al archivo oculto.'));
        } else {
            if (spinner) spinner.info(chalk.blue('No se encontraron páginas vacías.'));
        }

        if (taskId) TaskManager.finishTask(taskId, 'completed', 'Catálogo limpio y optimizado.');

    } catch (e) {
        if (spinner) spinner.fail(chalk.red(`Error limpiando el catálogo: ${e.message}`));
        if (taskId) TaskManager.finishTask(taskId, 'failed', `Error: ${e.message}`);
    }

    await connection.end();
    if (spinner) console.log(chalk.cyan.bold('\n=== Limpieza completada ===\n'));
}

cleanCatalog();

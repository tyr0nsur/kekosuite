const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config.js');
const ora = require('ora');
const chalk = require('chalk');
const TaskManager = require('./taskManager.js');

const API_TOKEN = config.api_token;
const taskId = process.argv[2]; // Passed by TaskManager

async function fetchMissingIcons() {
    let spinner;
    if (!taskId) {
        console.log(chalk.cyan.bold('\n=== 🖼️  Descargador de Iconos Faltantes ===\n'));
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

    try {
        if (spinner) spinner.start('Analizando furnis en el catálogo...');
        if (taskId) TaskManager.updateProgress(taskId, 0, 0, 'Analizando furnis en el catálogo...');
        
        const [rows] = await connection.execute('SELECT id, item_name FROM items_base');
        const totalRows = rows.length;
        
        if (spinner) spinner.text = `Analizando ${totalRows} furnis en busca de iconos faltantes...`;
        if (taskId) TaskManager.updateProgress(taskId, 0, totalRows, 'Analizando iconos faltantes...');

        let downloadedCount = 0;

        for (let i = 0; i < totalRows; i++) {
            const classname = rows[i].item_name;
            const baseClassname = classname.split('*')[0];
            const iconName = `${baseClassname}_icon.png`;
            
            const cmsPath = path.join(config.cms_icons_path, iconName);
            const dcrPath = path.join(config.dcr_icons_path, iconName);

            if (!fs.existsSync(cmsPath) || !fs.existsSync(dcrPath)) {
                if (spinner) spinner.text = `Descargando icono para: ${chalk.yellow(classname)}...`;
                if (taskId) TaskManager.updateProgress(taskId, i, totalRows, `Descargando: ${classname} (${downloadedCount} bajados)`);
                
                try {
                    const res = await fetch(`https://habbofurni.com/api/v1/furniture/${classname}`, {
                        headers: {
                            'Authorization': `Bearer ${API_TOKEN}`,
                            'Accept': 'application/json',
                            'X-Hotel-ID': '3' // Español
                        }
                    });

                    if (!res.ok) continue;

                    const resJson = await res.json();
                    if (resJson.data && resJson.data.hotelData && resJson.data.hotelData.icon && resJson.data.hotelData.icon.url) {
                        const iconRes = await fetch(resJson.data.hotelData.icon.url);
                        if (iconRes.ok) {
                            const iconBuffer = await iconRes.arrayBuffer();
                            fs.writeFileSync(cmsPath, Buffer.from(iconBuffer));
                            fs.writeFileSync(dcrPath, Buffer.from(iconBuffer));
                            downloadedCount++;
                        }
                    }
                } catch (fetchErr) {
                    // Ignore and continue
                }
            } else {
                if (taskId && i % 50 === 0) {
                    TaskManager.updateProgress(taskId, i, totalRows, `Escaneando... (${downloadedCount} bajados)`);
                }
            }
        }

        const successMsg = `Proceso completado. Se descargaron ${downloadedCount} iconos faltantes.`;
        if (spinner) spinner.succeed(chalk.green.bold(successMsg));
        if (taskId) TaskManager.finishTask(taskId, 'completed', successMsg);

    } catch (e) {
        if (spinner) spinner.fail(chalk.red(`Error en el descargador: ${e.message}`));
        if (taskId) TaskManager.finishTask(taskId, 'failed', `Error: ${e.message}`);
    }

    await connection.end();
}

fetchMissingIcons();

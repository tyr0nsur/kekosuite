const mysql = require('mysql2/promise');
const config = require('../config.js');
const ora = require('ora');
const chalk = require('chalk');

async function generateOffers() {
    console.log(chalk.magenta.bold('\n=== ⚡ Generador de Ofertas Relámpago ===\n'));
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

    try {
        spinner.start('Borrando ofertas antiguas...');
        await connection.execute('DELETE FROM catalog_target_offers');
        spinner.succeed(chalk.green('Ofertas antiguas eliminadas.'));

        spinner.start('Seleccionando 3 furnis aleatorios del catálogo (precio > 10)...');
        const [items] = await connection.execute(`
            SELECT id, catalog_name, cost_credits 
            FROM catalog_items 
            WHERE cost_credits > 10 AND cost_points = 0 
            ORDER BY RAND() LIMIT 3
        `);

        if (items.length > 0) {
            spinner.text = 'Generando nuevas ofertas promocionales...';
            for (const item of items) {
                const offerCode = `PROMO_${item.catalog_name.toUpperCase()}_${Math.floor(Math.random() * 9999)}`;
                const title = `¡Oferta Relámpago: ${item.catalog_name}!`;
                const desc = `Obtén este increíble artículo con un 30% de descuento. ¡Solo por tiempo limitado!`;
                
                // 30% discount
                const newPrice = Math.floor(item.cost_credits * 0.7);

                await connection.execute(`
                    INSERT INTO catalog_target_offers 
                    (offer_code, title, description, image, icon, end_timestamp, credits, points, points_type, purchase_limit, catalog_item, vars) 
                    VALUES (?, ?, ?, '', '', ?, ?, 0, 0, 5, ?, '')
                `, [
                    offerCode,
                    title,
                    desc,
                    Math.floor(Date.now() / 1000) + (86400 * 3), // 3 days from now
                    newPrice,
                    item.id
                ]);
            }
            spinner.succeed(chalk.green.bold(`¡Éxito! Se generaron 3 nuevas ofertas promocionales con 30% de descuento.`));
        } else {
            spinner.info(chalk.blue('No se encontraron furnis elegibles para ofertas.'));
        }

    } catch (e) {
        spinner.fail(chalk.red(`Error generando ofertas: ${e.message}`));
    }

    await connection.end();
}

generateOffers();

const mysql = require('mysql2/promise');
const config = require('../config.js');

async function generateOffers() {
    console.log("=== Generador de Ofertas Relámpago ===");

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

    try {
        console.log("Borrando ofertas antiguas...");
        await connection.execute('TRUNCATE TABLE catalog_target_offers');

        console.log("Seleccionando 3 furnis aleatorios del catálogo...");
        // Select 3 random catalog items that cost credits to make an offer on them
        const [rows] = await connection.execute(`
            SELECT id, catalog_name, cost_credits 
            FROM catalog_items 
            WHERE cost_credits > 10 AND amount = 1
            ORDER BY RAND() 
            LIMIT 3
        `);

        if (rows.length < 3) {
            console.log("No hay suficientes furnis en el catálogo para generar ofertas.");
        } else {
            for (let i = 0; i < rows.length; i++) {
                const item = rows[i];
                const newPrice = Math.max(1, Math.floor(item.cost_credits * 0.7)); // 30% discount
                const offerCode = `LTD_OFFER_${i}_${Date.now()}`;
                const title = `¡Oferta Especial: ${item.catalog_name}!`;
                const desc = `¡Consigue este furni increíble con un 30% de descuento! Solo por tiempo limitado.`;

                await connection.execute(`
                    INSERT INTO catalog_target_offers 
                    (offer_code, title, description, image, icon, end_timestamp, price_in_credits, price_in_activity_points, activity_points_type, purchase_limit) 
                    VALUES (?, ?, ?, '', '', ?, ?, 0, 0, 5)
                `, [
                    offerCode,
                    title,
                    desc,
                    Math.floor(Date.now() / 1000) + (86400 * 3), // 3 days from now
                    newPrice
                ]);
            }
            console.log(`✅ Se generaron 3 nuevas ofertas con éxito.`);
        }

    } catch (e) {
        console.error("Error generando ofertas:", e);
    }

    await connection.end();
}

generateOffers();

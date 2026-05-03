const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const config = require('../config.js');

const API_TOKEN = config.api_token;

async function fetchMissingIcons() {
    console.log("=== Descargador de Iconos Faltantes ===");

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
        const [rows] = await connection.execute('SELECT id, item_name FROM items_base');
        console.log(`Analizando ${rows.length} furnis en busca de iconos faltantes...`);

        let downloadedCount = 0;

        for (const row of rows) {
            const classname = row.item_name;
            const baseClassname = classname.split('*')[0];
            const iconName = `${baseClassname}_icon.png`;
            
            const cmsPath = path.join(config.cms_icons_path, iconName);
            const dcrPath = path.join(config.dcr_icons_path, iconName);

            if (!fs.existsSync(cmsPath) || !fs.existsSync(dcrPath)) {
                console.log(`Icono faltante detectado para: ${classname}. Descargando...`);
                
                try {
                    const res = await fetch(`https://habbofurni.com/api/v1/furniture/${classname}`, {
                        headers: {
                            'Authorization': `Bearer ${API_TOKEN}`,
                            'Accept': 'application/json',
                            'X-Hotel-ID': '3'
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
            }
        }

        console.log(`✅ Proceso completado. Se descargaron ${downloadedCount} iconos faltantes.`);

    } catch (e) {
        console.error("Error en el descargador:", e);
    }

    await connection.end();
}

fetchMissingIcons();

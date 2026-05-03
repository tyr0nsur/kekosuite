const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const readline = require('readline');

const config = require('../config.js');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => new Promise(resolve => rl.question(query, resolve));

const HOTEL_FIGUREDATA_PATH = path.join(path.dirname(config.furniture_data_path), 'FigureData.json');
const HOTEL_FIGUREMAP_PATH = path.join(path.dirname(config.furniture_data_path), 'FigureMap.json');
const HOTEL_BUNDLED_FIGURE = path.join(path.dirname(config.nitro_bundled_path), 'figure');

const CONVERTER_CWD = config.converter_cwd;
const CONVERTER_CONFIG_PATH = path.join(CONVERTER_CWD, 'configuration.json');
const CONVERTER_GAMEDATA = path.join(CONVERTER_CWD, 'assets', 'gamedata');
const CONVERTER_BUNDLED_FIGURE = path.join(CONVERTER_CWD, 'assets', 'bundled', 'figure');

async function fetchGordonUrl() {
    console.log("Conectando a los servidores de Habbo.es para obtener la ruta de producción...");
    const res = await fetch('https://www.habbo.es/gamedata/external_variables/1', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });

    if (!res.ok) throw new Error(`Fallo al conectar a Habbo.es (HTTP ${res.status})`);

    const text = await res.text();
    const lines = text.split('\n');
    for (const line of lines) {
        if (line.startsWith('flash.client.url=')) {
            const url = line.split('=').slice(1).join('=').trim();
            console.log(`✅ Ruta de Producción encontrada: ${url}`);
            return url;
        }
    }
    throw new Error("No se pudo encontrar flash.client.url en external_variables");
}

function backupConverterConfig() {
    const backupPath = CONVERTER_CONFIG_PATH + '.bak';
    fs.copyFileSync(CONVERTER_CONFIG_PATH, backupPath);
    console.log("Backup de configuration.json creado.");
    return backupPath;
}

function restoreConverterConfig(backupPath) {
    fs.copyFileSync(backupPath, CONVERTER_CONFIG_PATH);
    fs.unlinkSync(backupPath);
    console.log("configuration.json restaurado a su estado original.");
}

function configureConverterForFigure(gordonUrl) {
    const cfg = JSON.parse(fs.readFileSync(CONVERTER_CONFIG_PATH, 'utf8'));
    cfg['flash.client.url'] = gordonUrl;
    cfg['figuredata.load.url'] = 'https://www.habbo.es/gamedata/figuredata/1';
    cfg['convert.figure'] = '1';
    cfg['convert.effect'] = '0';
    cfg['convert.furniture'] = '0';
    cfg['convert.pet'] = '0';
    fs.writeFileSync(CONVERTER_CONFIG_PATH, JSON.stringify(cfg, null, 2));
    console.log("Converter configurado para descargar solo ropa.");
}

function mergeFigureData(officialPath, localPath) {
    console.log("\n--- Fusionando FigureData.json ---");
    const official = JSON.parse(fs.readFileSync(officialPath, 'utf8'));
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    let newSetsAdded = 0;
    let newPaletteColorsAdded = 0;

    // Merge setTypes: compare by setType.type
    for (const officialSetType of official.setTypes) {
        const localSetType = local.setTypes.find(st => st.type === officialSetType.type);
        
        if (!localSetType) {
            // Entire setType is new, add it
            local.setTypes.push(officialSetType);
            const setCount = Object.keys(officialSetType.sets).length;
            newSetsAdded += setCount;
            console.log(`  Nuevo setType "${officialSetType.type}" añadido con ${setCount} sets.`);
            continue;
        }

        // Build a Set of existing set IDs for fast lookup
        const existingSetIds = new Set();
        for (const key of Object.keys(localSetType.sets)) {
            existingSetIds.add(localSetType.sets[key].id);
        }

        // Check each official set
        for (const key of Object.keys(officialSetType.sets)) {
            const officialSet = officialSetType.sets[key];
            if (!existingSetIds.has(officialSet.id)) {
                // New set! Add it with next available key
                const nextKey = Object.keys(localSetType.sets).length;
                localSetType.sets[nextKey.toString()] = officialSet;
                newSetsAdded++;
            }
        }
    }

    // Merge palettes: compare by palette id, then merge colors
    for (const officialPalette of official.palettes) {
        const localPalette = local.palettes.find(p => p.id === officialPalette.id);

        if (!localPalette) {
            local.palettes.push(officialPalette);
            console.log(`  Nueva paleta "${officialPalette.id}" añadida.`);
            continue;
        }

        // Merge colors within palette
        if (officialPalette.colors && localPalette.colors) {
            const existingColorIds = new Set();
            for (const key of Object.keys(localPalette.colors)) {
                existingColorIds.add(localPalette.colors[key].id);
            }

            for (const key of Object.keys(officialPalette.colors)) {
                const color = officialPalette.colors[key];
                if (!existingColorIds.has(color.id)) {
                    const nextKey = Object.keys(localPalette.colors).length;
                    localPalette.colors[nextKey.toString()] = color;
                    newPaletteColorsAdded++;
                }
            }
        }
    }

    console.log(`  Sets nuevos añadidos: ${newSetsAdded}`);
    console.log(`  Colores de paleta nuevos: ${newPaletteColorsAdded}`);

    fs.writeFileSync(localPath, JSON.stringify(local, null, 2));
    console.log("  FigureData.json actualizado y guardado.");
    return newSetsAdded;
}

function mergeFigureMap(officialPath, localPath) {
    console.log("\n--- Fusionando FigureMap.json ---");
    const official = JSON.parse(fs.readFileSync(officialPath, 'utf8'));
    const local = JSON.parse(fs.readFileSync(localPath, 'utf8'));

    const existingIds = new Set(local.libraries.map(l => l.id));
    const newLibraries = official.libraries.filter(l => !existingIds.has(l.id));

    for (const lib of newLibraries) {
        local.libraries.push(lib);
    }

    console.log(`  Librerías nuevas añadidas: ${newLibraries.length}`);

    fs.writeFileSync(localPath, JSON.stringify(local, null, 2));
    console.log("  FigureMap.json actualizado y guardado.");

    return newLibraries.map(l => l.id);
}

function copyNewNitroFiles(newLibraryIds) {
    console.log("\n--- Copiando archivos .nitro nuevos ---");
    let copied = 0;
    let notFound = 0;

    for (const libId of newLibraryIds) {
        const src = path.join(CONVERTER_BUNDLED_FIGURE, `${libId}.nitro`);
        const dest = path.join(HOTEL_BUNDLED_FIGURE, `${libId}.nitro`);

        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            copied++;
        } else {
            notFound++;
        }
    }

    console.log(`  Archivos .nitro copiados: ${copied}`);
    if (notFound > 0) console.log(`  No encontrados en converter (puede que no tuvieran SWF): ${notFound}`);
    return copied;
}

async function main() {
    console.log("==============================================");
    console.log("   Habbo Tools Suite: Sincronizador de Ropa   ");
    console.log("==============================================");
    console.log("Este script descargará la ropa oficial más reciente de Habbo");
    console.log("y la añadirá a tu hotel SIN tocar tus prendas custom.\n");

    const confirm = await question("¿Iniciar la sincronización de ropa? [y/N]: ");
    if (confirm.toLowerCase() !== 'y') {
        console.log("Cancelado.");
        rl.close();
        process.exit(0);
    }

    try {
        // 1. Get Gordon URL
        const gordonUrl = await fetchGordonUrl();

        // 2. Backup and configure converter
        const backupPath = backupConverterConfig();
        configureConverterForFigure(gordonUrl);

        // 3. Run the converter (downloads XML, parses, downloads SWFs, converts to .nitro)
        console.log("\n🔄 Ejecutando Nitro Converter (esto puede tardar bastante)...");
        console.log("   Descargando FigureData, FigureMap y todos los SWFs de ropa de Habbo...\n");

        try {
            execSync('source /home/surcity-hotel/.nvm/nvm.sh && node ./dist/Main.js', {
                cwd: CONVERTER_CWD,
                shell: '/bin/bash',
                stdio: 'inherit',
                timeout: 7200000 // 2 hour timeout
            });
        } catch (e) {
            console.log("\n⚠️ El converter terminó con algunos errores (esto es normal para SWFs que no existen).");
        }

        // 4. Restore converter config
        restoreConverterConfig(backupPath);

        // 5. Merge FigureData.json
        const officialFigureData = path.join(CONVERTER_GAMEDATA, 'FigureData.json');
        const officialFigureMap = path.join(CONVERTER_GAMEDATA, 'FigureMap.json');

        if (!fs.existsSync(officialFigureData)) {
            console.error("❌ No se encontró el FigureData.json generado por el converter.");
            rl.close();
            process.exit(1);
        }

        const newSets = mergeFigureData(officialFigureData, HOTEL_FIGUREDATA_PATH);

        // 6. Merge FigureMap.json
        let newLibIds = [];
        if (fs.existsSync(officialFigureMap)) {
            newLibIds = mergeFigureMap(officialFigureMap, HOTEL_FIGUREMAP_PATH);
        }

        // 7. Copy new .nitro files
        const copiedCount = copyNewNitroFiles(newLibIds);

        // Summary
        console.log("\n==============================================");
        console.log("✅ SINCRONIZACIÓN DE ROPA COMPLETADA");
        console.log(`   Sets de ropa nuevos: ${newSets}`);
        console.log(`   Librerías de archivos nuevas: ${newLibIds.length}`);
        console.log(`   Archivos .nitro copiados: ${copiedCount}`);
        console.log("==============================================");
        console.log("Reinicia el emulador y borra la caché del navegador para ver los cambios.");

    } catch (err) {
        console.error("❌ Error:", err.message);
        // Try to restore config if backup exists
        const backupPath = CONVERTER_CONFIG_PATH + '.bak';
        if (fs.existsSync(backupPath)) {
            restoreConverterConfig(backupPath);
        }
    }

    rl.close();
}

main();
